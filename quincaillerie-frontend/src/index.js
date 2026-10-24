import React from 'react';
import ReactDOM from 'react-dom/client';
import Clarity from '@microsoft/clarity';
import './index.css';
import App from './App';
import PagePaiement from './components/PagePaiement';
import PageReinitialisation from './components/PageReinitialisation';
import PageReinitialisationPortailClient from './components/PageReinitialisationPortailClient';
import reportWebVitals from './reportWebVitals';
import { activerProtectionCode } from './services/protectionCode';
import { afficherAlerteInspection } from './components/AlerteInspection';

/* Protection dissuasive contre l'inspection : active en production.
   Le navigateur ne permet pas de rendre le code client inaccessible.
   (Voir services/protectionCode.js pour les limites de ce mécanisme.) */
activerProtectionCode({
  onIntrusion: raison => {
    console.warn('[SKYS ERP] Action restreinte :', raison);
    afficherAlerteInspection();
  }
});

/**
 * Routage minimal (pas de react-router dans le projet).
 *
 * /paiement                         -> page publique de paiement
 * /mot-de-passe/reinitialiser       -> réinitialisation du compte ERP
 * /client/mot-de-passe/reinitialiser -> réinitialisation du portail client
 * Les mêmes routes fonctionnent avec le préfixe GitHub Pages du dépôt.
 * tout else                         -> application SKYS ERP Solution
 *
 * Le pathname est teste avant le rendu pour que la page de paiement ne passe
 * jamais par le garde de session d'App.
 */
const ROUTE_PAIEMENT = '/paiement';
const PREFIXE_GITHUB_PAGES = '/quincaillerie-frontend';
const parametresUrl = new URLSearchParams(window.location.search);
const routeDemandee = parametresUrl.get('__route') ||
  (window.location.pathname.startsWith(PREFIXE_GITHUB_PAGES) ? null : window.location.pathname);
const routeDepuisLienAncien = [
  '/mot-de-passe/reinitialiser',
  '/client/mot-de-passe/reinitialiser',
  '/paiement'
].includes(routeDemandee) ? routeDemandee : null;
const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
const routeCourante = routeDepuisLienAncien || (pathname.startsWith(`${PREFIXE_GITHUB_PAGES}/`)
  ? pathname.slice(PREFIXE_GITHUB_PAGES.length) || '/'
  : pathname === PREFIXE_GITHUB_PAGES
    ? '/'
    : pathname);
const baseConnexion = pathname.startsWith(PREFIXE_GITHUB_PAGES)
  ? PREFIXE_GITHUB_PAGES
  : '';

document.documentElement.dataset.appBase = baseConnexion;
window.__SKYS_APP_BASE__ = baseConnexion;

const estRoutePaiement = routeCourante === ROUTE_PAIEMENT;
const estRouteReinitialisationPortailClient = routeCourante === '/client/mot-de-passe/reinitialiser';
const estRouteReinitialisation = estRouteReinitialisationPortailClient || routeCourante === '/mot-de-passe/reinitialiser';
const estRouteAncienneLien = Boolean(routeDepuisLienAncien && parametresUrl.has('__route'));

if (estRouteAncienneLien) {
  parametresUrl.delete('__route');
  const urlNettoyee = new URL(window.location.href);
  urlNettoyee.search = parametresUrl.toString();
  window.history.replaceState({}, '', urlNettoyee.toString());
}
if (estRouteReinitialisation) {
  const referrer = document.createElement('meta');
  referrer.name = 'referrer';
  referrer.content = 'no-referrer';
  document.head.appendChild(referrer);
}

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
