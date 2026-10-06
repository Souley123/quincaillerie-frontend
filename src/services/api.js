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
  localStorage.setItem(CLE_JETON, jeton);
  localStorage.setItem(CLE_ENTREPRISE, JSON.stringify({ utilisateur, entreprise }));
  // Renseigne aussi les clés historiques utilisées par l'interface.
  localStorage.setItem('erp_auth', 'true');
  if (utilisateur?.role) localStorage.setItem('erp_role', utilisateur.role);
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
const apiUrl = apiUrlConfiguree || (
  process.env.NODE_ENV === 'development' || hoteLocal
    ? apiUrlLocale
    : window.location.origin
);
const apiProductionNonConfiguree =
  process.env.NODE_ENV === 'production' && !apiUrlConfiguree && !hoteLocal;

const api = axios.create({
  baseURL: apiUrl.replace(/\/$/, ''),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

api.interceptors.request.use(config => {
  if (apiProductionNonConfiguree) {
    return Promise.reject(new Error('REACT_APP_API_URL doit pointer vers le backend public.'));
  }

  const jeton = lireJeton();
  if (jeton) config.headers.Authorization = `Bearer ${jeton}`;
  return config;
});

/* Erreurs déjà traduites en français, exploitables par l'interface. */
export const messageErreur = erreur => {
  if (apiProductionNonConfiguree) {
    return 'API non configurée pour ce site. Définissez REACT_APP_API_URL avec l’URL HTTPS publique du backend puis redéployez.';
  }

  const code = erreur?.response?.status;
  const message = erreur?.response?.data?.error;

  if (code === 401) return message || 'Session expirée ou identifiants incorrects.';
  if (code === 402) return message || 'Abonnement inactif : merci de régulariser votre situation.';
  if (code === 423) return message || 'Compte temporairement verrouillé.';
  if (code === 403) return message || 'Accès refusé : votre rôle ne permet pas cette opération.';
  if (!erreur?.response) {
    const urlApi = erreur?.config?.baseURL || apiUrl;
    const configurationManquante = !apiUrlConfiguree && urlApi !== apiUrlLocale;
    if (configurationManquante) {
      return 'API non configurée pour ce site. Définissez REACT_APP_API_URL avec l’URL HTTPS publique du backend puis redéployez.';
    }
    return `Serveur API injoignable (${urlApi}). Vérifiez que le backend est démarré et que cette URL est accessible.`;
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