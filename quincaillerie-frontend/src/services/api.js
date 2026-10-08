import axios from 'axios';
import { apiUrl, apiProductionNonConfiguree } from './apiUrl';
import { entetesTunnel } from './tunnel';

/**
 * CLIENT API SKYS ERP Solution
 * ------------------------------------------------------------
 * Point d'entrée unique vers le backend. L'intercepteur de
 * requête injecte le jeton de session (sous-domaine de
 * l'entreprise), et l'intercepteur de réponse déconnecte
 * automatiquement l'utilisateur si la session a expiré.
 */

export const CLE_JETON = 'skys_erp_jeton';
export const CLE_ENTREPRISE = 'skys_erp_entreprise';

/* Sur Android/iOS, le stockage du navigateur (WebView) peut être vidé par le
   système en cas de manque de mémoire. On double donc chaque écriture d'un
   miroir en mémoire, afin que la session survive à une purge silencieuse
   dans la même session applicative. */
let memoireJeton = null;
let memoireEntreprise = null;

export const lireJeton = () => {
  try {
    return localStorage.getItem(CLE_JETON) || memoireJeton || null;
  } catch {
    return memoireJeton || null;
  }
};

export const lireEntreprise = () => {
  try {
    const valeur = localStorage.getItem(CLE_ENTREPRISE);
    if (valeur) return JSON.parse(valeur);
  } catch {
    /* Stockage vidé ou corrompu : on utilise le miroir mémoire. */
  }
  return memoireEntreprise || null;
};

export const enregistrerSession = (jeton, utilisateur, entreprise) => {
  // Stockage d'accès temporaire pour compatibilité; il n'est pas une frontière
  // de confiance et toutes les permissions restent revérifiées côté serveur.
  memoireJeton = jeton || null;
  memoireEntreprise = { utilisateur, entreprise };
  try {
    localStorage.setItem(CLE_JETON, jeton);
    localStorage.setItem(CLE_ENTREPRISE, JSON.stringify({ utilisateur, entreprise }));
  } catch {
    // Stockage indisponible : le miroir mémoire prend le relais.
  }
};

export const effacerSession = () => {
  memoireJeton = null;
  memoireEntreprise = null;
  try {
    localStorage.removeItem(CLE_JETON);
    localStorage.removeItem(CLE_ENTREPRISE);
    localStorage.removeItem('erp_auth');
    localStorage.removeItem('erp_role');
  } catch {
    /* Rien à nettoyer si le stockage est inaccessible. */
  }
};

const api = axios.create({
  baseURL: apiUrl,
  headers: { 'Content-Type': 'application/json' },
  // L'authentification utilise Authorization: Bearer, pas un cookie intersite.
  // Ne pas demander de credentials CORS : l'API publique n'en autorise pas.
  timeout: 15000
});

api.interceptors.request.use(config => {
  if (apiProductionNonConfiguree) {
    return Promise.reject(new Error('REACT_APP_API_URL doit pointer vers le backend public.'));
  }

  const jeton = lireJeton();
  // En production, l'API cible doit être en HTTPS (données métier).
  // On teste l'URL de l'API, pas la page : sur mobile Capacitor la page
  // peut être servie en https://localhost sans que l'API le soit.
  if (process.env.NODE_ENV === 'production' && !/^https:/i.test(apiUrl)) {
    return Promise.reject(new Error('La connexion HTTPS est obligatoire pour accéder aux données métier.'));
  }
  if (jeton) config.headers.Authorization = `Bearer ${jeton}`;

  /* Tunnels national / international : informe le serveur du type de
     réseau et du tunnel attendu, pour qu'il adapte sa politique de
     reprise (réseau mobile ivoirien vs liaison internationale). */
  Object.assign(config.headers, entetesTunnel());

  return config;
});

