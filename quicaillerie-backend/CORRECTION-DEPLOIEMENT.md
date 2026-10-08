# Correction du déploiement — à exécuter pas à pas

> **Situation actuelle (vérifiée le 14/04/2026)**
> - Le code est corrigé **localement** mais **pas déployé**.
> - L'API en ligne (`gestion-de-stock-ae8a.onrender.com`) tourne sur l'**ancien code** :
>   `GET /api/tunnel` → 404, `GET /health` → 404, CORS `evil.example.com` → 204
>   (au lieu de 403).
> - **Deux problèmes indépendants** : (A) le frontend n'est pas versionné,
>   (B) Render n'est pas relié au bon code.

---

## Diagnostic précis (vérifié dans le dépôt GitHub)

Arborescence réelle de `origin/main` :

```
quicaillerie-backend      ← le backend, VERSIONNÉ et à jour         ✅
quicaillerie-frontend     ← dossier en double (1 seul « n »)         ⚠️
quincaillerie-frontend    ← gitlink mort (2 « n ») = vrai code      ❌
render.yaml               ← rootDir = quicaillerie-backend          ✅
```

| Élément | Constat | Correct ? |
| --- | --- | --- |
| `quicaillerie-backend` | 47 fichiers suivis, commit `a141650` | ✅ |
| `render.yaml` → `rootDir` | `quicaillerie-backend` | ✅ |
| `render.yaml` → `name` | `skys-erp-solution-api` | ❌ ≠ service réel |
| Service qui tourne | `gestion-de-stock-ae8a` | ❌ créé à la main |
| Workflow → chemin | `quincaillerie-frontend` | ❌ **gitlink mort** |

**Bonne nouvelle : le backend est correctement versionné.** Render *peut*
donc le déployer. Le seul vrai blocage côté API est le **nom du service
Render désynchronisé** de `render.yaml`.

---

## Problème A — Le frontend est un « submodule fantôme »

### Ce qui est constaté

```powershell
git ls-tree HEAD quincaillerie-frontend
# 160000 commit f38bc0a974dfec67d665216252eb7395b8bc246b  quincaillerie-frontend
```

| Fait | Conséquence |
| --- | --- |
| Mode `160000` = gitlink (submodule) | Git voit un **lien**, pas des fichiers |
| Aucun fichier `.gitmodules` | Le lien ne mène **nulle part** |
| `quincaillerie-frontend/.git` **n'existe pas** | Aucun dépôt interne à pointer |
| Commit `f38bc0a` **introuvable** | Le lien est **mort** |
| **1 seul** fichier suivi par git | Les **39 fichiers** de `src/` ne sont **pas** versionnés |

**Sur GitHub, le dossier `quincaillerie-frontend` apparaît donc vide.** Le
workflow `deploy-frontend.yml` ne peut pas compiler le frontend, puisque ses
fichiers ne sont jamais récupérés.

### Pourquoi cela arrive

`quincaillerie-frontend/.git` **existe et pointe vers le MÊME dépôt** que la
racine (`github.com/Souley123/quincaillerie-frontend.git`). Le travail du
frontend a été committé là, puis la racine a enregistré un gitlink vers ce
dépôt imbriqué — sans `.gitmodules`. Résultat : GitHub voit un lien mort.

### Correction — commandes exactes

> **Précaution** : le dépôt imbriqué est à jour (`0 0` avec son origin),
> donc **aucun travail n'est perdu**. On renomme son `.git` au lieu de le
> supprimer, afin de pouvoir revenir en arrière.

À exécuter **depuis la racine du projet** (`Formation Full Stack`) :

```powershell
# 1. Vérifier qu'on est au bon endroit
Get-Location   # doit finir par « Formation Full Stack »
git status --short

# 2. SAUVEGARDER le dépôt imbriqué (on le renomme, on ne le supprime pas)
Rename-Item "quincaillerie-frontend\.git" "quincaillerie-frontend\.git-sauvegarde"

# 2bis. Retirer le gitlink cassé de l'index (SANS toucher aux fichiers !)
git rm --cached quincaillerie-frontend

# 3. Vérifier que le dossier est toujours présent physiquement
Test-Path quincaillerie-frontend/src/App.js   # doit afficher True

# 4. Ajouter les fichiers du frontend au dépôt
git add quincaillerie-frontend

# 5. Contrôler ce qui sera versionné (doit lister des .js, .json, .css…)
git status --short | Select-Object -First 30

# 6. Vérifier qu'aucun node_modules / build ne sera ajouté
git status --short | Select-String -Pattern "node_modules|/build/"

# 7. Commiter
git commit -m "Versionner le frontend (corrige le submodule fantome)"

# 8. Pousser
git push origin main

# 9. CONTRÔLE FINAL : GitHub doit maintenant voir les fichiers
git ls-tree origin/main quincaillerie-frontend
# Attendu : un arbre (040000 tree ...) et NON plus « 160000 commit »
```

> ⚠️ **Étape 2 sans `--cached` supprimerait vos fichiers !** La commande
> `git rm --cached` ne touche que l'index ; le dossier sur le disque reste
> intact. C'est la seule commande correcte ici.

