# Héberger SKYS ERP sur AWS
La solution proposée utilise **AWS Amplify Hosting** pour le frontend React et **Amazon ECR + AWS App Runner** pour le backend Node.js en conteneur. MongoDB reste sur MongoDB Atlas : aucune base ni donnée métier n'est déplacée par ce déploiement.

> Je ne peux pas créer les services dans votre compte AWS sans accès à ce compte. Ce dépôt contient la configuration ; suivez les étapes ci-dessous dans AWS. Ne publiez jamais les secrets AWS, MongoDB, JWT, paiement ou e-mail dans GitHub.

## 1. Publier le frontend avec Amplify Hosting
1. Poussez le dépôt complet sur GitHub.
2. Dans AWS Console, ouvrez **AWS Amplify → Create new app → GitHub**, autorisez l'accès au dépôt et sélectionnez la branche à déployer.
3. Pour ce monorepo, définissez `AMPLIFY_MONOREPO_APP_ROOT` à `quincaillerie-frontend` dans les variables d'environnement de l'application Amplify.
4. Amplify détecte le fichier `amplify.yml` à la racine. Le build produit le dossier `quincaillerie-frontend/dist` et sert le site à la racine du domaine Amplify.
5. Une fois le domaine `https://…amplifyapp.com` attribué, notez cette origine (sans chemin).

Le fichier `quincaillerie-frontend/amplify.yml` bâtit Vite avec `VITE_BASE_PATH=/`, nécessaire pour ne pas garder le sous-chemin de GitHub Pages. Après création de l'API (étape 2), définissez également `VITE_API_URL` dans **Amplify → App settings → Environment variables** à l'URL HTTPS d'App Runner, sans slash final, puis relancez un build.

## 2. Construire et publier l'API dans ECR
Dans AWS Console, créez un dépôt privé dans **Amazon ECR** (par exemple `skys-erp-api`) dans la région souhaitée. Dans **View push commands**, suivez les commandes AWS pour vous authentifier, puis depuis PowerShell, dans `quicaillerie-backend`, construisez et poussez l'image (remplacez le compte, la région et le dépôt par les valeurs AWS fournies) :

```powershell
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin COMPTE.dkr.ecr.REGION.amazonaws.com
docker build -t skys-erp-api .
docker tag skys-erp-api:latest COMPTE.dkr.ecr.REGION.amazonaws.com/skys-erp-api:latest
docker push COMPTE.dkr.ecr.REGION.amazonaws.com/skys-erp-api:latest
```

Le `Dockerfile` du backend utilise Node.js 22 et `npm ci --omit=dev`. Le `.dockerignore` exclut les fichiers `.env` et les secrets de l'image.

## 3. Créer le service AWS App Runner
1. Dans **AWS App Runner → Create service**, sélectionnez **Container registry → Amazon ECR**, choisissez l'image `skys-erp-api:latest` et le déploiement manuel ou automatique.
2. Configurez le port du conteneur à `5001` (le backend écoute `process.env.PORT`, sinon 5001) et une vérification de santé `HTTP /health`.
3. Dans les variables d'environnement du service, renseignez `NODE_ENV=production`, `CORS_ORIGINS` (voir étape 4), `APP_URL` (domaine Amplify complet), `SWAGGER_ACTIF=false`, et les variables de configuration applicatives nécessaires. Au minimum : `MONGODB_URI`, `JWT_SECRET` (au moins 32 caractères aléatoires), `CORS_ORIGINS`, `APP_URL`.
4. Placez les secrets (`MONGODB_URI`, `JWT_SECRET`, clés Kkiapay, Brevo/SMTP) dans **AWS Secrets Manager** et référencez-les dans App Runner plutôt que de les saisir en clair. Ne partagez pas leurs valeurs.
5. Créez le service et attendez l'état **Running**. Récupérez son URL HTTPS, puis vérifiez `https://URL-APPRUNNER/health` (la réponse doit signaler que l'API est prête et que MongoDB est connecté).

Configurez aussi les variables fonctionnelles dont votre instance a besoin, par exemple Kkiapay, le fournisseur d'e-mail (`BREVO_API_KEY` ou les variables `SMTP_*`), `ADMIN_EMAIL` et les variables de démonstration. Reprenez les descriptions de `quicaillerie-backend/.env.example` et `quicaillerie-backend/DEPLOIEMENT.md`. Gardez Swagger désactivé en production.

## 4. Relier les domaines et la base
1. Dans App Runner, définissez `CORS_ORIGINS` à l'origine Amplify exacte, par exemple `https://main.xxxxx.amplifyapp.com` (pas de slash final ni de chemin).
2. Définissez `APP_URL` à l'URL complète du site, par exemple `https://main.xxxxx.amplifyapp.com`.
3. Dans Amplify, définissez `VITE_API_URL` à l'URL HTTPS App Runner. Relancez le build.
4. Dans MongoDB Atlas, autorisez l'accès réseau depuis AWS. Pour une règle IP stable, configurez App Runner avec un **VPC Connector** et un **NAT Gateway avec adresse IP élastique**, puis autorisez uniquement cette IP dans Atlas. N'ouvrez pas Atlas à `0.0.0.0/0` en production.
5. Si vous utilisez un domaine personnalisé, ajoutez son origine à `CORS_ORIGINS`, mettez `APP_URL` à jour, et relancez le frontend/backend selon la variable modifiée.

## 5. Mises à jour et contrôle
Pour publier une version backend : reconstruisez l'image, poussez-la dans ECR, puis déployez cette image dans App Runner (ou activez le déploiement automatique ECR). Pour le frontend, un push sur la branche connectée déclenche Amplify.

Après chaque publication, vérifiez `/health`, l'ouverture du site, la connexion à l'API et l'envoi d'un e-mail de réinitialisation. Le fichier `PageReinitialisation.js` ne nécessite pas de modification spécifique AWS : le jeton et l'e-mail restent traités par le frontend et l'API HTTPS.
