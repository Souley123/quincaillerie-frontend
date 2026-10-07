import axios from 'axios';

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

export const lireJeton = () => localStorage.getItem(CLE_JETON) || null;

export const lireEntreprise = () => {
  try {
    return JSON.parse(localStorage.getItem(CLE_ENTREPRISE) || 'null');
  } catch {
    return null;
  }
};

export const enregistrerSession = (jeton, utilisateur, entreprise) => {
  // Stockage d'accès temporaire pour compatibilité; il n'est pas une frontière
  // de confiance et toutes les permissions restent revérifiées côté serveur.
  localStorage.setItem(CLE_JETON, jeton);
  localStorage.setItem(CLE_ENTREPRISE, JSON.stringify({ utilisateur, entreprise }));
};

export const effacerSession = () => {
  localStorage.removeItem(CLE_JETON);
  localStorage.removeItem(CLE_ENTREPRISE);
  localStorage.removeItem('erp_auth');
  localStorage.removeItem('erp_role');
};

const apiUrlConfiguree = process.env.REACT_APP_API_URL?.trim();
const apiUrlLocale = 'http://localhost:5001';
const hoteLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const apiUrl = apiUrlConfiguree || (hoteLocal ? apiUrlLocale : '');
const apiProductionNonConfiguree = process.env.NODE_ENV === 'production' && !apiUrlConfiguree;

const api = axios.create({
  baseURL: (apiUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, ''),
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
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && window.location.protocol !== 'https:') {
    return Promise.reject(new Error('La connexion HTTPS est obligatoire pour accéder aux données métier.'));
  }
  if (jeton) config.headers.Authorization = `Bearer ${jeton}`;
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
    const urlApi = erreur?.config?.baseURL || apiUrl;
    return `Connexion à l’API impossible (${urlApi}). Vérifiez l’accès réseau et la configuration CORS du backend.`;
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

export const demanderReinitialisationMotDePasseApi = email =>
  api.post('/api/auth/mot-de-passe/oublie', { email });

export const confirmerReinitialisationMotDePasseApi = (email, jeton, motDePasse) =>
  api.post('/api/auth/mot-de-passe/reinitialiser', { email, jeton, motDePasse });

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

export default api;