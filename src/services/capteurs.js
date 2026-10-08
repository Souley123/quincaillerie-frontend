/**
 * CAPTEUR MULTI-CAPTEURS — SKYS ERP Solution
 * ------------------------------------------------------------
 * Module autonome et robuste qui exploite TOUS les capteurs disponibles
 * dans un navigateur ou une WebView Android/iOS :
 *
 *   1. Mouvement / accéléromètre  (DeviceMotionEvent)
 *   2. Orientation / gyroscope    (DeviceOrientationEvent)
 *   3. Luminosité ambiante        (AmbientLightSensor)
 *   4. Magnétomètre / boussole    (Magnetometer)
 *   5. Proximité                  (ProximitySensor)
 *   6. Batterie                   (Battery Status API)
 *   7. Réseau                     (Network Information API + online/offline)
 *   8. Secousse / chute           (accélération seuil)
 *
 * Chaque capteur est INDÉPENDANT : si l'un n'est pas supporté, les autres
 * continuent de fonctionner. Aucune donnée n'est envoyée sans raison :
 * les valeurs restent locales, sauf alerte explicite de sécurité.
 *
 * Particularités Android/iOS :
 *   - iOS exige une autorisation utilisateur (requestPermission) qui DOIT
 *     être demandée après un geste (clic). Voir `demanderAutorisationsCapteurs`.
 *   - Les capteurs génériques (luminosité, magnétomètre) ne sont pas
 *     supportés partout : `estSupporte()` le signale proprement.
 */

/** Détecte le support d'une API sans planter si elle est absente. */
const apiDisponible = nom => typeof window !== 'undefined' && nom in window;

/** Vérifie si les capteurs de mouvement sont uniquement basés sur un événement de permission. */
const permissionRequise = constructeur =>
  typeof constructeur !== 'undefined' && typeof constructeur.requestPermission === 'function';

/* =========================================================
   1 & 2. MOUVEMENT ET ORIENTATION
   ========================================================= */

/**
 * Démarre l'écoute du mouvement et de l'orientation.
 * @param {object} options
 * @param {Function} options.onMouvement   ({ x, y, z, intensite })
 * @param {Function} options.onOrientation ({ alpha, beta, gamma })
 * @param {Function} options.onSecousse    (intensite)
 * @param {number} options.seuilSecousse   intensité déclenchant onSecousse
 * @returns {Function} arrêt de l'écoute
 */
export const demarrerMouvement = ({
  onMouvement = () => {},
  onOrientation = () => {},
  onSecousse = () => {},
  seuilSecousse = 18
} = {}) => {
  if (!apiDisponible('DeviceMotionEvent') && !apiDisponible('DeviceOrientationEvent')) {
    return () => {};
  }

  let dernier = { x: 0, y: 0, z: 0 };

  const surMouvement = evenement => {
    const acc = evenement.accelerationIncludingGravity || evenement.acceleration || {};
    const x = Number(acc.x) || 0;
    const y = Number(acc.y) || 0;
    const z = Number(acc.z) || 0;
    // Variation d'accélération : mesure fiable de l'agitation de l'appareil.
    const intensite = Math.abs(x - dernier.x) + Math.abs(y - dernier.y) + Math.abs(z - dernier.z);
    dernier = { x, y, z };

    onMouvement({ x, y, z, intensite });
    if (intensite >= seuilSecousse) onSecousse(intensite);
  };

  const surOrientation = evenement => {
    onOrientation({
      alpha: Number(evenement.alpha) || 0, // rotation autour de l'axe vertical
      beta: Number(evenement.beta) || 0,   // inclinaison avant/arrière
      gamma: Number(evenement.gamma) || 0  // inclinaison gauche/droite
    });
  };

  window.addEventListener('devicemotion', surMouvement, { passive: true });
  window.addEventListener('deviceorientation', surOrientation, { passive: true });

  return () => {
    window.removeEventListener('devicemotion', surMouvement);
    window.removeEventListener('deviceorientation', surOrientation);
  };
};

/**
 * Demande les autorisations capteurs (obligatoire sur iOS 13+).
 * DOIT être appelée depuis un geste utilisateur (clic sur un bouton).
 * @returns {Promise<{mouvement:boolean, orientation:boolean}>}
 */