---

## Problème B — Render n'est pas relié au bon code

### Ce qui est constaté

| Élément | Réalité |
| --- | --- |
| Service qui tourne | `gestion-de-stock-ae8a` (créé **manuellement**) |
| Service déclaré | `skys-erp-solution-api` (dans `render.yaml`) |
| Résultat pour `skys-erp-solution-api.onrender.com` | **Not Found** |

Le service en production n'est donc **piloté ni par `render.yaml`, ni par le
commit `a141650`**. Il sert une version figée.

### Correction — champs à saisir dans Render

Dashboard Render → service **`gestion-de-stock-ae8a`** → onglet **Settings** :

| Champ | Valeur exacte à saisir |
| --- | --- |
| **Name** | `gestion-de-stock-ae8a` *(ne pas changer, l'URL en dépend)* |
| **Region** | `Frankfurt (EU Central)` |
| **Branch** | `main` |
| **Repository** | `Souley123/quincaillerie-frontend` |
| **Root Directory** | `quicaillerie-backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install --omit=dev` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/health` |
| **Auto-Deploy** | `Yes` |

> ⚠️ **Root Directory** doit être exactement **`quicaillerie-backend`**
> (avec **un seul `n`** après `quica` — c'est le nom réel du dossier).
> Sans ce champ, Render cherche `package.json` à la racine et échoue.

Ensuite, onglet **Environment** — ajouter ces variables :

| Clé | Valeur | Type |
| --- | --- | --- |
| `NODE_ENV` | `production` | texte |
| `MONGODB_URI` | `mongodb+srv://…` | **secret** |
| `JWT_SECRET` | 48 octets aléatoires | **secret** |
| `JWT_DUREE` | `12h` | texte |
| `APP_URL` | `https://souley123.github.io/quincaillerie-frontend` | texte |
| `CORS_ORIGINS` | `https://souley123.github.io,http://localhost:3000,http://127.0.0.1:3000` | texte |
| `APP_VERSION` | `1.0.0` | texte |
| `KKIAPAY_PUBLIC` | clé publique Kkiapay | texte |
| `KKIAPAY_PRIVATE` | clé privée Kkiapay | **secret** |
| `KKIAPAY_SECRET` | clé secrète Kkiapay | **secret** |

Générer un `JWT_SECRET` solide :

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Puis : **Manual Deploy → Deploy latest commit**, et attendre l'état **Live**.

---

## Vérification finale

```powershell
# Depuis la racine du projet
powershell -ExecutionPolicy Bypass -File .\quicaillerie-backend\verifier-deploiement.ps1
```

| Contrôle | Attendu |
| --- | --- |
| `GET /` | JSON avec `"statut": "ok"` et `"pareFeux": 12` |
| `GET /health` | `200`, `"base": "connectee"` |
| `GET /api/tunnel` | JSON avec `"tunnel": "national"` |
| En-tête `X-Tunnel` | présent sur chaque réponse |
| En-tête `X-Request-Id` | présent |
| CORS `https://souley123.github.io` | `204` |
| CORS `https://localhost` (mobile) | `204` |
| CORS `capacitor://localhost` (iOS) | `204` |
| **CORS `https://evil.example.com`** | **`403`** ← le test décisif |

Test manuel des pare-feux :

```powershell
$api = "https://gestion-de-stock-ae8a.onrender.com"

# 1. Tunnel national détecté depuis la Côte d'Ivoire
curl.exe -sS "$api/api/tunnel" -H "Origin: https://souley123.github.io" -H "X-Network-Type: 3g"

# 2. Injection XSS : DOIT renvoyer 400
curl.exe -sS -o NUL -w "%{http_code}`n" -X POST "$api/api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"<script>alert(1)</script>\",\"motDePasse\":\"x\"}'

# 3. Outil offensif : DOIT renvoyer 403
curl.exe -sS -o NUL -w "%{http_code}`n" "$api/" -A "sqlmap/1.7"

# 4. En-têtes de sécurité : DOIT contenir X-Frame-Options: DENY
curl.exe -sS -D - -o NUL "$api/" | Select-String -Pattern "X-Frame-Options|Content-Security-Policy|Strict-Transport"
```

---

## Ordre recommandé

1. **Problème A** (versionner le frontend) — sans cela, le site ne se déploie pas.
2. **Problème B étape 1** (relier Render au dépôt + Root Directory).
3. **Problème B étape 2** (variables d'environnement, dont les secrets Kkiapay).
4. **Redéployer** et lancer le script de vérification.
5. Contrôler que `evil.example.com` renvoie bien **403**.

---

## Après correction — contrôles réguliers

| Fréquence | Contrôle |
| --- | --- |
| Chaque déploiement | `verifier-deploiement.ps1` (CORS `evil` = 403) |
| Hebdomadaire | `GET /health` (base connectée) |
| Mensuel | Rotation des journaux, revue des tentatives bloquées |
| Tous les 6 mois | Renouveler `JWT_SECRET`, `KKIAPAY_SECRET`, mot de passe Atlas |
