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
 *   4. Web en production sans variable : même origine que la page
 */

/* URL publique du backend, utilisée en production et par les apps natives. */
export const API_PUBLIQUE = 'https://gestion-de-stock-ae8a.onrender.com';

/* Hôtes de développement local : seul le web les utilise. */
const HOTES_LOCAUX = ['localhost', '127.0.0.1'];
const API_LOCALE = 'http://localhost:5001';

const estApplicationNative = () => {
  try {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const resoudreApiUrl = () => {
  const configuree = process.env.REACT_APP_API_URL?.trim();
  if (configuree) return configuree.replace(/\/$/, '');

  // Application Android / iOS : jamais de localhost, toujours l'API publique.
  if (estApplicationNative()) return API_PUBLIQUE;

  // Web local (npm start) : backend de développement.
  const hote =
    typeof window !== 'undefined' ? window.location.hostname : '';
  if (HOTES_LOCAUX.includes(hote)) return API_LOCALE;

  // Web en production sans variable : même origine que la page.
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return API_PUBLIQUE;
};

export const apiUrl = resoudreApiUrl();

/* En production (web ou natif), l'URL publique doit être explicitement résolue. */
export const apiProductionNonConfiguree =
  process.env.NODE_ENV === 'production' &&
  !process.env.REACT_APP_API_URL?.trim() &&
  !estApplicationNative() &&
  typeof window !== 'undefined' &&
  !HOTES_LOCAUX.includes(window.location.hostname);