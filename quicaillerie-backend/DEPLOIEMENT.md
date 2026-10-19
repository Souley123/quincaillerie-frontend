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
| `BREVO_API_KEY` | recommandée sur Render | Envoi d'e-mails par HTTPS (port 443), préférable aux ports SMTP sortants. |
| `SMTP_*`, `ADMIN_EMAIL` | non | Envoi local ou SMTP sur hébergement autorisant le SMTP. |
| `DIAG_TOKEN` | recommandée | Jeton aléatoire pour le diagnostic privé `/diagnostic-email`; aucun secret de messagerie n'est retourné. |
| `WHATSAPP_*` | non | Alertes WhatsApp via Meta Cloud API. |

> Les secrets ne doivent JAMAIS être placés dans le frontend ni dans une variable publique GitHub Actions.

### 1bis. Configuration SMTP (envoi d'e-mails) sur Render
Le backend peut envoyer les messages directement par SMTP avec `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` et `SMTP_FROM`. Pour Gmail, utilisez `smtp.gmail.com`,
le port `587` avec `SMTP_SECURE=false`, et un mot de passe d'application Google (pas le mot de passe
normal du compte). `SMTP_FROM` doit utiliser l'adresse authentifiée par SMTP.

**Attention à l'hébergement :** Render bloque le SMTP sortant sur son offre gratuite. Dans ce cas,
la configuration SMTP, même correcte, ne peut pas envoyer depuis ce service. Il faut utiliser un
hébergeur/plan qui autorise le SMTP sortant ou changer de fournisseur/canal. Le code rejette alors
la demande au lieu d'afficher une réussite trompeuse. Ne configurez `BREVO_API_KEY` que si vous
choisissez effectivement Brevo comme fournisseur.

Pour diagnostiquer le canal SMTP sans exposer les secrets, ajouter `DIAG_TOKEN` (valeur aléatoire)
dans Render → **Environment**, puis sauvegarder et redéployer. Créer aussi `DIAG_EMAIL_TEST_TO`
avec l'adresse de réception que vous contrôlez. Dans PowerShell, depuis `quicaillerie-backend`,
créer un fichier local ignoré par Git nommé `.env.diagnostic` contenant `DIAG_TOKEN=<même valeur>`.

```powershell
Set-Content .env.diagnostic "DIAG_TOKEN=COLLEZ_ICI_LA_MEME_VALEUR"
node -r dotenv/config scripts/diagnostic-email.mjs dotenv_config_path=.env.diagnostic
```

Le script vérifie la connexion SMTP puis, si elle réussit, envoie un seul message de test. `envoye: true`
signifie que le serveur SMTP a accepté le message, pas qu'il est arrivé dans la boîte. Vérifiez la
boîte de réception, le dossier spam et les journaux disponibles chez votre hébergeur/serveur SMTP.
Ne transmettez jamais la valeur de `DIAG_TOKEN` et ne l'ajoutez pas au dépôt.

Si le plan Render utilisé autorise SMTP et que vous choisissez ce mode, renseigner :

| Variable | Valeur à utiliser |
| --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `supportskys@gmail.com` |
| `SMTP_PASSWORD` | *mot de passe d'application Gmail* (16 caractères, à regénérer périodiquement) |
| `SMTP_FROM` | `supportskys@gmail.com` |
| `ADMIN_EMAIL` | `supportskys@gmail.com` |

> **Trois points critiques** :
> 1. Le mot de passe d'application Gmail appartient au compte **`supportskys@gmail.com`**.
>    Il ne fonctionne PAS sur un autre compte (erreur SMTP 535 « identifiants refusés »).
> 2. Le port `587` utilise STARTTLS : `SMTP_SECURE` doit valoir `false` (le code déduit
>    `secure` du port si `SMTP_SECURE` est absent, et lit `PORT_USER` en secours de `SMTP_PORT`).
> 3. La disponibilité des ports SMTP dépend du plan et du réseau Render. Sur le plan gratuit, le
>    SMTP sortant est bloqué : il faut un plan ou un hébergeur autorisant le SMTP.

> Le mot de passe d'application Gmail est un **secret** : il ne se commite jamais dans le dépôt
> ni dans le frontend. Il se saisit uniquement dans le tableau de bord Render (et dans le
> `.env` local, non versionné). Toute modification de ce mot de passe doit être reportée dans Render.

### Supprimer les comptes non-administrateurs
Pour supprimer définitivement les comptes Caissier/Magasinier (y compris les comptes inactifs),
conserver tous les comptes dont le rôle est exactement `Administrateur`, et les déconnecter :

```powershell
$env:MONGODB_URI = 'URI MongoDB de production (à garder secrète)'
npm run comptes:supprimer-non-admin -- SUPPRIMER-TOUS-SAUF-ADMIN
Remove-Item Env:MONGODB_URI
```

Cette action supprime les documents des utilisateurs non-administrateurs dans la collection `utilisateurs`.
Elle ne supprime pas les données métier de l'entreprise. Les sessions des administrateurs conservés sont
invalidées; ils devront se reconnecter. La commande exige la confirmation exacte et ne doit pas être
automatisée. Vérifier l'URI de base avant exécution et faire une sauvegarde MongoDB préalable.

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
   **`gestion-de-stocks-5lv3`** (nom défini dans `render.yaml`).
3. Renseigner `MONGODB_URI` (valeur secrète) puis attendre l'état **Live**.
4. Vérifier `GET /` : la réponse JSON de bienvenue confirme que l'API est publique.
5. Le service gratuit Render s'endort après inactivité : la première requête peut prendre
   ~30 s. Le frontend tolère ce délai grâce à l'intercepteur de messages.

> ⚠️ Le nom du service Render doit correspondre **exactement** à celui de
> `render.yaml` (`gestion-de-stocks-5lv3`). Sinon Render crée un **second** service
> au lieu de mettre à jour celui qui sert l'API — c'est la cause de l'épisode
> « backend obsolète ». Détail : `CREER-NOUVEAU-SERVICE-RENDER.md`.
>
> URL publique en service : **`https://gestion-de-stocks-5lv3.onrender.com`**

## 4. Brancher le frontend sur l'API publique

1. GitHub → **Settings → Secrets and variables → Actions → Variables** :
   créer `REACT_APP_API_URL` = `https://gestion-de-stocks-5lv3.onrender.com` (sans slash final).
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
curl.exe -sS https://gestion-de-stocks-5lv3.onrender.com/

# 2. Prévol CORS depuis l'origine du site
curl.exe -sS -i -X OPTIONS https://gestion-de-stocks-5lv3.onrender.com/api/auth/login `
  -H "Origin: https://souley123.github.io" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type"
```

La prévol doit répondre `204` avec `Access-Control-Allow-Origin: https://souley123.github.io`.
