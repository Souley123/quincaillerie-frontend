# Diagnostic Render — pourquoi le nouveau code n'est pas en ligne

## TL;DR

Le code **est correct sur GitHub**. Le service Render sert l'**ancien code**
parce qu'il ne compile pas `quicaillerie-backend`. La cause la plus probable :
**le `Root Directory` de Render n'est pas (ou plus) `quicaillerie-backend`**,
et Render compile alors le `package.json` **React de la racine** au lieu du
backend.

---

## Preuves collectées

### Ce que répond le service en ligne

```powershell
curl.exe -sS "https://gestion-de-stock-ae8a.onrender.com/api/tunnel"
# → « Impossible d'obtenir /api/tunnel »  (404)

curl.exe -sS -D - -o NUL "https://gestion-de-stock-ae8a.onrender.com/"
# x-frame-options: SAMEORIGIN                ← helmet PAR DÉFAUT (ancien code)
# content-security-policy: frame-ancestors 'self'   ← ancien code
# (pas de permissions-policy, pas de X-Tunnel, pas de X-Request-Id)
```

### Ce que contient GitHub (`origin/main`)

| Élément | État |
| --- | --- |
| `quicaillerie-backend/server.js` | ✅ présent |
| `quicaillerie-backend/package.json` | ✅ présent |
| `quicaillerie-backend/middleware/pareFeu.js` | ✅ présent |
| `quicaillerie-backend/services/tunnels.js` | ✅ présent |
| `frameguard: { action: 'deny' }` dans `server.js` | ✅ présent |
| `render.yaml` → `rootDir: quicaillerie-backend` | ✅ présent |

**Le code est bon. Le dépôt est bon.** Le problème est donc **exclusivement**
la configuration du service Render.

---

## 🔴 CAUSE RÉELLE : il existe DEUX backends dans le dépôt

C'est la découverte décisive. Le dossier `quincaillerie-frontend/` (gitlink)
contient **son propre backend**, en double :

| | Backend **RACINE** (le bon) | Backend **IMBRIQUÉ** (déployé) |
| --- | --- | --- |
| Chemin | `/quicaillerie-backend/` | `/quincaillerie-frontend/quicaillerie-backend/` |
| `server.js` | **440 lignes** | **424 lignes** |
| `frameguard: deny` | ✅ présent | ❌ **absent** |
| Routes `/health`, `/api/tunnel` | ✅ présentes | ✅ présentes |
| État | **à jour** | **ancien code** |

**Render compile le backend IMBRIQUÉ**, ce qui explique exactement le
symptôme observé :

- Le log montre bien `Running 'node server.js'` → il y a bien un `server.js`
  dans le dossier imbriqué ;
- Mais `x-frame-options` reste `SAMEORIGIN` au lieu de `DENY` → ce
  `server.js` est l'ancien (424 lignes, sans `frameguard`).

### Vérification locale (à reproduire)

```powershell
# Le bon backend (racine) : 440 lignes AVEC frameguard
(Get-Content "quicaillerie-backend\server.js").Count
Select-String -Path "quicaillerie-backend\server.js" -Pattern "frameguard"

# Le backend imbriqué : 424 lignes SANS frameguard
(Get-Content "quincaillerie-frontend\quicaillerie-backend\server.js").Count
Select-String -Path "quincaillerie-frontend\quicaillerie-backend\server.js" -Pattern "frameguard"
```

### ✅ Correction immédiate

Dans Render → Settings → **Root Directory** :

```
quicaillerie-backend
```

Et **surtout PAS** `quincaillerie-frontend` (qui contient l'ancien backend
imbriqué). Puis **Clear build cache & deploy**.

Après redéploiement, `x-frame-options` doit valoir **`DENY`**.

### 🧹 Correction durable

Le doublon `quincaillerie-frontend/quicaillerie-backend/` a été **supprimé**
du dépôt : un seul backend doit exister, sinon Render peut compiler le
mauvais sans que rien ne le signale.

---

## 🔴 Second piège : un `package.json` React à la racine

Le dépôt contient **deux `package.json`** :

| Emplacement | Nature | `start` |
| --- | --- | --- |
| **`/package.json`** (racine) | Projet **React** (frontend) | `react-scripts start` |
| **`/quicaillerie-backend/package.json`** | Le **backend** Express | `npm start` → `node server.js` |

