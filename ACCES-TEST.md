# Accès de test (3 jours) — SKYS ERP Solution

Ce document décrit comment tester l'application avec un **email et un mot de
passe par défaut**, et comment l'accès est **coupé automatiquement après
3 jours**.

---

## 1. URL publique

| Élément | URL |
| --- | --- |
| **API (backend)** | `https://gestion-de-stock-ae8a.onrender.com` |
| **Application (frontend)** | `https://souley123.github.io/quincaillerie-frontend` |
| Point de santé | `https://gestion-de-stock-ae8a.onrender.com/health` |

> Le frontend appelle automatiquement l'API publique en HTTPS (voir
> `quincaillerie-frontend/src/services/apiUrl.js`).

---

## 2. Identifiants par défaut

| Champ | Valeur |
| --- | --- |
| **Email** | `demo@skys-erp.com` |
| **Mot de passe** | *(défini par `DEMO_MOT_DE_PASSE`, à saisir dans Render)* |
| Rôle | Administrateur |
| Sous-domaine | `demo` |

Le mot de passe par défaut en local est `Skys-Demo-2026!`, mais **en
production il vit uniquement dans les variables d'environnement** (jamais dans
le dépôt). Définissez-le dans Render → Environment.

---

## 3. Activer le compte de test

Le compte est créé **au démarrage du serveur**, uniquement si
`DEMO_COMPTE=actif` :

| Variable | Rôle | Valeur recommandée |
| --- | --- | --- |
| `DEMO_COMPTE` | Active la création du compte | `actif` |
| `DEMO_EMAIL` | Email de connexion | `demo@skys-erp.com` |
| `DEMO_MOT_DE_PASSE` | Mot de passe (**secret**) | à définir dans Render |
| `DEMO_SLUG` | Sous-domaine de l'entreprise | `demo` |
| `DEMO_DUREE_JOURS` | Durée de validité | `3` |

Dans `render.yaml`, ces variables sont déjà déclarées. **Il ne reste qu'à
saisir `DEMO_MOT_DE_PASSE` dans Render → Environment** (champ `sync: false`).

---

## 4. Blocage automatique après 3 jours

Le blocage est **double**, pour ne dépendre ni de l'horloge du navigateur ni
d'une action de l'utilisateur :

1. **Côté serveur (autorité)** — à chaque requête authentifiée et à chaque
   connexion, `middleware/tenant.js` et `authController.js` comparent
   `abonnementEcheance` à la date du jour. Si elle est dépassée :
   - l'accès est refusé avec **HTTP 402** ;
   - `abonnementActif` est persisté à `false` pour rester cohérent.

2. **Côté application** — l'intercepteur d'`api.js` écoute le **402** et
   déclenche `skys:abonnement-expire`. `App.js` affiche alors l'écran
   « ⏳ Période d'essai de 3 jours expirée » **avant** tout autre écran, et
   l'ERP devient inaccessible.

> Même un jeton de session encore valide ne suffit pas : le serveur revérifie
> l'échéance à chaque requête.

### Vérification manuelle

```powershell
$api = "https://gestion-de-stock-ae8a.onrender.com"

# Connexion avec le compte de test
curl.exe -sS -X POST "$api/api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"demo@skys-erp.com\",\"motDePasse\":\"VOTRE_MOT_DE_PASSE\"}'
```

| Réponse | Signification |
| --- | --- |
| `200` + `jeton` | Compte actif, accès autorisé |
| `402` + « période d'essai ou d'abonnement est expirée » | Blocage automatique appliqué ✅ |

---

## 5. Sécurité — à respecter

- **Ne pas laisser `DEMO_COMPTE=actif` en production réelle.** Le compte de
  test est un accès délibéré : désactivez-le (`DEMO_COMPTE=inactif`) une fois
  les tests terminés.
- Le mot de passe de test est un **secret** : il vit dans Render, jamais dans
  le dépôt Git.
- Un compte de test recréé à chaque redémarrage réinitialise ses verrous de
  connexion, ce qui est voulu pour les démonstrations.

---

## 6. Après les 3 jours

Pour prolonger un test : mettre à jour `DEMO_MOT_DE_PASSE` (ou `DEMO_DUREE_JOURS`)
dans Render et redéployer. Le service recalcule une nouvelle échéance de 3 jours
au démarrage.

Pour un client réel : souscrire un palier payant. À l'expiration, l'écran de
blocage propose directement Wave, Orange Money, Moov Money et MTN Money.
