# Tunnels réseau — national et international

## Pourquoi des tunnels ?

Le serveur est hébergé à **Francfort** (Render). Depuis la **Côte d'Ivoire**,
chaque aller-retour coûte **150 à 250 ms**. Sur un réseau mobile instable
(2G/3G, coupures fréquentes), une requête peut échouer avant d'atteindre
l'API. Les tunnels adaptent le **transport** à la qualité du réseau.

## Les trois tunnels

| Tunnel | Clients visés | Tentatives | Délai initial | Tolérance coupure |
| --- | --- | --- | --- | --- |
| **national** | Côte d'Ivoire + UEMOA | 5 | 250 ms | 30 s |
| **international** | Reste du monde | 3 | 500 ms | 15 s |
| **direct** | LAN / même région | 2 | 100 ms | 5 s |

### Pays du tunnel national
`CI`, `SN`, `BF`, `ML`, `NE`, `TG`, `BJ`, `GN`, `GW`, `LR`, `GH`, `NG`
(Côte d'Ivoire, Sénégal, Burkina Faso, Mali, Niger, Togo, Bénin, Guinée,
Guinée-Bissau, Liberia, Ghana, Nigeria).

## Détection automatique

Le tunnel est déduit dans cet ordre de priorité :

1. **En-tête explicite** `X-Tunnel` (le client impose son tunnel) ;
2. **Pays** fourni par le CDN/proxy (`CF-IPCountry`, `X-Country`) ;
3. **Type de réseau** `X-Network-Type` (`slow-2g`, `2g`, `3g`) → national ;
4. **Repli** → international.

Côté frontend, `devinerTunnel()` affine avec la **langue du navigateur**
(`fr-CI`), le **fuseau horaire** (Abidjan, Accra, Dakar…) et l'API
`navigator.connection`.

## En-têtes échangés

### Envoyés par le client
| En-tête | Rôle |
| --- | --- |
| `X-Tunnel` | Tunnel souhaité (`national`, `international`, `direct`) |
| `X-Network-Type` | Type de réseau détecté (`4g`, `3g`, `2g`…) |
| `Idempotency-Key` | Anti-rejeu sur les paiements |

### Renvoyés par le serveur
| En-tête | Rôle |
| --- | --- |
| `X-Tunnel` | Tunnel effectivement retenu |
| `X-Tunnel-Region` | Description lisible |
| `X-Tunnel-Retry-Max` | Nombre maximum de tentatives |
| `X-Tunnel-Retry-Delay` | Délai initial conseillé (ms) |
| `X-Tunnel-Resume-Window` | Fenêtre de reprise après coupure (ms) |
| `X-Tunnel-Id` | Identifiant stable du tunnel |
| `X-Request-Id` | Traçabilité de la requête |

## Reprise automatique

`avecReprise()` (frontend) relance une opération réseau échouée :

- **Backoff exponentiel** avec jitter : 250 → 500 → 1000 → 2000 ms ;
- **Hors ligne** : attente de 3 s sans consommer de tentative, jusqu'au
  retour du réseau ;
- **Erreurs métier** (400, 401, 403, 409) : **jamais** rejouées — seule une
  panne réseau (5xx, timeout) mérite une nouvelle tentative.

## Endpoints publics

| Route | Réponse |
| --- | --- |
| `GET /api/tunnel` | Tunnel retenu + politique de reprise |
| `GET /api/tunnel/pays` | Liste des pays du tunnel national |

Exemple :

```powershell
curl.exe -sS "https://VOTRE-API.onrender.com/api/tunnel" -H "Origin: https://souley123.github.io"
```

```json
{
  "tunnel": "national",
  "description": "Côte d'Ivoire et UEMOA — réseau mobile instable",
  "reprise": { "tentativesMax": 5, "delaiInitialMs": 250, "delaiMaxMs": 2000 },
  "coupure": { "toleranceMs": 30000 },
  "compression": true,
  "tailles": "reduite"
}
```

## Sécurité

Les tunnels **n'affaiblissent aucune protection** :

- Ils agissent uniquement sur le **transport** et la **traçabilité** ;
- Aucune donnée sensible n'est transmise dans les en-têtes ;
- Les en-têtes `X-Tunnel` sont validés contre une **liste blanche** : une
  valeur inconnue retombe sur le tunnel international ;
- CORS autorise explicitement `X-Tunnel`, `X-Network-Type` et
  `Idempotency-Key` — rien de plus ;
- L'identifiant `X-Tunnel-Id` est une **empreinte hachée**, jamais une IP.

## Tests

```powershell
cd quicaillerie-backend
node tests\tunnels.test.js
```

16 vérifications couvrent le choix du tunnel, les politiques de reprise,
le backoff et l'absence de fuite dans le descripteur public.