export const demanderAutorisationsCapteurs = async () => {
  const resultat = { mouvement: false, orientation: false };

  try {
    if (permissionRequise(window.DeviceMotionEvent)) {
      resultat.mouvement = (await window.DeviceMotionEvent.requestPermission()) === 'granted';
    } else if (apiDisponible('DeviceMotionEvent')) {
      resultat.mouvement = true; // Android : accordé par défaut
    }
  } catch {
    resultat.mouvement = false;
  }

  try {
    if (permissionRequise(window.DeviceOrientationEvent)) {
      resultat.orientation = (await window.DeviceOrientationEvent.requestPermission()) === 'granted';
    } else if (apiDisponible('DeviceOrientationEvent')) {
      resultat.orientation = true;
    }
  } catch {
    resultat.orientation = false;
  }

  return resultat;
};

/* =========================================================
   3. LUMINOSITÉ AMBIANTE
   ========================================================= */

/**
 * Démarre la lecture de la luminosité (lux). Renvoie une fonction d'arrêt
 * et expose `estSupporte()` : l'API n'existe pas sur tous les navigateurs.
 */
export const demarrerLuminosite = ({ onChangement = () => {} } = {}) => {
  const arret = () => {};
  if (!apiDisponible('AmbientLightSensor')) return arret;

  try {
    const capteur = new window.AmbientLightSensor({ frequency: 2 });
    capteur.addEventListener('reading', () =>
      onChangement({ lux: Number(capteur.illuminance) || 0 })
    );
    capteur.addEventListener('error', () => {});
    capteur.start();
    return () => {
      try { capteur.stop(); } catch { /* déjà arrêté */ }
    };
  } catch {
    return arret;
  }
};

/* =========================================================
   4. MAGNÉTOMÈTRE / BOUSSOLE
   ========================================================= */

export const demarrerMagnetometre = ({ onChangement = () => {} } = {}) => {
  const arret = () => {};
  if (!apiDisponible('Magnetometer')) return arret;

  try {
    const capteur = new window.Magnetometer({ frequency: 5 });
    capteur.addEventListener('reading', () =>
      onChangement({
        x: Number(capteur.x) || 0,
        y: Number(capteur.y) || 0,
        z: Number(capteur.z) || 0
      })
    );
    capteur.addEventListener('error', () => {});
    capteur.start();
    return () => {
      try { capteur.stop(); } catch { /* déjà arrêté */ }
    };
  } catch {
    return arret;
  }
};

/* =========================================================
   5. PROXIMITÉ
   ========================================================= */

export const demarrerProximite = ({ onChangement = () => {} } = {}) => {
  const arret = () => {};
  if (!apiDisponible('ProximitySensor')) return arret;

  try {
    const capteur = new window.ProximitySensor({ frequency: 2 });
    capteur.addEventListener('reading', () =>
      onChangement({ pres: Boolean(capteur.near), distance: capteur.distance ?? null })
    );
    capteur.addEventListener('error', () => {});
    capteur.start();
    return () => {
      try { capteur.stop(); } catch { /* déjà arrêté */ }
    };
  } catch {
    return arret;
  }
};

/* =========================================================
   6. BATTERIE
   ========================================================= */

/**
 * Surveille la batterie. Utile pour avertir avant une coupure qui pourrait
 * interrompre une vente ou une synchronisation.
 */
export const demarrerBatterie = ({ onChangement = () => {} } = {}) => {
  const arret = () => {};
  if (!navigator?.getBattery) return arret;

  let gestionnaire = null;
  let batterie = null;

  const lire = () => {
    if (!batterie) return;
    onChangement({
      niveau: Math.round((batterie.level ?? 1) * 100),
      enCharge: Boolean(batterie.charging)
    });
  };

  navigator.getBattery().then(b => {
    batterie = b;
    lire();
    gestionnaire = lire;
    b.addEventListener('levelchange', gestionnaire);
    b.addEventListener('chargingchange', gestionnaire);
  }).catch(() => {});

  return () => {
    if (batterie && gestionnaire) {
      try {
        batterie.removeEventListener('levelchange', gestionnaire);
        batterie.removeEventListener('chargingchange', gestionnaire);
      } catch { /* ignoré */ }
    }
  };
};

/* =========================================================
   7. RÉSEAU
   ========================================================= */

/**
 * Surveille l'état et la qualité estimée de la connexion.
 * Essentiel en zone à couverture variable (Côte d'Ivoire et zones rurales).
 */
