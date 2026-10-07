# Configuration de l’API publique
Le site GitHub Pages est statique : il ne peut pas héberger le backend Node.js. Le backend doit être déployé séparément et disposer d’une URL HTTPS publique.

> Doc détaillée côté backend : `quicaillerie-backend/DEPLOIEMENT.md` (sécurité, variables, CORS, création de l’URL Render).

## Déployer l’API sur Render
1. Ce dossier de projet ne contient pas de remote Git configuré : poussez d’abord le dépôt complet vers GitHub avec `render.yaml` à sa racine.
2. Dans Render, choisissez **New → Blueprint** et sélectionnez ce dépôt. Render lit `render.yaml` et crée le service `skys-erp-solution-api`.
3. Dans les variables du service Render, renseignez `MONGODB_URI` avec l’URI MongoDB Atlas réelle. Vérifiez aussi dans Atlas que les connexions depuis Render sont autorisées.
4. Attendez que le service soit « Live », puis copiez l’URL HTTPS attribuée par Render. Ouvrez son URL racine (`/`) : la réponse doit être un JSON de bienvenue. L’adresse affichée par Render est le véritable URL public ; il ne faut pas utiliser l’exemple de nom comme s’il était déjà actif.

## Connecter le frontend
L'URL publique du backend en service est **`https://gestion-de-stock-ae8a.onrender.com`**. Renseignez-la comme `REACT_APP_API_URL` (sans slash final) :

- **Vercel** : dans les paramètres du projet frontend, définissez `REACT_APP_API_URL`, puis redéployez.
- **GitHub Pages** : définissez la variable de dépôt `REACT_APP_API_URL` sous **Settings → Secrets and variables → Actions → Variables**, activez **Settings → Pages → GitHub Actions**, puis lancez `Deploy frontend to GitHub Pages`. L’URL est intégrée au bundle frontend au moment du build.

> Le workflow `deploy-frontend.yml` contient un repli vers `https://gestion-de-stock-ae8a.onrender.com` : le build fonctionne même si la variable de dépôt n’est pas définie.

Ne mettez jamais `MONGODB_URI` ni `JWT_SECRET` dans le frontend ou dans une variable publique GitHub Actions. Ces secrets restent dans les variables d’environnement privées de Render.

En développement local, le frontend utilise `http://localhost:5001` par défaut. Le backend local a besoin d’un fichier `.env` avec `MONGODB_URI` et `JWT_SECRET` et doit tourner sur le port 5001.
