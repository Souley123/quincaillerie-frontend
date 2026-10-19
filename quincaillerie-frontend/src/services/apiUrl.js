import { Capacitor } from '@capacitor/core';

/**
 * RÉSOLUTION DE L'URL DU BACKEND (WEB + ANDROID + IOS)
 * ------------------------------------------------------------
 * Une seule source de vérité pour l'adresse de l'API, afin que le
 * site web, l'application Android et l'application iOS pointent
 * toujours vers le backend public en production.
 *
 * Priorité :
 *   1. REACT_APP_API_URL (injectée au build par la CI / le .env)
 *   2. Sur le web en développement : http://localhost:5001
 *   3. Application native (Capacitor) : URL publique du backend
 *   4. Web en production sans variable : API Render publique explicite
 */

/* URL publique du backend, utilisée en production et par les apps natives.
   Service Render réellement en ligne : « gestion-de-stocks-5lv3 ».
   (« gestion-de-stock-ae8a » renvoie 503 et « skys-erp-api » 404 : ne PAS les utiliser.) */
export const API_PUBLIQUE = 'https://gestion-de-stocks-5lv3.onrender.com';

/* Hôtes de développement local : seul le web les utilise. */
const HOTES_LOCAUX = ['localhost', '127.0.0.1'];
const API_LOCALE = 'http://localhost:5001';
const ORIGINES_PRODUCTION = ['https://souley123.github.io'];

const validerUrlConfiguree = (valeur, autoriserHttpLocal) => {
  try {
    const url = new URL(valeur);
    const protocoleSecurise = url.protocol === 'https:' || (autoriserHttpLocal && url.protocol === 'http:' && HOTES_LOCAUX.includes(url.hostname));
    if (!protocoleSecurise || url.username || url.password) return '';
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch {
    return '';
  }
};

const estApplicationNative = () => {
  try {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const resoudreApiUrl = () => {
  const configuree = (import.meta.env.VITE_API_URL || process.env.REACT_APP_API_URL || '').trim();
  if (configuree) {
    const hoteCourant = typeof window !== 'undefined' ? window.location.hostname : '';
    const urlSecurisee = validerUrlConfiguree(configuree, HOTES_LOCAUX.includes(hoteCourant));
    if (urlSecurisee) return urlSecurisee;
    console.error('[SKYS] URL d’API ignorée : une URL HTTPS valide est requise hors développement local.');
  }

  // Application Android / iOS : jamais de localhost, toujours l'API publique.
  if (estApplicationNative()) return API_PUBLIQUE;

  // Web local : npm start démarre l'API locale si sa base de données est prête.
  const hote =
    typeof window !== 'undefined' ? window.location.hostname : '';
  if (HOTES_LOCAUX.includes(hote)) return API_LOCALE;

  /* Web sur un hôte déployé ou de prévisualisation : utilise l'API publique.
     GitHub Pages et les previews statiques n'hébergent pas le backend. */
  return API_PUBLIQUE;
};

export const apiUrl = resoudreApiUrl();

/* En production, l'URL de l'API est TOUJOURS résolue (variable explicite ou
   API publique par défaut). On ne bloque donc plus les requêtes : bloquer
   rendait la connexion impossible sur GitHub Pages. */
export const apiProductionNonConfiguree = false;