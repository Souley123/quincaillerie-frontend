import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import PagePaiement from './components/PagePaiement';
import PageReinitialisation from './components/PageReinitialisation';
import PageReinitialisationPortailClient from './components/PageReinitialisationPortailClient';
import reportWebVitals from './reportWebVitals';
import { activerProtectionCode } from './services/protectionCode';

/* Protection du code : bloque les raccourcis d'inspection et le clic droit
   en production. Chaque tentative est remontée à l'écran d'alerte.
   (Voir services/protectionCode.js pour les limites de ce mécanisme.) */
activerProtectionCode({
  onIntrusion: raison => {
    // Message discret, non bloquant : dissuade sans casser l'usage normal.
    console.warn('[SKYS ERP] Action restreinte :', raison);
  }
});

/**
 * Routage minimal (pas de react-router dans le projet).
 *
 * /paiement                         -> page publique de paiement
 * /mot-de-passe/reinitialiser       -> réinitialisation du compte ERP
 * /client/mot-de-passe/reinitialiser -> réinitialisation du portail client
 * tout else                         -> application SKYS ERP Solution
 *
 * Le pathname est teste avant le rendu pour que la page de paiement ne passe
 * jamais par le garde de session d'App.
 */
const ROUTE_PAIEMENT = '/paiement';
const routeCourante = window.location.pathname.replace(/\/+$/, '').replace(/^\/quincaillerie-frontend(?=\/|$)/, '') || '/';

const estRoutePaiement = routeCourante === ROUTE_PAIEMENT;
const estRouteReinitialisationPortailClient = routeCourante === '/client/mot-de-passe/reinitialiser';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {estRoutePaiement ? <PagePaiement /> : estRouteReinitialisationPortailClient ? <PageReinitialisationPortailClient /> : routeCourante === '/mot-de-passe/reinitialiser' ? <PageReinitialisation /> : <App />}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
