# Checklist de déploiement — Backend public + Mobile

## État actuel (vérifié)

| Élément | État |
| --- | --- |
| Code backend poussé sur GitHub (`main`) | ✅ à jour (fix réinit. inclus) |
| Code frontend poussé sur GitHub (`main`) | ✅ à jour (slug réinit. inclus) |
| URL publique | `https://gestion-de-stock-ae8a.onrender.com` |
| CORS strict côté code | ✅ présent dans `quicaillerie-backend/server.js` |
| **CORS strict EN LIGNE** | ❌ **pas encore actif** (le backend accepte toute origine) |
| **Route réinit. `/health` en ligne** | ❌ **`404` — backend obsolète** |

> ⚠️ **CAUSE RACINE de « la réinit. marche en interne, pas en externe » :**
> le service Render tourne encore sur une **ancienne version du code**.
> La route `/api/auth/mot-de-passe/oublie` (ajoutée au commit `458a967`) est
> **absente en production** → `404`. Le SMTP et le code, eux, sont corrects.
> Voir le détail et les preuves dans **`DIAGNOSTIC-REINITIALISATION.md`**.
>
> Le nom du service (`gestion-de-stock-ae8a`) ne correspondait pas à celui du
> `render.yaml` (`skys-erp-solution-api`) : le service a été créé manuellement
> et n'était pas forcément relié au bon dépôt/branche. Le `render.yaml`
> divergent (dans `quincaillerie-frontend/`) a été supprimé.
>
> **Tant que `/health` renvoie `404`, il faut redéployer (Étape 3).**

---

## Étape 1 — Relier le service Render au bon dépôt

Dashboard Render → service `gestion-de-stock-ae8a` → **Settings** :

| Champ | Valeur attendue |
| --- | --- |
| Repository | `Souley123/quincaillerie-frontend` |
| Branch | `main` |
| **Root Directory** | `quicaillerie-backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Auto-Deploy | `Yes` (On Commit) |

> ⚠️ Le dossier s'écrit **`quicaillerie-backend`** (avec un seul `n` après `quica`).
> C'est le nom réel du dossier dans le dépôt.

## Étape 2 — Variables d'environnement (Render → Environment)

| Clé | Valeur |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | *(secret — votre URI MongoDB Atlas)* |
| `JWT_SECRET` | *(secret — 32 caractères minimum)* |
| `JWT_DUREE` | `12h` |
| `APP_URL` | `https://souley123.github.io` |
| `CORS_ORIGINS` | `https://souley123.github.io,http://localhost:3000,http://127.0.0.1:3000` |

> Sans `CORS_ORIGINS`, le serveur **refuse de démarrer** en production
> (`server.js` lève une erreur explicite).

## Étape 3 — Redéployer

Render → service → **Manual Deploy → Deploy latest commit**.

## Étape 4 — Vérifier

Depuis la racine du projet :

```powershell
powershell -ExecutionPolicy Bypass -File .\verifier-deploiement.ps1
```

Attendu après redéploiement :

| Origine testée | Résultat attendu |
| --- | --- |
| `https://souley123.github.io` | `204` (autorisée) |
| `https://localhost` (Android/iOS) | `204` (autorisée) |
| `capacitor://localhost` (iOS) | `204` (autorisée) |
| `https://evil.example.com` | **403** (refusée) |

Tant que `evil.example.com` renvoie `204`, le backend n'est pas à jour.

### Étape 4bis — Vérifier que la ROUTE de réinitialisation existe

Un backend déployé mais **obsolète** répond `404` sur les routes récentes :
le frontend affiche alors « Service de réinitialisation indisponible »,
même si le SMTP local fonctionne parfaitement. Vérifier la route elle-même :

```powershell
Invoke-WebRequest "https://gestion-de-stock-ae8a.onrender.com/api/auth/mot-de-passe/oublie" `
  -Method POST -ContentType "application/json" -Body '{"email":"test@test.com"}' `
  -UseBasicParsing | Select-Object StatusCode
```

| Résultat | Signification |
| --- | --- |
| `200` | Route présente, backend à jour. |
| `404` | **Backend obsolète** : redéployer le dernier commit (Étape 3). |

### Étape 4ter — Diagnostic automatique (recommandé)

Le script suivant vérifie **d'un coup** que le backend déployé est à jour
(`/health`) PUIS que la demande de réinitialisation aboutit :

```powershell
# Depuis quicaillerie-backend
node scripts/diagnostic-oublie.mjs mon@email.ci mon-slug
```

Il distingue explicitement « backend obsolète (404) » de « backend à jour,
e-mail envoyé (200) » — c'est le test de référence pour ce problème.