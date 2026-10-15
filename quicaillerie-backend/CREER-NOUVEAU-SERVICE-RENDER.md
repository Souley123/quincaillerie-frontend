# 🆕 Créer une NOUVELLE version du service Render (repartir de zéro)

> **Contexte** : le service Render sert une version obsolète du code
> (`/health` → 404) et ne reçoit pas les déploiements. La solution propre est de
> **supprimer le service obsolète** et d'en **créer un neuf**, relié au bon dépôt.
>
> ⚠️ La création d'un service Render se fait **uniquement dans le dashboard web**
> (<https://dashboard.render.com>) : cela ne peut pas être fait depuis le dépôt.
> Ce document liste tout ce qu'il faut faire, dans l'ordre.

---

## Étape −1 — CONFIRMER la configuration Render (à faire en premier)

### A. Quel service sert réellement l'API ?

Testez les noms de service connus depuis n'importe quel terminal :

```powershell
foreach ($h in @('gestion-de-stock-ae8a','skys-erp-api','skys-erp-solution-api')) {
  try {
    $r = Invoke-WebRequest "https://$h.onrender.com/" -UseBasicParsing -TimeoutSec 25
    Write-Output "$h -> HTTP $($r.StatusCode)"
  } catch { Write-Output "$h -> INJOIGNABLE : $($_.Exception.Message)" }
}
```

Résultat constaté le 2026-10-15 :

| Hôte | Réponse | Verdict |
| --- | --- | --- |
| `gestion-de-stock-ae8a.onrender.com` | **200** — `{"message":"Bienvenue sur l'API SKYS ERP Solution !"}` | ✅ **c'est LE service en ligne** |
| `skys-erp-api.onrender.com` | **404** | ❌ n'existe pas — **ne jamais l'utiliser** |
| `skys-erp-solution-api.onrender.com` | **404** | ❌ n'existe pas — ancien nom trompeur |

> 🔎 **À retenir** : le nom du service en ligne est **`gestion-de-stock-ae8a`**.
> Toute URL `skys-erp-api` renvoie 404 — c'est ce qui casse le frontend et les
> scripts de diagnostic si on les laisse pointer dessus.

### B. Le service est-il à jour ?

```powershell
cd quicaillerie-backend
node scripts/verifier-prod.mjs
```

- `GET /` → 200 mais `/health` → 404 ⇒ **service obsolète** : le code déployé
  est antérieur à la route `/health`. Continuez ci-dessous.
- Les 4 contrôles en 200/403 ⇒ backend à jour, inutile de recréer le service.

### C. Le service doit-il être supprimé ou corrigé ?

| Situation | Action |
| --- | --- |
| Le service `gestion-de-stock-ae8a` répond, Root Directory = `quicaillerie-backend`, Auto-Deploy = `Yes` | **Corriger** : `REDEPLOYER-RENDER.md` (Manual Deploy) — pas besoin de recréer |
| Le service pointe sur le mauvais dépôt / mauvais dossier / Auto-Deploy impossible à activer | **Recréer** : suivez ce document à partir de l'Étape 0 |

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

- [ ] **Étape −1 faite** : le nom du service en ligne est bien `gestion-de-stock-ae8a`.
- [ ] Secrets sauvegardés depuis le service à remplacer.
- [ ] Service obsolète supprimé (si recréation).
- [ ] Nouveau service créé avec **Root Directory = `quicaillerie-backend`**.
- [ ] **Health Check Path = `/health`**.
- [ ] **Auto-Deploy = Yes** (sinon le problème reviendra).
- [ ] Toutes les variables d'environnement saisies (surtout `CORS_ORIGINS`, `SMTP_*`, `APP_URL`).
- [ ] État du service = **Live**.
- [ ] `node scripts/verifier-prod.mjs` → **VERDICT : backend A JOUR**.
- [ ] Frontend mis à jour si l'URL a changé.
- [ ] Test réel de réinitialisation reçu par e-mail (vérifier aussi le SPAM).

---

## État de la configuration côté dépôt (vérifié le 2026-10-15)

Ces fichiers sont alignés sur le service réellement en ligne et **poussés sur `main`**
(commit `f203e94`) :

| Fichier | Valeur |
| --- | --- |
| `render.yaml` → `name` | `gestion-de-stock-ae8a` |
| `render.yaml` → `rootDir` | `quicaillerie-backend` |
| `render.yaml` → `healthCheckPath` | `/health` |
| `render.yaml` → `autoDeploy` | `true` |
| `quincaillerie-frontend/src/services/apiUrl.js` | `API_PUBLIQUE = 'https://gestion-de-stock-ae8a.onrender.com'` |
| `quincaillerie-frontend/.github/workflows/deploy-frontend.yml` | repli `REACT_APP_API_URL` |
| `quincaillerie-frontend/capacitor.config.json` | `allowNavigation` (app native) |
| `quicaillerie-backend/scripts/verifier-prod.mjs` | URL par défaut |
| `quicaillerie-backend/scripts/diagnostic-oublie.mjs` | URL par défaut |

> ⚠️ Aucune correction côté dépôt ne peut corriger un service Render qui exécute
> du vieux code : il **faut** agir dans le dashboard (Auto-Deploy + Manual Deploy).