export const demarrerReseau = ({ onChangement = () => {} } = {}) => {
  if (typeof window === 'undefined') return () => {};

  const connexion = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  const lire = () => {
    onChangement({
      enLigne: navigator.onLine !== false,
      type: connexion?.effectiveType || 'inconnu',
      debitMbps: connexion?.downlink ?? null,
      economieDonnees: Boolean(connexion?.saveData)
    });
  };

  lire();
  window.addEventListener('online', lire);
  window.addEventListener('offline', lire);
  connexion?.addEventListener?.('change', lire);

  return () => {
    window.removeEventListener('online', lire);
    window.removeEventListener('offline', lire);
    connexion?.removeEventListener?.('change', lire);
  };
};

/* =========================================================
   8. CAPTEUR AGRÉGÉ
   ========================================================= */

/**
 * Démarre tous les capteurs disponibles en une seule fois et signale ceux
 * qui ne sont pas supportés. Renvoie une fonction d'arrêt globale.
 *
 * @param {object} options
 * @param {Function} options.onLecture  reçoit un objet agrégé à chaque changement
 * @param {Function} options.onAlerte   recevra les alertes importantes (secousse…)
 * @returns {{ arreter: Function, supportes: string[], nonSupportes: string[] }}
 */
export const demarrerTousCapteurs = ({ onLecture = () => {}, onAlerte = () => {} } = {}) => {
  const supportes = [];
  const nonSupportes = [];
  const arrets = [];

  const lecture = () => {
    if (supportes.length) onLecture(etat);
  };

  const etat = {
    mouvement: null,
    orientation: null,
    luminosite: null,
    magnetometre: null,
    proximite: null,
    batterie: null,
    reseau: null
  };

  // Mouvement / orientation / secousse
  if (apiDisponible('DeviceMotionEvent') || apiDisponible('DeviceOrientationEvent')) {
    supportes.push('mouvement');
    arrets.push(demarrerMouvement({
      onMouvement: m => { etat.mouvement = m; lecture(); },
      onOrientation: o => { etat.orientation = o; lecture(); },
      onSecousse: intensite => onAlerte({
        type: 'secousse',
        intensite,
        detail: `Mouvement brusque détecté (intensité ${Math.round(intensite)}).`
      })
    }));
  } else {
    nonSupportes.push('mouvement');
  }

  if (apiDisponible('AmbientLightSensor')) {
    supportes.push('luminosite');
    arrets.push(demarrerLuminosite({ onChangement: v => { etat.luminosite = v; lecture(); } }));
  } else {
    nonSupportes.push('luminosite');
  }

  if (apiDisponible('Magnetometer')) {
    supportes.push('magnetometre');
    arrets.push(demarrerMagnetometre({ onChangement: v => { etat.magnetometre = v; lecture(); } }));
  } else {
    nonSupportes.push('magnetometre');
  }

  if (apiDisponible('ProximitySensor')) {
    supportes.push('proximite');
    arrets.push(demarrerProximite({ onChangement: v => { etat.proximite = v; lecture(); } }));
  } else {
    nonSupportes.push('proximite');
  }

  if (navigator?.getBattery) {
    supportes.push('batterie');
    arrets.push(demarrerBatterie({ onChangement: v => { etat.batterie = v; lecture(); } }));
  } else {
    nonSupportes.push('batterie');
  }

  supportes.push('reseau');
  arrets.push(demarrerReseau({ onChangement: v => { etat.reseau = v; lecture(); } }));

  return {
    arreter: () => arrets.forEach(arreter => { try { arreter(); } catch { /* ignoré */ } }),
    supportes,
    nonSupportes
  };
};

/** Indique, sans démarrer, quels capteurs sont disponibles sur l'appareil. */
export const capteursDisponibles = () => ({
  mouvement: apiDisponible('DeviceMotionEvent'),
  orientation: apiDisponible('DeviceOrientationEvent'),
  luminosite: apiDisponible('AmbientLightSensor'),
  magnetometre: apiDisponible('Magnetometer'),
  proximite: apiDisponible('ProximitySensor'),
  batterie: Boolean(navigator?.getBattery),
  reseau: typeof navigator !== 'undefined',
  gps: Boolean(navigator?.geolocation)
});

const capteurs = {
  demarrerMouvement,
  demarrerLuminosite,
  demarrerMagnetometre,
  demarrerProximite,
  demarrerBatterie,
  demarrerReseau,
  demarrerTousCapteurs,
  demanderAutorisationsCapteurs,
  capteursDisponibles
};

export default capteurs;