Si le **Root Directory** de Render n'est pas exactement
`quicaillerie-backend`, Render prend le `package.json` de la racine et lance
`react-scripts start` — qui **ne démarre jamais l'API**. Render garde alors
l'ancienne version en ligne, ce qui reproduit exactement le symptôme observé.

---

## Correction — procédure exacte dans Render

### 1. Vérifier le « Root Directory »

Dashboard Render → service **`gestion-de-stock-ae8a`** → **Settings** :

| Champ | Valeur EXACTE attendue | Piège à éviter |
| --- | --- | --- |
| **Root Directory** | `quicaillerie-backend` | ⚠️ **un seul `n`** après `quica` — et surtout **pas** `quincaillerie-backend` |
| Build Command | `npm install --omit=dev` | pas `npm run build` (React) |
| Start Command | `npm start` | pas `react-scripts start` |
| Health Check Path | `/health` | pas `/` |
| Branch | `main` | |
| Repository | `Souley123/quincaillerie-frontend` | |
| Auto-Deploy | `On Commit` | |

> ⚠️ Le nom du dossier est **`quicaillerie-backend`** (un seul `n`).
> Écrire `quincaillerie-backend` (deux `n`) fait échouer Render, qui ne
> trouve pas le dossier.

### 2. Vérifier les logs de build

Render → **Logs**. Au démarrage, on **doit** voir :

```
Serveur démarré sur http://localhost:XXXX
Connecté à MongoDB Atlas pour SKYS ERP Solution !
```

Si l'on voit autre chose (erreurs React, `react-scripts`, `webpack`…), c'est
que le **mauvais `package.json`** a été utilisé → corriger le Root Directory.

### 3. Forcer un redéploiement propre

**Manual Deploy → Clear build cache & deploy**.

Cela force Render à réinstaller depuis zéro, sans cache React résiduel.

---

## ✅ Test de validation (2 secondes)

Ouvre dans ton navigateur :

```
https://gestion-de-stock-ae8a.onrender.com/api/tunnel
```

| Réponse | Signification |
| --- | --- |
| « Impossible d'obtenir /api/tunnel » | ❌ ancien code — Root Directory à corriger |
| `{"tunnel":"national", ...}` | ✅ nouveau code déployé |

Puis vérifie les en-têtes :

```powershell
curl.exe -sS -D - -o NUL "https://gestion-de-stock-ae8a.onrender.com/"
```

| En-tête | Ancien code | Nouveau code |
| --- | --- | --- |
| `x-frame-options` | `SAMEORIGIN` | **`DENY`** |
| `content-security-policy` | `frame-ancestors 'self'` | `frame-ancestors 'none'` + `cdn.kkiapay.me` |
| `permissions-policy` | **absent** | **présent** |
| `X-Tunnel` | **absent** | **présent** |
| `X-Request-Id` | **absent** | **présent** |

---

## 🧹 Recommandation : nettoyer la racine du dépôt

La racine contient un `package.json` React **et** des vestiges du frontend
(`src/`, `public/`, `build/`). C'est ce qui rend le déploiement ambigu.

Deux options propres :

**Option A (recommandée)** — garder **un seul dépôt** :
- déplacer le frontend dans un dossier clair (ou le remettre en gitlink
  correct via `.gitmodules`),
- **supprimer** `package.json`, `src/`, `public/`, `build/` de la racine,
- n'avoir à la racine que : `quicaillerie-backend/`, `quincaillerie-frontend/`,
  `render.yaml`, `.github/`.

**Option B** — garder deux dépôts séparés (un backend, un frontend), ce qui
lève toute ambiguïté. `render.yaml` déclare alors `rootDir` du dépôt backend.

Dans les deux cas : **Render doit pointer sur `quicaillerie-backend`**, et
aucun `package.json` React ne doit pouvoir être pris à sa place.

---

## Résumé

| Question | Réponse |
| --- | --- |
| Le code est-il sur GitHub ? | **Oui**, vérifié commit par commit |
| Le backend est-il complet ? | **Oui** : `server.js`, `pareFeu.js`, `tunnels.js`… |
| Pourquoi l'API sert-elle l'ancien code ? | Render compile le **mauvais `package.json`** |
| Que corriger ? | **Root Directory = `quicaillerie-backend`** (un seul `n`) |
| Puis ? | **Clear build cache & deploy** |
| Test décisif ? | `/api/tunnel` doit renvoyer du JSON, pas « Impossible d'obtenir » |
