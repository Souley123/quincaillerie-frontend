/**
 * CLIENT DE TUNNEL — RÉSEAUX NATIONAUX ET INTERNATIONAUX
 * ------------------------------------------------------------
 * Adapte chaque requête à la qualité du réseau de l'utilisateur et
 * reprend automatiquement après une coupure.
 *
 *   Tunnel national (Côte d'Ivoire, UEMOA) : réseau mobile instable →
 *   plus de tentatives, délais courts, reprise agressive.
 *
 *   Tunnel international : latence élevée mais réseau stable →
 *   moins de tentatives, attente plus longue.
 *
 * Le numéro de tentative est transmis au serveur (X-Tentative) pour que
 * la journalisation distingue une vraie erreur d'une coupure réseau.
 */

/* Pays rattachés au tunnel national (mêmes codes que le serveur). */
const PAYS_NATIONAL = ['CI', 'SN', 'BF', 'ML', 'NE', 'TG', 'BJ', 'GN', 'GW', 'LR', 'GH', 'NG'];

/* Politiques de reprise, alignées sur le serveur. */
const POLITIQUES = {
  national: { tentativesMax: 5, delaiInitialMs: 250, delaiMaxMs: 2000 },
  international: { tentativesMax: 3, delaiInitialMs: 500, delaiMaxMs: 4000 },
  direct: { tentativesMax: 2, delaiInitialMs: 100, delaiMaxMs: 800 }
};

/* Couleur/taille d'écran : un petit écran suggère une connexion mobile. */
const sembleMobile = () => {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|mobile/i.test(navigator.userAgent || '');
};

/** Devine le tunnel adapté à l'appareil, sans appel réseau. */
export const devinerTunnel = () => {
  try {
    if (typeof navigator === 'undefined') return 'international';

    // 1. Pays fourni par le navigateur (rare mais fiable si présent).
    const langue = (navigator.language || '').toUpperCase(); // ex. "FR-CI"
    const codePays = langue.split('-')[1];
    if (codePays && PAYS_NATIONAL.includes(codePays)) return 'national';

    // 2. Fuseau horaire : celui d'Abidjan = GMT, sans décalage.
    const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/abidjan|accra|lome|cotonou|ouagadougou|bamako|dakar|niamey|conakry/i.test(fuseau)) {
      return 'national';
    }

    // 3. Réseau lent : le tunnel national est plus tolérant.
    const connexion = navigator.connection;
    if (connexion && ['slow-2g', '2g', '3g'].includes(connexion.effectiveType)) {
      return 'national';
    }

    // 4. Application mobile native : très souvent en réseau mobile.
    if (sembleMobile()) return 'national';

    return 'international';
  } catch {
    return 'international';
  }
};

/** Tunnel courant mis en cache (évite de recalculer à chaque requête). */
let tunnelCourant = null;

export const getTunnel = () => {
  if (!tunnelCourant) tunnelCourant = devinerTunnel();
  return tunnelCourant;
};

/** Force un tunnel (utile si l'utilisateur signale un réseau lent). */
export const setTunnel = nom => {
  if (POLITIQUES[nom]) tunnelCourant = nom;
};

/** En-têtes à joindre à chaque requête pour informer le serveur. */
export const entetesTunnel = () => {
  const tunnel = getTunnel();
  const entetes = { 'X-Tunnel': tunnel };

  try {
    const typeReseau = navigator?.connection?.effectiveType;
    if (typeReseau) entetes['X-Network-Type'] = typeReseau;
  } catch {
    /* API absente : en-tête simplement omis. */
  }
  return entetes;
};

/**
 * Calcule l'attente avant nouvelle tentative (backoff exponentiel + jitter).
 * @param {number} tentative  numéro de la tentative échouée (1, 2, 3…)
 * @param {boolean} enLigne
 */
export const calculerAttente = (tentative, enLigne = true) => {
  const politique = POLITIQUES[getTunnel()] || POLITIQUES.international;

  // Hors ligne : on n'abandonne pas, on attend que le réseau revienne.
  if (!enLigne) return { attendre: 3000, abandonner: false, horsLigne: true };

  if (tentative >= politique.tentativesMax) {
    return { attendre: 0, abandonner: true, horsLigne: false };
  }

  const base = Math.min(politique.delaiMaxMs, politique.delaiInitialMs * 2 ** (tentative - 1));
  const jitter = Math.round(base * 0.2 * Math.random());
  return { attendre: base + jitter, abandonner: false, horsLigne: false };
};

/**
 * Exécute une opération réseau avec reprise automatique.
 * @param {Function} operation  doit renvoyer une Promise
 * @param {object} options
 * @param {Function} options.onNouvelleTentative  (numeroTentative, attenteMs)
 * @returns {Promise<*>} le résultat de l'opération
 */
export const avecReprise = async (operation, { onNouvelleTentative = () => {} } = {}) => {
  let tentative = 0;

  for (;;) {
    try {
      return await operation(tentative);
    } catch (erreur) {
      const statut = erreur?.response?.status;

      // Une erreur métier (401, 400, 403…) ne doit PAS être rejouée :
      // seule une panne réseau mérite une nouvelle tentative.
      if (statut && statut < 500) throw erreur;

      tentative += 1;
      const enLigne = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
      const { attendre, abandonner } = calculerAttente(tentative, enLigne);

      if (abandonner) throw erreur;

      onNouvelleTentative(tentative, attendre);
      await new Promise(resoudre => setTimeout(resoudre, attendre));
    }
  }
};

const tunnel = {
  devinerTunnel,
  getTunnel,
  setTunnel,
  entetesTunnel,
  calculerAttente,
  avecReprise
};

export default tunnel;
