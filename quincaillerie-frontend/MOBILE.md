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

> **État :** le projet **Android a déjà été généré** (`quincaillerie-frontend/android/`).
> Le projet iOS n'existe pas encore (macOS/Xcode requis).

À exécuter depuis `quincaillerie-frontend/` :

```powershell
# Une seule fois : générer les projets natifs
npm run cap:add:android     # déjà fait : le dossier android/ existe
npm run cap:add:ios         # macOS uniquement (nécessite Xcode)

# À chaque modification du code web : rebuild + copie vers les projets natifs
npm run cap:sync

# Ouvrir l'IDE natif
npm run cap:android        # build + sync + ouvre Android Studio
npm run cap:ios            # build + sync + ouvre Xcode (macOS)
```

> iOS requiert macOS et Xcode. Android fonctionne sur Windows, macOS et Linux.

### Compiler l'APK Android

La compilation exige **Android Studio** (qui embarque le JDK) et le **SDK Android**.
Sans eux, `cap:add:android` et `cap:sync` fonctionnent, mais aucun APK ne peut être produit.

1. Installer Android Studio : https://developer.android.com/studio
2. L'ouvrir une fois pour télécharger le SDK Android.
3. Lancer `npm run cap:android` puis, dans Android Studio, **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

## 5. Interface adaptée au mobile (responsive)

L'ERP utilise une barre latérale fixe sur ordinateur et un **menu en tiroir
(drawer)** sur mobile, défini dans `src/index.css`.

- **Seuil :** `@media (max-width: 768px)`.
- Au-dessus de 768px : la barre latérale reste visible en permanence (260px).
- En dessous : elle est masquée (`transform: translateX(-100%)`) et s'ouvre
  via le **bouton hamburger** (`☰`, classe `.app-menu-toggle`) de l'en-tête.
- Un **voile sombre** (`.app-sidebar-overlay`) assombrit le contenu ; un clic
  dessus referme le menu.
- Le menu se referme aussi automatiquement après le choix d'un module.
- Un bouton `✕` (`.app-sidebar-close`) est disponible en haut du tiroir.

L'état d'ouverture est géré par le state React `menuMobileOuvert` (dans `App.js`).

### Largeurs fluides

Les conteneurs et formulaires (dont la page de connexion) évitent les largeurs
fixes en pixels et utilisent :

```css
width: 100%;
max-width: 400px;
box-sizing: border-box;
padding: 0 16px;
```

La carte de connexion reste dans les marges (16px de chaque côté) dès 320px de
largeur, sans débordement horizontal.

## 6. Points de sécurité mobile

- **HTTPS obligatoire** : l'intercepteur de `api.js` vérifie que l'URL de l'API est en
  HTTPS en production (le test porte sur l'URL cible, pas sur la page WebView).
- **Pas de contenu mixte** : `android.allowMixedContent = false` dans `capacitor.config.json`.
- **CORS strict** : les apps natives sont autorisées explicitement, tout le reste reste
  filtré par `CORS_ORIGINS`.
- **Jeton** : stocké via `localStorage` (comme sur le web) ; l'authentification utilise
  `Authorization: Bearer`, jamais de cookie intersite.

## 7. Vérification rapide

```powershell
# Le backend répond bien aux origines natives (prévol CORS)
curl.exe -sS -i -X OPTIONS https://gestion-de-stock-ae8a.onrender.com/api/auth/login `
  -H "Origin: https://localhost" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type"
```

La réponse doit être `204` avec `Access-Control-Allow-Origin: https://localhost`.