/* Erreurs déjà traduites en français, exploitables par l'interface. */
export const messageErreur = erreur => {
  const code = erreur?.response?.status;
  const message = erreur?.response?.data?.error;

  if (code === 401) return message || 'Session expirée ou identifiants incorrects.';
  if (code === 402) return message || 'Abonnement inactif : merci de régulariser votre situation.';
  if (code === 423) return message || 'Compte temporairement verrouillé.';
  if (code === 403) return message || 'Accès refusé : votre rôle ne permet pas cette opération.';
  if (!erreur?.response) {
    if (erreur?.message && !erreur?.config) return erreur.message;

    // Cas spécifiques au mobile (Android/iOS) : réseau indisponible, délai
    // dépassé, ou requête bloquée par la WebView.
    if (erreur?.code === 'ECONNABORTED' || /timeout/i.test(erreur?.message || '')) {
      return 'Le serveur met trop de temps à répondre. Vérifiez votre réseau (Wi-Fi ou données mobiles) puis réessayez.';
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Aucune connexion Internet. Activez le Wi-Fi ou les données mobiles pour continuer.';
    }
    const urlApi = erreur?.config?.baseURL || apiUrl;
    return `Connexion au serveur impossible (${urlApi}). Vérifiez votre connexion Internet puis réessayez.`;
  }
  return message || 'Une erreur est survenue. Réessayez.';
};

api.interceptors.response.use(
  reponse => reponse,
  erreur => {
    // 401 sur une requête authentifiée = session morte : on nettoie.
    if (erreur?.response?.status === 401 && lireJeton()) {
      effacerSession();
      window.dispatchEvent(new CustomEvent('skys:session-expiree'));
    }
    return Promise.reject(erreur);
  }
);

/* ---------- Authentification ---------- */

export const connexion = (email, motDePasse, slug = '') =>
  api.post('/api/auth/login', { email, motDePasse, slug }).then(r => r.data);

export const inscriptionEntreprise = donnees =>
  api.post('/api/auth/inscription', donnees).then(r => r.data);

export const moi = () => api.get('/api/auth/moi').then(r => r.data);

export const listerUtilisateursApi = () => api.get('/api/auth/utilisateurs').then(r => r.data);

export const creerUtilisateurApi = donnees =>
  api.post('/api/auth/utilisateurs', donnees).then(r => r.data);

export const supprimerUtilisateurApi = id =>
  api.delete(`/api/auth/utilisateurs/${id}`).then(r => r.data);

/**
 * Débloque un compte bloqué après trop de réinitialisations de mot de passe,
 * ou maintient le blocage (decision: 'laisser'). Réservé à l'administrateur.
 */
export const debloquerUtilisateurApi = (id, decision = 'debloquer') =>
  api.post(`/api/auth/utilisateurs/${id}/debloquer`, { decision }).then(r => r.data);

export const demanderReinitialisationMotDePasseApi = email =>
  api.post('/api/auth/mot-de-passe/oublie', { email });

export const confirmerReinitialisationMotDePasseApi = (email, jeton, motDePasse) =>
  api.post('/api/auth/mot-de-passe/reinitialiser', { email, jeton, motDePasse });

/**
 * Change le mot de passe de l'utilisateur connecté (notamment le mot de passe
 * temporaire imposé à la première connexion).
 */
export const changerMotDePasseApi = (ancienMotDePasse, nouveauMotDePasse) =>
  api.post('/api/auth/mot-de-passe/changer', { ancienMotDePasse, nouveauMotDePasse }).then(r => r.data);

/* ---------- Clients (écriture) ---------- */

export const creerClient = donnees => api.post('/api/clients', donnees).then(r => r.data);

export const modifierClient = (id, donnees) => api.put(`/api/clients/${id}`, donnees).then(r => r.data);

export const supprimerClient = id => api.delete(`/api/clients/${id}`).then(r => r.data);

/* ---------- Fournisseurs (écriture) ---------- */

export const creerFournisseur = donnees => api.post('/api/fournisseurs', donnees).then(r => r.data);

export const modifierFournisseur = (id, donnees) =>
  api.put(`/api/fournisseurs/${id}`, donnees).then(r => r.data);

export const supprimerFournisseur = id => api.delete(`/api/fournisseurs/${id}`).then(r => r.data);

/* ---------- Mouvements de stock ---------- */

export const listerMouvements = (params = {}) => api.get('/api/mouvements', { params }).then(r => r.data);

export const bougerStock = (id, donnees) =>
  api.post(`/api/products/${id}/stock`, donnees).then(r => r.data);

export const inventorierProduit = (id, stockPhysique) =>
  api.post(`/api/products/${id}/inventaire`, { stockPhysique }).then(r => r.data);

export const supprimerProduit = id => api.delete(`/api/products/${id}`).then(r => r.data);

