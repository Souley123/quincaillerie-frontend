/**
 * CAPTURE CAMÉRA ESPION (discrète, sans interface)
 * ------------------------------------------------------------
 * Utilisée par les déclencheurs de sécurité automatiques :
 *   - échecs répétés de connexion ;
 *   - accès / modification du module Dépenses sans autorisation.
 *
 * Le flux n'est jamais affiché : on ouvre la caméra, on capture une image,
 * puis on libère immédiatement le périphérique. En cas de refus de
 * permission, la capture est simplement indisponible — le reste de la
 * sécurité (journalisation + alerte) continue de fonctionner.
 */

const LARGEUR_CIBLE = 480;

/**
 * Prend une capture furtive et renvoie une data URL JPEG (ou null si la
 * caméra est indisponible). timeoutMs limite l'attente de la permission.
 */
export const capturerFurtivement = async ({ timeoutMs = 6000 } = {}) => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  let flux = null;
  let video = null;

  try {
    flux = await Promise.race([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false }),
      new Promise((_, rejeter) =>
        setTimeout(() => rejeter(new Error('timeout')), timeoutMs)
      )
    ]);

    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = flux;

    // Laisse le temps au flux de produire une première image exploitable.
    await new Promise(resoudre => {
      const fini = () => resoudre();
      video.onloadeddata = fini;
      // Filet de sécurité si l'évènement ne vient pas.
      setTimeout(fini, 1500);
    });

    const largeurSource = video.videoWidth || LARGEUR_CIBLE;
    const hauteurSource = video.videoHeight || 360;
    const ratio = hauteurSource / largeurSource;

    const canvas = document.createElement('canvas');
    canvas.width = LARGEUR_CIBLE;
    canvas.height = Math.round(LARGEUR_CIBLE * ratio);

    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return null;
  } finally {
    if (flux) flux.getTracks().forEach(track => track.stop());
    if (video) {
      video.srcObject = null;
      video = null;
    }
  }
};

export default capturerFurtivement;
