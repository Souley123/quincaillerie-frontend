import axios from 'axios';
import { apiUrl, apiProductionNonConfiguree } from './apiUrl';
import { avecRepriseLecture } from './reseau';

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
  timeout: 20000,
  // Ces appels métier ne dépendent pas de cookies intersites.
  withCredentials: false
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

  return config;
});

/*
 * Filtre de sécurité sur les messages d'erreur destinés à l'utilisateur.
 * Certains messages renvoyés par le serveur (notamment lors d'un échec de
 * connexion) mentionnent explicitement « le serveur », voire « la protection
 * du compte est gérée par le serveur ». Ce vocabulaire technique ne doit
 * jamais apparaître dans l'interface : on le remplace par un message neutre.
 */
const TEXTE_ERREUR_NEUTRE = 'Identifiants incorrects. Vérifiez votre adresse email et votre mot de passe.';
const VOCABULAIRE_SERVEUR = /(protection\s+du\s+compte|g[ée]r[ée]e?\s+par\s+le\s+serveur|tentative\s+[ée]chou[ée]e)/i;
const nettoyerMessageServeur = message => {
  if (typeof message !== 'string') return message;
  return VOCABULAIRE_SERVEUR.test(message) ? TEXTE_ERREUR_NEUTRE : message;
};

/* Erreurs déjà traduites en français, exploitables par l'interface. */
export const messageErreur = erreur => {
  const code = erreur?.response?.status;
  const message = nettoyerMessageServeur(erreur?.response?.data?.error);

  if (code === 401) return message || 'Session expirée ou identifiants incorrects.';
  if (code === 402) return message || 'Abonnement inactif : merci de régulariser votre situation.';
  if (code === 423) return message || 'Compte temporairement verrouillé.';
  if (code === 403) return message || 'Accès refusé : votre rôle ne permet pas cette opération.';
  // 429 = les requêtes sont temporairement limitées (quota dépassé).
  // Sans ce cas dédié, l'interface affichait un trompeur « connexion impossible »
  // qui accusait la connexion Internet alors que le serveur répondait très bien.
  if (code === 429) {
    const attente = Number(erreur?.response?.headers?.['retry-after']);
    const minutes = Number.isFinite(attente) && attente > 0 ? Math.ceil(attente / 60) : 15;
    return message
      || `Trop de tentatives en peu de temps. Patientez environ ${minutes} minute(s) puis réessayez.`;
  }
  // 5xx = le serveur a bien été joint mais n'a pas pu traiter la demande.
  if (code >= 500) {
    return message
      || 'Le serveur a rencontré un problème. Patientez un instant puis réessayez.';
  }
  if (!erreur?.response) {
    if (erreur?.message && !erreur?.config) return erreur.message;

    /* Requête bloquée par le navigateur (CORS, contenu mixte, service worker)
       ou par la WebView : « Failed to fetch » / « NetworkError ». Le serveur
       n'a jamais répondu. On le dit, car « vérifiez votre connexion Internet »
       était faux quand la page était bien en ligne. */
    if (/failed to fetch|networkerror|load failed/i.test(erreur?.message || '')) {
      return 'Le serveur n\'a pas pu être joint. Patientez un instant puis réessayez ; si le problème persiste, vérifiez l\'adresse du serveur.';
    }

    // Cas spécifiques au mobile (Android/iOS) : réseau indisponible, délai
    // dépassé, ou requête bloquée par la WebView.
    if (erreur?.code === 'ECONNABORTED' || /timeout/i.test(erreur?.message || '')) {
      return 'Le serveur met du temps à démarrer (jusqu\'à 1 minute la première fois). Patientez puis réessayez.';
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Aucune connexion Internet. Activez le Wi-Fi ou les données mobiles pour continuer.';
    }
    /* Diagnostic technique (console uniquement, jamais montré à l'utilisateur) :
       permet de savoir en une seconde si la requête est partie vers la bonne
       adresse — un build resté sur « localhost » produit exactement ce cas. */
    if (typeof console !== 'undefined' && erreur?.config?.baseURL) {
      console.error(
        `[SKYS] Aucune réponse de l'API (${erreur.config.baseURL}${erreur.config.url || ''}). `
        + 'Vérifiez que le backend est joignable et que l\'URL REACT_APP_API_URL est correcte.'
      );
    }
    // Aucune adresse technique n'est jamais exposée à l'utilisateur.
    return 'Connexion impossible. Vérifiez votre connexion Internet puis réessayez.';
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
    // 402 sur une requête authentifiée = essai/abonnement expiré : le serveur
    // a coupé l'accès. On prévient l'interface pour afficher l'écran de blocage
    // sans laisser l'utilisateur devant des erreurs éparpillées.
    if (erreur?.response?.status === 402 && lireJeton()) {
      window.dispatchEvent(new CustomEvent('skys:abonnement-expire', {
        detail: { message: erreur.response?.data?.error || '' }
      }));
    }
    // 403 avec code EMAIL_NON_VERIFIE = l'adresse e-mail n'est pas confirmée :
    // le serveur refuse l'accès à l'ERP. On prévient l'interface pour afficher
    // l'écran/bandeau de vérification au lieu d'une erreur brute.
    if (erreur?.response?.status === 403
        && erreur.response?.data?.code === 'EMAIL_NON_VERIFIE') {
      window.dispatchEvent(new CustomEvent('skys:email-non-verifie', {
        detail: { message: erreur.response?.data?.error || '' }
      }));
    }
    return Promise.reject(erreur);
  }
);

