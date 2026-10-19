# Diagnostic historique — réinitialisation du mot de passe
> ⚠️ **Ce document décrit un incident passé**, concernant l'ancien service
> `gestion-de-stock-ae8a`, aujourd'hui hors service. Le backend en ligne est
> désormais **`gestion-de-stocks-5lv3.onrender.com`**. Il a été vérifié le
> 2026-10-16 (`VERDICT : backend A JOUR`). Pour la configuration actuelle,
> consultez `CREER-NOUVEAU-SERVICE-RENDER.md`.

## Résumé
Le message « Le lien/e-mail de réinitialisation ne parvient pas au destinataire :
ça passe en interne, mais pas en externe » était causé par une ancienne version
du backend déployée sur Render. Les tests disponibles montraient que le SMTP et
le parcours local fonctionnaient, tandis que les routes de production
répondaient `404`.

> **Portée du diagnostic :** les résultats ci-dessous sont des observations
> historiques sur `gestion-de-stock-ae8a`, pas un état actuel du service en ligne.

## Éléments constatés
| Vérification | Commande / requête | Résultat observé à l'époque |
| --- | --- | --- |
| Configuration SMTP | `node scripts/diagnostic-smtp.mjs` | ✅ Identifiants acceptés par Gmail |
| Envoi vers une adresse externe | `node scripts/diagnostic-smtp.mjs ksouleymanesoro60@gmail.com` | ✅ Accepté par Gmail |
| Backend local — `/health` | `Invoke-WebRequest http://localhost:5001/health` | ✅ `200` |
| Backend local — demande de réinitialisation | POST `/api/auth/mot-de-passe/oublie` | ✅ `200` (e-mail envoyé) |
| Ancien backend Render — `/health` | `Invoke-WebRequest https://gestion-de-stock-ae8a.onrender.com/health` | ❌ `404` |
| Ancien backend Render — demande de réinitialisation | POST `/api/auth/mot-de-passe/oublie` | ❌ `404` |

## Diagnostic de l'incident
À la date des tests, l'ancien service Render `gestion-de-stock-ae8a` exécutait
une version antérieure au commit `458a967`, qui avait ajouté les routes
`/api/auth/mot-de-passe/oublie` et `/health`.

Les indices consignés étaient les suivants : `/health`, présent dans le code
après ce commit, répondait `404` en production ; la réponse de `/` ne contenait
pas les champs `version`, `statut` et `horodatage` attendus de la version alors
courante. Cela indiquait un déploiement en retard sur cet ancien service.

- **En local :** la route existait et les tests consignés réussissaient.
- **Sur l'ancien service en production :** les routes répondaient `404`, ce qui
  entraînait l'affichage de « Service de réinitialisation indisponible » côté
  frontend.

### Facteurs de déploiement relevés
- Le service Render avait été créé manuellement sous le nom
  `gestion-de-stock-ae8a`, différent du nom du blueprint
  `skys-erp-solution-api`.
- Un second `render.yaml`, situé dans `quincaillerie-frontend/`, portait ce nom
  différent et avait créé de la confusion. Ce fichier a été supprimé.

## Modifications consignées
Les changements ci-dessous étaient indiqués comme déjà poussés sur `main` au
moment de la rédaction de ce diagnostic :

1. **Identification de l'entreprise :** `src/services/api.js` et `src/App.js`
   transmettent le slug de l'entreprise depuis le formulaire « Mot de passe
   oublié ». Comme l'adresse e-mail n'est unique qu'au sein d'une entreprise,
   le slug permet de sélectionner le compte attendu.
2. **Configuration Render à la racine :** le `buildCommand` a été remplacé par
   `npm install --omit=dev` au lieu de `npm ci`, afin d'éviter qu'un écart de
   lockfile bloque le build.
3. **Configuration en double :** le `render.yaml` jugé trompeur dans
   `quincaillerie-frontend/` a été supprimé.

## Procédure de redéploiement historique
> Cette action concernait l'ancien service `gestion-de-stock-ae8a`. Ne l'appliquez
> pas sans avoir d'abord vérifié la configuration actuelle de Render.

À l'époque, aucun jeton API Render n'était configuré dans le dépôt ; le
redéploiement devait donc être lancé depuis le dashboard Render :

1. Ouvrir le service `gestion-de-stock-ae8a`.
2. Dans **Settings**, vérifier les paramètres attendus alors :
   - Repository : `Souley123/quincaillerie-frontend`
   - Branch : `main`
   - Root Directory : `quicaillerie-backend`
   - Build Command : `npm install`
   - Start Command : `npm start`
   - Auto-Deploy : `Yes` (**On Commit**).
3. Lancer **Manual Deploy → Deploy latest commit**.
4. Attendre la fin du build (estimation d'alors : 2–5 minutes).

## Vérifications consignées
### Contrôle global
Depuis `quicaillerie-backend` :

```powershell
node scripts/verifier-prod.mjs
```

| Résultat | Interprétation consignée |
| --- | --- |
| `VERDICT : backend A JOUR…` (code `0`) | Backend vérifié à jour lors de ce contrôle. |
| `>>> Le backend public est OBSOLETE` (code `1`) | Routes récentes absentes ; vérifier le déploiement. |
| `>>> Backend injoignable` (code `2`) | Problème réseau ou service Render indisponible. |

### Contrôle ciblé de la réinitialisation
```powershell
node scripts/diagnostic-oublie.mjs ksouleymanesoro60@gmail.com maquincaillerie
```

Réponse attendue après un déploiement réussi à l'époque :

```text
GET .../health
HTTP 200 — {"statut":"ok","base":"connectee",...}
POST .../api/auth/mot-de-passe/oublie
HTTP 200 — {"message":"Si ce compte existe, un lien de réinitialisation lui sera envoyé."}
OK : le backend a accepte la demande.
```

Dans le contexte de cet incident, un `404` sur `/health` indiquait que le
backend testé ne servait pas la version attendue. Ces résultats ne décrivent pas
l'état actuel du backend.

## Surveillance automatisée consignée
Le dépôt indiquait qu'un workflow GitHub exécutait `scripts/verifier-prod.mjs` :

- après chaque push sur `main` ;
- toutes les six heures ;
- à la demande depuis **Actions → Surveiller le backend en production → Run workflow**.

Fichier mentionné : `.github/workflows/surveiller-backend.yml`.

> Un échec de ce contrôle signalait que le backend vérifié pouvait être obsolète
> ou injoignable. Pour toute action actuelle, vérifiez d'abord le service et la
> configuration Render en vigueur ; ne vous fiez pas à cette procédure historique.
