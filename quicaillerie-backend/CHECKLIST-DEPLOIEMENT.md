# Checklist de déploiement — Backend public + Mobile

## État actuel (vérifié)

| Élément | État |
| --- | --- |
| Code backend poussé sur GitHub (`main`) | ✅ commit `8dd5d87` |
| Code frontend poussé sur GitHub (`main`) | ✅ commit `22805cd` |
| URL publique | `https://gestion-de-stock-ae8a.onrender.com` |
| CORS strict côté code | ✅ présent dans `quicaillerie-backend/server.js` |
| **CORS strict EN LIGNE** | ❌ **pas encore actif** (le backend accepte toute origine) |

> ⚠️ Le service Render tourne encore sur une **ancienne version du code**.
> Le nom du service (`gestion-de-stock-ae8a`) ne correspond pas à celui du
> `render.yaml` (`skys-erp-solution-api`) : le service a été créé manuellement
> et n'est donc peut-être pas relié au bon dépôt/branche.

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
| `APP_URL` | `https://souley123.github.io/quincaillerie-frontend` |
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