// API GET résiliente : seules les lectures idempotentes sont retentées.
const getAvecReprise = (url, config) =>
  avecRepriseLecture(() => api.get(url, config));

/* POST résilient réservé aux pannes de transport (cold start Render).
   avecRepriseLecture ne rejoue QUE l'absence de réponse ou un 502/503/504,
   et rejette immédiatement tout refus réel (401, 429, 4xx) — donc la
   connexion invalide n'est jamais retentée ni comptée en double.

   Le délai est porté à 60 s pour absorber le réveil du serveur Render
   (cold start mesuré à ~33 s) : avec les 20 s par défaut, la connexion
   échouait sans réponse et l'interface affichait un « Connexion
   impossible » trompeur. */
const postResilientSansReponse = (url, donnees) =>
  avecRepriseLecture(() => api.post(url, donnees, { timeout: 60000 }),
    { tentativesMax: 2, delaiInitialMs: 1500 });

/* ---------- Authentification ---------- */

export const connexion = (email, motDePasse, slug = '') =>
  postResilientSansReponse('/api/auth/login', { email, motDePasse, slug }).then(r => r.data);

export const inscriptionEntreprise = donnees =>
  api.post('/api/auth/inscription', donnees).then(r => r.data);

export const moi = () => getAvecReprise('/api/auth/moi').then(r => r.data);

export const listerUtilisateursApi = () => getAvecReprise('/api/auth/utilisateurs').then(r => r.data);

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

/** Confirme l'adresse e-mail à partir du jeton reçu par mail. */
export const verifierEmailApi = (email, jeton) =>
  api.post('/api/auth/verifier-email', { email, jeton }).then(r => r.data);

/** Renvoie l'e-mail de vérification (réponse neutre côté serveur). */
export const renvoyerVerificationEmailApi = email =>
  api.post('/api/auth/renvoyer-verification', { email }).then(r => r.data);

export const demanderReinitialisationPortailClientApi = (slug, email) =>
  api.post('/api/client-portal/mot-de-passe/oublie', { slug, email });

export const confirmerReinitialisationMotDePasseApi = (email, jeton, motDePasse) =>
  api.post('/api/auth/mot-de-passe/reinitialiser', { email, jeton, motDePasse }).then(r => r.data);

export const confirmerReinitialisationPortailClientApi = donnees =>
  api.post('/api/client-portal/mot-de-passe/reinitialiser', donnees).then(r => r.data);

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

export const listerMouvements = (params = {}) => getAvecReprise('/api/mouvements', { params }).then(r => r.data);

export const bougerStock = (id, donnees) =>
  api.post(`/api/products/${id}/stock`, donnees).then(r => r.data);

export const inventorierProduit = (id, stockPhysique) =>
  api.post(`/api/products/${id}/inventaire`, { stockPhysique }).then(r => r.data);

export const supprimerProduit = id => api.delete(`/api/products/${id}`).then(r => r.data);

export const annulerVente = id => api.post(`/api/ventes/${id}/annuler`).then(r => r.data);

/* ---------- Catalogue ---------- */

export const listerProduits = (params = {}) => getAvecReprise('/api/products', { params }).then(r => r.data);

export const creerProduit = donnees => api.post('/api/products', donnees).then(r => r.data);

export const modifierProduit = (id, donnees) => api.put(`/api/products/${id}`, donnees).then(r => r.data);

export const rechercherProduitParCode = code =>
  getAvecReprise(`/api/products/code/${encodeURIComponent(code)}`).then(r => r.data);

