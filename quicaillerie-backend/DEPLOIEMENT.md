# Déploiement & sécurité du backend SKYS ERP Solution

## 1. Variables d'environnement (Render → Environment)

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `NODE_ENV` | oui | Doit valoir `production` (active HTTPS, CORS strict, cookies sécurisés). |
| `MONGODB_URI` | oui | URI MongoDB Atlas. À encoder si le mot de passe contient `@ < >`. |
| `JWT_SECRET` | oui | Secret de signature, 32 caractères minimum. `render.yaml` le génère. |
| `JWT_DUREE` | non | Durée de session (`12h`, `7d`…). |
| `CORS_ORIGINS` | oui | Origines frontend autorisées, séparées par des virgules. |
| `APP_URL` | oui | URL HTTPS publique du frontend (liens de réinitialisation par email). |
| `JSON_LIMIT` | non | Taille maximale du corps reçu (défaut `1mb`). |
| `SMTP_*`, `ADMIN_EMAIL` | non | Envoi des emails (réinitialisation, alertes). |
| `WHATSAPP_*` | non | Alertes WhatsApp via Meta Cloud API. |

> Les secrets ne doivent JAMAIS être placés dans le frontend ni dans une variable publique GitHub Actions.

## 2. Origines CORS

En production, `server.js` **refuse de démarrer** si `CORS_ORIGINS` est vide. Le site étant servi
depuis GitHub Pages, l'origine à autoriser est exactement `https://souley123.github.io`
(l'origine, sans chemin). Exemple :

```
CORS_ORIGINS=https://souley123.github.io,http://localhost:3000,http://127.0.0.1:3000
```

L'API utilise `Authorization: Bearer`, pas de cookie inter-site : `withCredentials` doit rester
désactivé côté frontend.

### Applications mobiles (Android / iOS via Capacitor)

Le WebView natif envoie une origine interne, autorisée automatiquement par `server.js`
(constante `ORIGINES_NATIVES`) sans avoir à la lister dans `CORS_ORIGINS` :

| Plateforme | Origine |
| --- | --- |
| Android (`androidScheme: https`) | `https://localhost` |
| iOS (`iosScheme: capacitor`) | `capacitor://localhost` |
| Android/iOS en mode http | `http://localhost` |

Détails de la configuration mobile : `quincaillerie-frontend/MOBILE.md`.

## 3. Créer l'URL publique de l'API (Render)

1. Pousser le dépôt complet (avec `render.yaml` à la racine) sur GitHub.
2. Render → **New → Blueprint** → sélectionner le dépôt. Render crée le service
   `skys-erp-solution-api`.
3. Renseigner `MONGODB_URI` (valeur secrète) puis attendre l'état **Live**.
4. Vérifier `GET /` : la réponse JSON de bienvenue confirme que l'API est publique.
5. Le service gratuit Render s'endort après inactivité : la première requête peut prendre
   ~30 s. Le frontend tolère ce délai grâce à l'intercepteur de messages.

> URL publique en service : **`https://gestion-de-stock-ae8a.onrender.com`**

## 4. Brancher le frontend sur l'API publique

1. GitHub → **Settings → Secrets and variables → Actions → Variables** :
   créer `REACT_APP_API_URL` = `https://gestion-de-stock-ae8a.onrender.com` (sans slash final).
2. GitHub → **Settings → Pages → Build and deployment → Source** : choisir **GitHub Actions**
   (sans cette étape, le workflow `deploy-frontend.yml` est ignoré).
3. Lancer **Actions → Deploy frontend to GitHub Pages → Run workflow**.
4. L'URL `https://souley123.github.io/quincaillerie-frontend/` sert alors le site connecté à l'API.

## 5. Sécurité en place

- Mots de passe hachés en PBKDF2-SHA512 (120 000 itérations, sel aléatoire) — jamais stockés en clair.
- Jetons JWT signés HS256 portant le `companyId` ; toute lecture/écriture est filtrée par
  `companyId` (isolation multi-tenant).
- Verrouillage du compte après 5 échecs pendant 15 minutes.
- Limitation de débit : 100 requêtes / 15 min par IP, 10 / 15 min sur l'authentification.
- En-têtes `helmet` : `X-Content-Type-Options`, `X-Frame-Options`, HSTS, etc.
- CORS en liste blanche d'origines ; messages d'erreur internes non exposés.
- Arrêt propre sur `SIGTERM`/`SIGINT` (redéploiements Render sans coupure de connexion Mongo).

## 6. Vérifications rapides

```powershell
# 1. Santé de l'API publique
curl.exe -sS https://gestion-de-stock-ae8a.onrender.com/

# 2. Prévol CORS depuis l'origine du site
curl.exe -sS -i -X OPTIONS https://gestion-de-stock-ae8a.onrender.com/api/auth/login `
  -H "Origin: https://souley123.github.io" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type"
```

La prévol doit répondre `204` avec `Access-Control-Allow-Origin: https://souley123.github.io`.
