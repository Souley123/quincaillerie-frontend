# Configuration de l’API publique
Le site GitHub Pages est statique : il ne peut pas héberger le backend Node.js. Le backend doit être déployé séparément et disposer d’une URL HTTPS publique.

## Déployer l’API sur Render
1. Ce dossier de projet ne contient pas de remote Git configuré : poussez d’abord le dépôt complet vers GitHub avec `render.yaml` à sa racine.
2. Dans Render, choisissez **New → Blueprint** et sélectionnez ce dépôt. Render lit `render.yaml` et crée le service `skys-erp-solution-api`.
3. Dans les variables du service Render, renseignez `MONGODB_URI` avec l’URI MongoDB Atlas réelle. Vérifiez aussi dans Atlas que les connexions depuis Render sont autorisées.
4. Attendez que le service soit « Live », puis copiez l’URL HTTPS attribuée par Render. Ouvrez son URL racine (`/`) : la réponse doit être un JSON de bienvenue. L’adresse affichée par Render est le véritable URL public ; il ne faut pas utiliser l’exemple de nom comme s’il était déjà actif.

## Connecter le frontend
Dans GitHub → **Settings → Secrets and variables → Actions → Variables**, créez la variable `REACT_APP_API_URL` avec l’URL HTTPS attribuée au service Render (sans slash final). Activez GitHub Pages via **Settings → Pages → GitHub Actions**, poussez les changements et relancez le workflow `Deploy frontend to GitHub Pages`. L’URL est intégrée au bundle frontend au moment du build.

Ne mettez jamais `MONGODB_URI` ni `JWT_SECRET` dans le frontend ou dans une variable publique GitHub Actions. Ces secrets restent dans les variables d’environnement privées de Render.

En développement local, le frontend utilise `http://localhost:5001` par défaut. Le backend local a besoin d’un fichier `.env` avec `MONGODB_URI` et `JWT_SECRET` et doit tourner sur le port 5001.
