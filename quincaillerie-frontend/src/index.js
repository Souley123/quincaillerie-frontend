import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import PagePaiement from './components/PagePaiement';
import PageReinitialisation from './components/PageReinitialisation';
import reportWebVitals from './reportWebVitals';

/**
 * Routage minimal (pas de react-router dans le projet).
 *
 * /paiement  -> page publique, accessible SANS session ERP
 * tout else  -> application SKYS ERP Solution
 *
 * Le pathname est teste avant le rendu pour que la page de paiement ne passe
 * jamais par le garde de session d'App.
 */
const ROUTE_PAIEMENT = '/paiement';
const routeCourante = window.location.pathname.replace(/\/+$/, '').replace(/^\/quincaillerie-frontend(?=\/|$)/, '') || '/';

const estRoutePaiement = routeCourante === ROUTE_PAIEMENT;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {estRoutePaiement ? <PagePaiement /> : routeCourante === '/mot-de-passe/reinitialiser' ? <PageReinitialisation /> : <App />}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
