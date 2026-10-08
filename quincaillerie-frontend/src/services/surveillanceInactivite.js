/**
 * SURVEILLANCE D'INACTIVITÉ
 * ------------------------------------------------------------
 * Détecte l'absence d'activité de l'utilisateur (souris, clavier,
 * tactile, molette, changement d'onglet) et prévient avant le
 * verrouillage automatique de la session.
 *
 * Deux paliers :
 *   - `avertir` : prévient l'utilisateur qu'il va être verrouillé ;
 *   - `verrouiller` : la session est fermée, retour à la connexion.
 *
 * Le minuteur est réarmé à chaque interaction et reste actif tant que
 * l'onglet reçoit des évènements, même en arrière-plan.
 */

const EVENEMENTS_ACTIVITE = [
  'mousemove',
  'mousedown',
  'click',
  'keydown',
  'scroll',
  'touchstart',
  'touchmove',
  'wheel',
  'pointerdown',
  'pointermove'
];

/**
 * Démarre la surveillance d'inactivité.
 * @param {object} options
 * @param {number} options.dureeMaxMs  délai total avant verrouillage
 * @param {number} options.delaiAlerteMs délai avant l'avertissement
 * @param {Function} options.onAvertir  appelé quand l'avertissement débute
 * @param {Function} options.onVerrouiller appelé au verrouillage
 * @param {Function} options.onActif    appelé à la reprise d'activité
 * @returns {Function} fonction d'arrêt de la surveillance
 */
export const demarrerSurveillanceInactivite = ({
  dureeMaxMs,
  delaiAlerteMs,
  onAvertir = () => {},
  onVerrouiller = () => {},
  onActif = () => {}
} = {}) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  let derniereActivite = Date.now();
  let alerteDeclenchee = false;
  let verrouille = false;
  let minuteurAlerte = null;
  let minuteurVerrou = null;

  const planifier = () => {
    window.clearTimeout(minuteurAlerte);
    window.clearTimeout(minuteurVerrou);

    const restantAlert = Math.max(0, delaiAlerteMs - (Date.now() - derniereActivite));
    const restantVerrou = Math.max(0, dureeMaxMs - (Date.now() - derniereActivite));

    minuteurAlerte = window.setTimeout(() => {
      if (verrouille) return;
      alerteDeclenchee = true;
      const secondesRestantes = Math.max(
        0,
        Math.round((dureeMaxMs - (Date.now() - derniereActivite)) / 1000)
      );
      onAvertir(secondesRestantes);
    }, restantAlert);

    minuteurVerrou = window.setTimeout(() => {
      if (verrouille) return;
      verrouille = true;
      onVerrouiller();
    }, restantVerrou);
  };

  const reprendreActivite = () => {
    derniereActivite = Date.now();
    if (alerteDeclenchee) {
      alerteDeclenchee = false;
      onActif();
    }
    // Le verrouillage reste armé : une interaction relance le compte à rebours.
    planifier();
  };

  planifier();

  EVENEMENTS_ACTIVITE.forEach(evt =>
    window.addEventListener(evt, reprendreActivite, { passive: true })
  );

  // Au retour sur l'onglet, on recalcule le temps réellement écoulé :
  // un ordinateur en veille ne déclenche pas les minuteurs.
  const surVisibilite = () => {
    if (document.visibilityState === 'visible' && !verrouille) {
      if (Date.now() - derniereActivite >= dureeMaxMs) {
        verrouille = true;
        onVerrouiller();
      } else {
        planifier();
      }
    }
  };
  document.addEventListener('visibilitychange', surVisibilite);

  return () => {
    window.clearTimeout(minuteurAlerte);
    window.clearTimeout(minuteurVerrou);
    EVENEMENTS_ACTIVITE.forEach(evt =>
      window.removeEventListener(evt, reprendreActivite)
    );
    document.removeEventListener('visibilitychange', surVisibilite);
  };
};

export default demarrerSurveillanceInactivite;
