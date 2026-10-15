# 🆕 Créer une NOUVELLE version du service Render (repartir de zéro)

> **Contexte** : l'ancien service Render servait une version obsolète du code
> (`/health` → 404) et ne recevait pas les déploiements. La solution propre est de
> **supprimer l'ancien service** et d'en **créer un neuf**, relié au bon dépôt.
>
> ⚠️ La création d'un service Render se fait **uniquement dans le dashboard web**
> (<https://dashboard.render.com>) : cela ne peut pas être fait depuis le dépôt.
> Ce document liste tout ce qu'il faut faire, dans l'ordre.

---

## Étape 0 — Sauvegarder les secrets AVANT de supprimer l'ancien service

L'ancien service contient des variables d'environnement (secrets) qu'il faut
**noter avant suppression**, sinon il faudra les régénérer :

Dashboard Render → service **`gestion-de-stock-ae8a`** (le service en ligne, à
supprimer) → **Environment** → relever les valeurs de :

| Variable | Où la retrouver si perdue |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers |
| `JWT_SECRET` | *régénérable* (déconnecte toutes les sessions) |
| `SMTP_USER` / `SMTP_PASSWORD` | Compte Gmail `supportskys@gmail.com` → mots de passe d'application |
| `KKIAPAY_PUBLIC` / `KKIAPAY_PRIVATE` / `KKIAPAY_SECRET` | Dashboard Kkiapay |

> 💡 Alternative recommandée : **plutôt que supprimer**, il suffit souvent de
> **corriger** le service existant (voir `REDEPLOYER-RENDER.md`). Ne créer un
> nouveau service que si l'ancien est vraiment irrécupérable.

---

## Étape 1 — Supprimer l'ancien service (si décidé)

Dashboard Render → service **`gestion-de-stock-ae8a`** → **Settings** →
tout en bas → **Delete Service** → confirmer.

> ⚠️ Cela libère le nom **`gestion-de-stock-ae8a`**. Le nouveau service reprend
> ce même nom et cette même URL (`https://gestion-de-stock-ae8a.onrender.com`),
> ce qui évite de reconfigurer le frontend (Étape 4). Si vous choisissez un
> autre nom, l'URL changera : reportez-la alors partout (voir Étape 4).
> ❌ N'utilisez PAS le nom `skys-erp-api` : ce service n'existe pas sur Render
> (toutes ses URL renvoient 404).

---

## Étape 2 — Créer le nouveau service

### Option A — Via le Blueprint (recommandé, utilise `render.yaml`)

1. Render → **New → Blueprint**.
2. Choisir le dépôt : `Souley123/quincaillerie-frontend`.
3. Render lit `render.yaml` (à la racine) et propose le service
   **`gestion-de-stock-ae8a`** (nom défini dans `render.yaml`) avec :
   - Root Directory : `quicaillerie-backend`
   - Build Command : `npm install --omit=dev`
   - Start Command : `npm start`
   - Health Check Path : `/health`
   - Auto-Deploy : `Yes`
4. **Apply**.

### Option B — Création manuelle (si le Blueprint échoue)

Render → **New → Web Service** :

| Champ | Valeur |
| --- | --- |
| Name | `gestion-de-stock-ae8a` (doit correspondre EXACTEMENT à `render.yaml`) |
| Repository | `Souley123/quincaillerie-frontend` |
| Branch | `main` |
| **Root Directory** | `quicaillerie-backend` |
| Runtime | `Node` |
| Build Command | `npm install --omit=dev` |
| Start Command | `npm start` |
| **Health Check Path** | `/health` |
| Instance Type | `Starter` (payant : pas de mise en veille) |
| Region | `Frankfurt` |

---

## Étape 3 — Renseigner les variables d'environnement

Nouveau service → **Environment** → ajouter :

| Clé | Valeur |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_VERSION` | `1.0.0` |
| `MONGODB_URI` | *(secret — MongoDB Atlas)* |
| `JWT_SECRET` | *(secret — 32+ caractères)* |
| `JWT_DUREE` | `12h` |
| `APP_URL` | `https://souley123.github.io` |
| `CORS_ORIGINS` | `https://souley123.github.io,http://localhost:3000,http://127.0.0.1:3000` |
| `JSON_LIMIT` | `1mb` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `supportskys@gmail.com` |
| `SMTP_PASSWORD` | *(secret — mot de passe d'application Gmail)* |
| `SMTP_FROM` | `SKYS ERP Solution <supportskys@gmail.com>` |
| `ADMIN_EMAIL` | `supportskys@gmail.com` |
| `KKIAPAY_PUBLIC` / `KKIAPAY_PRIVATE` / `KKIAPAY_SECRET` | *(secrets Kkiapay)* |
| `KKIAPAY_BASE_URL` | `https://api.kkiapay.me` |

> ❌ **Sans `CORS_ORIGINS`**, le serveur refuse de démarrer en production.
> ❌ **Sans `SMTP_*` + `APP_URL`**, l'e-mail de réinitialisation est ignoré.

---

## Étape 4 — Mettre à jour le frontend avec la nouvelle URL

Si l'URL du nouveau service diffère de `gestion-de-stock-ae8a.onrender.com` :

1. Mettre à jour **`quincaillerie-frontend/src/services/apiUrl.js`** :
   ```js
   export const API_PUBLIQUE = 'https://NOUVELLE-URL.onrender.com';
   ```
2. Mettre à jour le repli du workflow
   **`quincaillerie-frontend/.github/workflows/deploy-frontend.yml`**
   (`REACT_APP_API_URL: ${{ vars.REACT_APP_API_URL || 'https://NOUVELLE-URL.onrender.com' }}`)
   et, pour l'app native, `quincaillerie-frontend/capacitor.config.json`
   (`allowNavigation`).
3. GitHub → **Settings → Secrets and variables → Actions → Variables** :
   `REACT_APP_API_URL` = `https://NOUVELLE-URL.onrender.com`.
4. Lancer le workflow **Deploy frontend to GitHub Pages**.

---

## Étape 5 — Vérifier que tout est propre

Depuis `quicaillerie-backend` :

```powershell
$env:API_URL="https://gestion-de-stock-ae8a.onrender.com"
node scripts/verifier-prod.mjs
```

Attendu :

```
OK   GET / — HTTP 200
OK   GET /health (backend a jour ?) — HTTP 200
OK   POST /api/auth/mot-de-passe/oublie — HTTP 200
OK   CORS origin inconnue refusee — HTTP 403
VERDICT : backend A JOUR, réinitialisation opérationnelle.
```

Puis test réel de bout en bout :

```powershell
node scripts/diagnostic-oublie.mjs mon@email.ci mon-slug
```

---

## Checklist finale

- [ ] Secrets sauvegardés depuis l'ancien service.
- [ ] Ancien service supprimé (si recréation).
- [ ] Nouveau service créé avec **Root Directory = `quicaillerie-backend`**.
- [ ] **Health Check Path = `/health`**.
- [ ] **Auto-Deploy = Yes** (sinon le problème reviendra).
- [ ] Toutes les variables d'environnement saisies (surtout `CORS_ORIGINS`, `SMTP_*`, `APP_URL`).
- [ ] État du service = **Live**.
- [ ] `node scripts/verifier-prod.mjs` → **VERDICT : backend A JOUR**.
- [ ] Frontend mis à jour si l'URL a changé.
- [ ] Test réel de réinitialisation reçu par e-mail (vérifier aussi le SPAM).
