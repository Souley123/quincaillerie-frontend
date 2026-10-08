/**
 * DÉTECTION D'ACTIVITÉ VISUELLE SUSPECTE
 * ------------------------------------------------------------
 * Analyse discrète de la scène devant l'écran, sans IA externe :
 *
 *   1. Détection de visage si l'API navigateur `FaceDetector` est
 *      disponible (Chrome/Edge) : signale l'absence de visage ou la
 *      présence de plusieurs visages.
 *   2. Analyse de variation d'image : un changement brutal entre deux
 *      captures suggère qu'une autre personne s'est installée devant
 *      le poste.
 *   3. Absence de mouvement : aucune différence significative pendant
 *      une longue période malgré une session ouverte.
 *
 * Chaque signal produit un événement `{ type, niveau, detail }` qui
 * peut être journalisé et transmis à l'administrateur.
 */

/* Seuils heuristiques (0-255 sur la luminosité moyenne). */
const SEUIL_CHANGEMENT_BRUTAL = 26;
const SEUIL_MOUVEMENT_MINIME = 2;

/** Réduit une image à une grille de 32x32 niveaux de gris (empreinte rapide). */
const empreinteGris = dataUrl =>
  new Promise(resoudre => {
    const img = new Image();
    img.onload = () => {
      const n = 32;
      const canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = n;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, n, n);
      const { data } = ctx.getImageData(0, 0, n, n);
      const gris = new Array(n * n);
      for (let i = 0; i < n * n; i += 1) {
        const r = data[i * 4];
        const v = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        gris[i] = Math.round(0.299 * r + 0.587 * v + 0.114 * b);
      }
      resoudre(gris);
    };
    img.onerror = () => resoudre(null);
    img.src = dataUrl;
  });

/** Différence moyenne entre deux empreintes (0-255). */
export const differenceEmpreintes = (a, b) => {
  if (!a || !b || a.length !== b.length) return null;
  let somme = 0;
  for (let i = 0; i < a.length; i += 1) somme += Math.abs(a[i] - b[i]);
  return somme / a.length;
};

/**
 * Analyse une capture caméra et produit un signal si la scène semble
 * suspecte. Retourne null si tout est normal.
 * @param {string} imageDataUrl
 * @param {number[]|null} empreintePrecedente
 */
export const analyserScene = async (imageDataUrl, empreintePrecedente) => {
  if (!imageDataUrl) return null;

  // 1. Détection de visage si l'API est disponible.
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const img = new Image();
      img.src = imageDataUrl;
      await new Promise(r => {
        img.onload = r;
        img.onerror = r;
      });
      const detecteur = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
      const visages = await detecteur.detect(img);
      if (visages.length === 0) {
        return {
          type: 'Aucun visage détecté',
          niveau: 'Moyen',
          detail: 'Aucun visage devant le poste alors que la session est active.'
        };
      }
      if (visages.length > 1) {
        return {
          type: 'Plusieurs visages détectés',
          niveau: 'Critique',
          detail: `${visages.length} visages détectés devant le poste — présence possible d'un tiers.`
        };
      }
    } catch {
      // API indisponible : on poursuit avec l'analyse de variation.
    }
  }

  // 2. Variation d'image (changement brutal = nouvelle personne).
  const empreinte = await empreinteGris(imageDataUrl);
  if (empreinte && empreintePrecedente) {
    const diff = differenceEmpreintes(empreinte, empreintePrecedente);
    if (diff !== null && diff >= SEUIL_CHANGEMENT_BRUTAL) {
      return {
        type: 'Changement visuel brutal',
        niveau: 'Moyen',
        detail: `Changement important de la scène devant l'écran (score ${Math.round(diff)}).`,
        empreinte
      };
    }
  }

  // Empreinte renvoyée même sans signal, pour comparaison suivante.
  return empreinte ? { empreinte } : null;
};

/**
 * Démarre l'analyse périodique. `onSuspect(signal)` est appelé pour
 * chaque signal détecté. `capturer` doit renvoyer une data URL.
 */
export const demarrerAnalyseVisuelle = ({
  capturer,
  intervalleMs = 120000,
  onSuspect = () => {}
} = {}) => {
  if (typeof window === 'undefined') return () => {};

  let actif = true;
  let empreintePrecedente = null;
  let cyclesSansMouvement = 0;
  const CYCLES_IMMOBILITE_SUSPECTE = 5;

  const cycle = async () => {
    if (!actif) return;
    const image = await capturer();
    if (!actif || !image) {
      if (actif) window.setTimeout(cycle, intervalleMs);
      return;
    }

    const signal = await analyserScene(image, empreintePrecedente);
    if (!actif) return;

    if (signal && signal.empreinte && empreintePrecedente) {
      const diff = differenceEmpreintes(signal.empreinte, empreintePrecedente);
      // Image quasi identique d'un cycle à l'autre : mouvement quasi nul.
      if (diff !== null && diff < SEUIL_MOUVEMENT_MINIME) {
        cyclesSansMouvement += 1;
      } else {
        cyclesSansMouvement = 0;
      }
    }

    if (signal && signal.empreinte) empreintePrecedente = signal.empreinte;

    if (signal && signal.type) {
      signal.image = image;
      onSuspect(signal);
    } else if (cyclesSansMouvement >= CYCLES_IMMOBILITE_SUSPECTE) {
      // Aucun mouvement notable pendant plusieurs cycles : scène figée.
      cyclesSansMouvement = 0;
      onSuspect({
        type: 'Immobilité prolongée',
        niveau: 'Faible',
        detail: 'Aucun mouvement détecté devant le poste pendant une longue période (écran figé ou caméra obstruée).',
        image
      });
    }

    if (actif) window.setTimeout(cycle, intervalleMs);
  };

  window.setTimeout(cycle, intervalleMs);

  return () => {
    actif = false;
  };
};

export default demarrerAnalyseVisuelle;
