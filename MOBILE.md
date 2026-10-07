# Applications mobiles Android & iOS — SKYS ERP Solution

Le frontend React est empaqueté pour le mobile avec **Capacitor 8**. Le WebView charge
le build statique (`build/`) et appelle le backend public.

> **URL publique du backend :** `https://gestion-de-stock-ae8a.onrender.com`

## 1. Comment l'URL de l'API est résolue

La résolution est centralisée dans `src/services/apiUrl.js` (une seule source de vérité,
utilisée par `services/api.js` et `App.js`) :

| Contexte | URL utilisée |
| --- | --- |
| Variable `REACT_APP_API_URL` définie | cette valeur (sans slash final) |
| Web local (`npm start`) | `http://localhost:5001` |
| **Application native Android/iOS** | `https://gestion-de-stock-ae8a.onrender.com` |
| Web en production sans variable | même origine que la page |

Les apps natives ne tombent **jamais** sur `localhost:5001` : elles utilisent toujours
l'API publique en HTTPS.

## 2. Configuration Capacitor

Fichier `capacitor.config.json` à la racine du frontend :

- `appId` : `com.skys.erpsolution`
- `appName` : `SKYS ERP Solution`
- `webDir` : `build`
- `server.androidScheme` / `server.iosScheme` : `https`
- `allowNavigation` : autorise le domaine de l'API et GitHub Pages.

## 3. CORS côté backend

Le WebView natif envoie une origine interne, désormais **autorisée** dans `server.js` :

| Plateforme | Origine envoyée |
| --- | --- |
| Android (`androidScheme: https`) | `https://localhost` |
| iOS (`iosScheme: capacitor`) | `capacitor://localhost` |
| iOS/Android en mode http | `http://localhost` |

Ces origines sont fixes et internes ; elles sont gérées par la constante
`ORIGINES_NATIVES` dans `server.js` (en plus de `CORS_ORIGINS`).

## 4. Préparer les projets natifs

À exécuter depuis `quincaillerie-frontend/` :

```powershell
# Une seule fois : générer les projets natifs
npm run cap:add:android
npm run cap:add:ios        # macOS uniquement (nécessite Xcode)

# À chaque modification du code web : rebuild + copie vers les projets natifs
npm run cap:sync

# Ouvrir l'IDE natif
npm run cap:android        # build + sync + ouvre Android Studio
npm run cap:ios            # build + sync + ouvre Xcode (macOS)
```

> iOS requiert macOS et Xcode. Android fonctionne sur Windows, macOS et Linux.

## 5. Points de sécurité mobile

- **HTTPS obligatoire** : l'intercepteur de `api.js` vérifie que l'URL de l'API est en
  HTTPS en production (le test porte sur l'URL cible, pas sur la page WebView).
- **Pas de contenu mixte** : `android.allowMixedContent = false` dans `capacitor.config.json`.
- **CORS strict** : les apps natives sont autorisées explicitement, tout le reste reste
  filtré par `CORS_ORIGINS`.
- **Jeton** : stocké via `localStorage` (comme sur le web) ; l'authentification utilise
  `Authorization: Bearer`, jamais de cookie intersite.

## 6. Vérification rapide

```powershell
# Le backend répond bien aux origines natives (prévol CORS)
curl.exe -sS -i -X OPTIONS https://gestion-de-stock-ae8a.onrender.com/api/auth/login `
  -H "Origin: https://localhost" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type"
```

La réponse doit être `204` avec `Access-Control-Allow-Origin: https://localhost`.