/**
 * CHOIX DE LA CAMÉRA
 * ------------------------------------------------------------
 * « facingMode: user » ne veut pas dire « la caméra qui existe » mais une
 * caméra FRONTALE. Sur un ordinateur qui n'en a pas (une simple webcam USB),
 * le navigateur peut accepter la demande et renvoyer une piste SANS IMAGE :
 * l'aperçu reste noir alors que le flux est « accordé ».
 *
 * On interroge donc la liste réelle des périphériques et on vise
 * explicitement l'un de leurs identifiants. Si la liste n'est pas encore
 * étiquetée (permission non encore accordée), on réessaie après un premier
 * getUserMedia générique, puis seulement en dernier recours on garde
 * facingMode.
 */

const RESOLUTION = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 20 } };

/* Frontale / arrière, d'après le libellé fourni par le système. */
const estFrontale = appareil => /front|face|avant|user/i.test(appareil.label || '');
const estArriere = appareil => /back|rear|environment|arri[eè]re/i.test(appareil.label || '');

const listerVideos = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    return (await navigator.mediaDevices.enumerateDevices())
      .filter(appareil => appareil.kind === 'videoinput');
  } catch {
    return [];
  }
};

/** Étape 1 : liste des appareils, sans ouvrir la caméra. */
export const listerAppareilsVideo = listerVideos;

/** Étape 2 : appareils étiquetés (donc sélectionnables par identifiant). */
export const appareilsIdentifiables = appareils =>
  (appareils || []).filter(appareil => appareil.deviceId && appareil.label);

/**
 * Choisit l'appareil correspondant à la face demandée ('user' = avant,
 * 'environment' = arrière) et renvoie ses contraintes vidéo.
 * @param {string} face
 * @param {Array} appareils liste renvoyée par enumerateDevices
 * @returns {{ contraintes: object, appareil: object|null }}
 */
export const contraintesDepuisAppareils = (face, appareils) => {
  const disponibles = appareilsIdentifiables(appareils);
  if (disponibles.length) {
    const correspondante = face === 'user' ? estFrontale : estArriere;
    const choisie = disponibles.find(correspondante) || disponibles[0];
    return { contraintes: { ...RESOLUTION, deviceId: { exact: choisie.deviceId } }, appareil: choisie };
  }
  /* Aucun libellé exploitable : on demande la face, sans l'imposer
     (ideal), pour ne pas obtenir d'OverconstrainedError. */
  return { contraintes: { ...RESOLUTION, facingMode: { ideal: face } }, appareil: null };
};

/**
 * Ouvre un flux vidéo en visant explicitement un appareil existant.
 * @param {object} options
 * @param {string} options.face 'user' ou 'environment'
 * @param {Array} [options.appareils] liste déjà connue (évite un 2e appel)
 * @param {number} [options.delaiEtiquettesMs] attente après le 1er appel
 * @returns {Promise<MediaStream>}
 */
export const ouvrirFluxCamera = async ({ face = 'user', appareils = null, delaiEtiquettesMs = 350 } = {}) => {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) throw new Error('API caméra indisponible.');

  let liste = appareils || await listerVideos();
  let { contraintes } = contraintesDepuisAppareils(face, liste);

  /* Libellés vides = permission pas encore accordée : un premier appel
     générique les débloque, puis on relit la liste. Sans enumerateDevices,
     l'amorce n'apprendrait rien et provoquerait une 2e demande de permission. */
  const peutRelireLaListe = Boolean(mediaDevices.enumerateDevices);
  if (peutRelireLaListe && !appareilsIdentifiables(liste).length) {
    let amorce = null;
    try {
      amorce = await mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      /* Refus ou absence de caméra : l'appel réel remontera l'erreur précise. */
    }
    if (amorce) amorce.getTracks().forEach(track => track.stop());
    if (delaiEtiquettesMs > 0) {
      await new Promise(resoudre => setTimeout(resoudre, delaiEtiquettesMs));
    }
    liste = await listerVideos();
    contraintes = contraintesDepuisAppareils(face, liste).contraintes;
  }

  return mediaDevices.getUserMedia({ video: contraintes, audio: false });
};

export default ouvrirFluxCamera;
