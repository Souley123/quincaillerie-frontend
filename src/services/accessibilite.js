/**
 * ACCESSIBILITÉ — SKYS ERP Solution
 * ------------------------------------------------------------
 * Adapte l'application aux personnes en situation de handicap :
 *
 *  • Malvoyants / aveugles
 *      - annonces vocales via l'API SpeechSynthesis (lecture des messages) ;
 *      - zones ARIA « live » pour les lecteurs d'écran (NVDA, JAWS, VoiceOver) ;
 *      - mode contraste élevé et agrandissement du texte ;
 *      - navigation clavier (focus visible).
 *
 *  • Sourds / malentendants
 *      - alertes visuelles (bandeau + vibration si disponible) à la place
 *        des seuls signaux sonores ;
 *      - retour visuel explicite pour chaque action importante.
 *
 * Aucune dépendance externe : tout s'appuie sur les API du navigateur.
 */

const CLE_PREFS = 'erp_accessibilite';

export const PREFS_PAR_DEFAUT = {
  contrasteEleve: false,
  texteAgrandi: false,
  annoncesVocales: false,
  alertesVisuelles: true,
  soulignerLiens: false
};

/** Lit les préférences d'accessibilité enregistrées. */
export const lirePreferences = () => {
  try {
    const brut = localStorage.getItem(CLE_PREFS);
    if (!brut) return { ...PREFS_PAR_DEFAUT };
    return { ...PREFS_PAR_DEFAUT, ...JSON.parse(brut) };
  } catch {
    return { ...PREFS_PAR_DEFAUT };
  }
};

/** Enregistre les préférences d'accessibilité. */
export const enregistrerPreferences = prefs => {
  try {
    localStorage.setItem(CLE_PREFS, JSON.stringify(prefs));
  } catch {
    /* Stockage indisponible : l'application continue sans persistance. */
  }
};

/**
 * Annonce un message aux technologies d'assistance.
 * - Toujours : écrit dans une zone ARIA live (lecteur d'écran).
 * - Si `annoncesVocales` : prononcé par la synthèse vocale.
 */
export const annoncer = (message, { priorite = 'polite', parler = false } = {}) => {
  if (typeof document === 'undefined' || !message) return;

  let zone = document.getElementById('skys-aria-live');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'skys-aria-live';
    zone.setAttribute('aria-live', priorite);
    zone.setAttribute('aria-atomic', 'true');
    // Visuellement masqué mais lisible par les lecteurs d'écran.
    zone.style.position = 'absolute';
    zone.style.width = '1px';
    zone.style.height = '1px';
    zone.style.overflow = 'hidden';
    zone.style.clip = 'rect(0 0 0 0)';
    zone.style.whiteSpace = 'nowrap';
    document.body.appendChild(zone);
  }
  zone.setAttribute('aria-live', priorite);
  zone.textContent = '';
  // Un léger délai garantit que le lecteur d'écran relit le message.
  window.setTimeout(() => { zone.textContent = message; }, 50);

  if (parler && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(message);
      utterance.lang = 'fr-FR';
      window.speechSynthesis.speak(utterance);
    } catch {
      /* Synthèse vocale indisponible : l'annonce ARIA reste active. */
    }
  }
};

/**
 * Alerte visuelle + vibration pour les personnes sourdes/malentendantes.
 * Retourne une fonction de fermeture. Aucun son n'est émis.
 */
export const alerteVisuelle = (message, { dureeMs = 6000 } = {}) => {
  if (typeof document === 'undefined') return () => {};

  let bandeau = document.getElementById('skys-alerte-visuelle');
  if (!bandeau) {
    bandeau = document.createElement('div');
    bandeau.id = 'skys-alerte-visuelle';
    bandeau.setAttribute('role', 'alert');
    bandeau.setAttribute('aria-live', 'assertive');
    Object.assign(bandeau.style, {
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '10000',
      maxWidth: 'calc(100vw - 32px)',
      padding: '14px 20px',
      borderRadius: '10px',
      backgroundColor: '#b45309',
      color: '#fff',
      fontWeight: 'bold',
      fontSize: '15px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      border: '3px solid #fbbf24'
    });
    document.body.appendChild(bandeau);
  }

  bandeau.textContent = message;
  bandeau.style.display = 'block';

  // Vibration : signal tactile pour les personnes sourdes (si supportée).
  if (navigator.vibrate) {
    try { navigator.vibrate([120, 80, 120]); } catch { /* ignoré */ }
  }

  const fermer = () => { if (bandeau) bandeau.style.display = 'none'; };
  window.setTimeout(fermer, dureeMs);
  return fermer;
};

/**
 * Applique les préférences au document (contrastes, taille, focus, liens).
 */
export const appliquerPreferences = prefs => {
  if (typeof document === 'undefined') return;
  const racine = document.documentElement;

  racine.classList.toggle('a11y-contraste', Boolean(prefs.contrasteEleve));
  racine.classList.toggle('a11y-texte-agrandi', Boolean(prefs.texteAgrandi));
  racine.classList.toggle('a11y-souligner-liens', Boolean(prefs.soulignerLiens));
};

const accessibilite = {
  lirePreferences,
  enregistrerPreferences,
  annoncer,
  alerteVisuelle,
  appliquerPreferences,
  PREFS_PAR_DEFAUT
};

export default accessibilite;