export const annulerVente = id => api.post(`/api/ventes/${id}/annuler`).then(r => r.data);

/* ---------- Catalogue ---------- */

export const listerProduits = (params = {}) => api.get('/api/products', { params }).then(r => r.data);

export const creerProduit = donnees => api.post('/api/products', donnees).then(r => r.data);

export const modifierProduit = (id, donnees) => api.put(`/api/products/${id}`, donnees).then(r => r.data);

export const rechercherProduitParCode = code =>
  api.get(`/api/products/code/${encodeURIComponent(code)}`).then(r => r.data);

/* ---------- Clients ---------- */

export const listerClients = (params = {}) => api.get('/api/clients', { params }).then(r => r.data);

/* ---------- Ventes ---------- */

export const listerVentes = (params = {}) => api.get('/api/ventes', { params }).then(r => r.data);

export const enregistrerVente = donnees => api.post('/api/ventes', donnees).then(r => r.data);

export const statistiquesVentes = periode =>
  api.get(`/api/ventes/stats/${periode}`).then(r => r.data);

/* ---------- Fournisseurs & réapprovisionnement ---------- */

export const listerFournisseurs = () => api.get('/api/fournisseurs').then(r => r.data);

export const alertesReappro = () => api.get('/api/fournisseurs/alertes/reappro').then(r => r.data);

export const commanderFournisseur = (id, donnees) =>
  api.post(`/api/fournisseurs/${id}/commander`, donnees).then(r => r.data);

/* ---------- Transport & Logistique ---------- */

export const listerTransports = (params = {}) => api.get('/api/transports', { params }).then(r => r.data);

export const creerTransport = donnees => api.post('/api/transports', donnees).then(r => r.data);

export const modifierTransport = (id, donnees) =>
  api.put(`/api/transports/${id}`, donnees).then(r => r.data);

export const supprimerTransport = id => api.delete(`/api/transports/${id}`).then(r => r.data);

/* ---------- Dépenses & Charges ---------- */

export const listerDepenses = (params = {}) => api.get('/api/depenses', { params }).then(r => r.data);

export const creerDepense = donnees => api.post('/api/depenses', donnees).then(r => r.data);

export const modifierDepense = (id, donnees) =>
  api.put(`/api/depenses/${id}`, donnees).then(r => r.data);

export const supprimerDepense = id => api.delete(`/api/depenses/${id}`).then(r => r.data);

/* ---------- Abonnements ---------- */

export const listerAbonnements = (params = {}) => api.get('/api/abonnements', { params }).then(r => r.data);

export const abonnementActif = () => api.get('/api/abonnements/actif').then(r => r.data);

export const souscrireAbonnement = donnees => api.post('/api/abonnements', donnees).then(r => r.data);

/* ---------- Paiements en ligne (vérification serveur) ---------- */

/**
 * Demande au SERVEUR de vérifier une transaction Kkiapay. Le frontend ne
 * peut jamais marquer un paiement comme réglé : seule cette réponse fait foi.
 * @param {string} transactionId  référence renvoyée par le widget
 * @param {'vente'|'abonnement'} nature
 * @param {{montantAttendu?:number, palier?:string}} options
 */
export const verifierPaiementApi = (transactionId, nature, options = {}) =>
  api
    .post('/api/paiements/verifier', { transactionId, nature, ...options }, {
      // Anti-rejeu : la même clé ne peut être traitée deux fois.
      headers: { 'Idempotency-Key': `${nature}-${transactionId}` }
    })
    .then(r => r.data);

/** Configuration publique des paiements (clé d'abonnement, prix officiels). */
export const configPaiementApi = () => api.get('/api/paiements/config').then(r => r.data);

/** Historique des paiements de l'entreprise. */
export const listerPaiementsApi = () => api.get('/api/paiements').then(r => r.data);

/* ---------- Sécurité (alerte administrateur) ---------- */

/**
 * Signale un incident de sécurité au backend, qui journalise l'événement
 * et notifie l'administrateur (email / WhatsApp configurés côté serveur).
 * imageData est une capture caméra encodée en data URL (base64).
 */
export const alerterSecurite = (detail, { userEmail = '', level = 'Moyen', imageData = null } = {}) =>
  api
    .post('/api/security/alert', { detail, userEmail, level, imageData })
    .then(r => r.data);

export default api;