/* ---------- Clients ---------- */

export const listerClients = (params = {}) => getAvecReprise('/api/clients', { params }).then(r => r.data);

/* ---------- Ventes ---------- */

export const listerVentes = (params = {}) => getAvecReprise('/api/ventes', { params }).then(r => r.data);

export const enregistrerVente = donnees => {
  const { idempotencyKey, ...corps } = donnees || {};
  return api.post('/api/ventes', corps, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
  }).then(r => ({ ok: true, resultat: r.data })).catch(erreur => ({
    ok: false,
    erreur: messageErreur(erreur)
  }));
};

export const statistiquesVentes = periode =>
  getAvecReprise(`/api/ventes/stats/${periode}`).then(r => r.data);

/* ---------- Fournisseurs & réapprovisionnement ---------- */

export const listerFournisseurs = () => getAvecReprise('/api/fournisseurs').then(r => r.data);

export const alertesReappro = () => getAvecReprise('/api/fournisseurs/alertes/reappro').then(r => r.data);

export const commanderFournisseur = (id, donnees) =>
  api.post(`/api/fournisseurs/${id}/commander`, donnees).then(r => r.data);

/* ---------- Bons de commande (Achats) ---------- */

export const listerCommandes = (params = {}) =>
  getAvecReprise('/api/commandes', { params }).then(r => r.data);

export const creerCommande = donnees => api.post('/api/commandes', donnees).then(r => r.data);

export const modifierCommande = (id, donnees) =>
  api.put(`/api/commandes/${id}`, donnees).then(r => r.data);

export const changerStatutCommande = (id, statut) =>
  api.patch(`/api/commandes/${id}/statut`, { statut }).then(r => r.data);

export const supprimerCommande = id => api.delete(`/api/commandes/${id}`).then(r => r.data);

/* ---------- Transport & Logistique ---------- */

export const listerTransports = (params = {}) => getAvecReprise('/api/transports', { params }).then(r => r.data);

export const creerTransport = donnees => api.post('/api/transports', donnees).then(r => r.data);

export const modifierTransport = (id, donnees) =>
  api.put(`/api/transports/${id}`, donnees).then(r => r.data);

export const supprimerTransport = id => api.delete(`/api/transports/${id}`).then(r => r.data);

/* ---------- Dépenses & Charges ---------- */

export const listerDepenses = (params = {}) => getAvecReprise('/api/depenses', { params }).then(r => r.data);

export const creerDepense = donnees => api.post('/api/depenses', donnees).then(r => r.data);

export const modifierDepense = (id, donnees) =>
  api.put(`/api/depenses/${id}`, donnees).then(r => r.data);

export const supprimerDepense = id => api.delete(`/api/depenses/${id}`).then(r => r.data);

/* ---------- Abonnements ---------- */

export const listerAbonnements = (params = {}) => getAvecReprise('/api/abonnements', { params }).then(r => r.data);

export const abonnementActif = () => getAvecReprise('/api/abonnements/actif').then(r => r.data);

export const souscrireAbonnement = ({ idempotencyKey, ...donnees }) =>
  api.post('/api/abonnements', donnees, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
  }).then(r => ({ ok: true, resultat: r.data })).catch(erreur => ({
    ok: false,
    erreur: messageErreur(erreur)
  }));

export const configPaiementPubliqueApi = () => getAvecReprise('/api/paiements/config').then(r => r.data);

/* ---------- Paiements en ligne (vérification serveur) ---------- */

/**
 * Demande au SERVEUR de vérifier une transaction Kkiapay. Le frontend ne
 * peut jamais marquer un paiement comme réglé : seule cette réponse fait foi.
 * @param {string} transactionId  référence renvoyée par le widget
 * @param {'vente'|'abonnement'} nature
 * @param {{venteId?:string, palier?:string}} options
 */
export const verifierPaiementApi = (transactionId, nature, options = {}) =>
  api
    .post('/api/paiements/verifier', { transactionId, nature, ...options }, {
      // Anti-rejeu : la même clé ne peut être traitée deux fois.
      headers: { 'Idempotency-Key': `${nature}-${transactionId}` }
    })
    .then(r => r.data);

/** Configuration publique des paiements (clé d'abonnement, prix officiels). */
export const configPaiementApi = () => getAvecReprise('/api/paiements/config').then(r => r.data);

/** Historique des paiements de l'entreprise. */
export const listerPaiementsApi = () => getAvecReprise('/api/paiements').then(r => r.data);

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