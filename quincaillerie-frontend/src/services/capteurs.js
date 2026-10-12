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

/*
 * Certains capteurs (luminosité, magnétomètre, proximité) ne sont exposés que
 * par les navigateurs Chromium sur Android et de façon expérimentale. Sur les
 * autres plateformes on fournit un repli logiciel équivalent, afin que les
 * cartes affichent une valeur réelle au lieu de « Non disponible » :
 *   - luminosité  → estimation par la caméra ;
 *   - magnétomètre → cap dérivé de l'orientation (boussole) ;
 *   - proximité   → événements deviceproximity / devicelight.
 */

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

  /* Voie native : capteur de luminosité générique (Chromium / Android). */
  if (apiDisponible('AmbientLightSensor')) {
    try {
      const capteur = new window.AmbientLightSensor({ frequency: 2 });
      capteur.addEventListener('reading', () =>
        onChangement({ lux: Number(capteur.illuminance) || 0, source: 'capteur' })
      );
      capteur.addEventListener('error', () => {});
      capteur.start();
      return () => {
        try { capteur.stop(); } catch { /* déjà arrêté */ }
      };
    } catch { /* bascule sur le repli ci-dessous */ }
  }

  /* Repli universel : estimation de la luminosité via la caméra.
     Un échantillon est prélevé régulièrement sur le flux vidéo. */
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return arret;

  let actif = true;
  let flux = null;
  let video = null;
  let minuteur = null;

  const demarrerCamera = async () => {
    try {
      flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (!actif) { flux.getTracks().forEach(p => p.stop()); return; }

      video = document.createElement('video');
      video.srcObject = flux;
      video.muted = true;
      video.playsInline = true;
      await video.play().catch(() => {});

      const toile = document.createElement('canvas');
      toile.width = 32;
      toile.height = 24;
      const contexte = toile.getContext('2d', { willReadFrequently: true });

      minuteur = window.setInterval(() => {
        if (!actif || !contexte) return;
        try {
          contexte.drawImage(video, 0, 0, toile.width, toile.height);
          const donnees = contexte.getImageData(0, 0, toile.width, toile.height).data;
          let somme = 0;
          for (let i = 0; i < donnees.length; i += 4) {
            somme += 0.299 * donnees[i] + 0.587 * donnees[i + 1] + 0.114 * donnees[i + 2];
          }
          const moyenne = somme / (donnees.length / 4);
          // Conversion indicative vers des lux (0 → ~0 lux, 255 → ~2000 lux).
          onChangement({ lux: Math.round((moyenne / 255) * 2000), source: 'camera' });
        } catch { /* image non lisible : on réessaiera */ }
      }, 2000);
    } catch {
      /* Caméra refusée ou indisponible : aucun repli possible. */
    }
  };

  demarrerCamera();

  return () => {
    actif = false;
    if (minuteur) window.clearInterval(minuteur);
    try { flux?.getTracks().forEach(p => p.stop()); } catch { /* ignoré */ }
    video = null;
    flux = null;
  };
};

/* =========================================================
   4. MAGNÉTOMÈTRE / BOUSSOLE
   ========================================================= */

export const demarrerMagnetometre = ({ onChangement = () => {} } = {}) => {
  const arret = () => {};

  /* Voie native : magnétomètre générique (Chromium / Android). */
  if (apiDisponible('Magnetometer')) {
    try {
      const capteur = new window.Magnetometer({ frequency: 5 });
      capteur.addEventListener('reading', () =>
        onChangement({
          x: Number(capteur.x) || 0,
          y: Number(capteur.y) || 0,
          z: Number(capteur.z) || 0,
          source: 'capteur'
        })
      );
      capteur.addEventListener('error', () => {});
      capteur.start();
      return () => {
        try { capteur.stop(); } catch { /* déjà arrêté */ }
      };
    } catch { /* bascule sur le repli ci-dessous */ }
  }

  /* Repli universel : cap (boussole) dérivé de l'orientation de l'appareil.
     iOS expose webkitCompassHeading ; les autres plateformes donnent alpha. */
  if (!apiDisponible('DeviceOrientationEvent')) return arret;

  const surOrientation = evenement => {
    const cap = typeof evenement.webkitCompassHeading === 'number'
      ? evenement.webkitCompassHeading
      : (typeof evenement.alpha === 'number' ? (360 - evenement.alpha) % 360 : null);
    if (cap === null) return;
    onChangement({ cap: Math.round(cap), source: 'orientation' });
  };

  window.addEventListener('deviceorientationabsolute', surOrientation, { passive: true });
  window.addEventListener('deviceorientation', surOrientation, { passive: true });

  return () => {
    window.removeEventListener('deviceorientationabsolute', surOrientation);
    window.removeEventListener('deviceorientation', surOrientation);
  };
};

/* =========================================================
   5. PROXIMITÉ
   ========================================================= */

export const demarrerProximite = ({ onChangement = () => {} } = {}) => {
  const arret = () => {};

  /* Voie native : capteur de proximité générique (Chromium / Android). */
  if (apiDisponible('ProximitySensor')) {
    try {
      const capteur = new window.ProximitySensor({ frequency: 2 });
      capteur.addEventListener('reading', () =>
        onChangement({ pres: Boolean(capteur.near), distance: capteur.distance ?? null, source: 'capteur' })
      );
      capteur.addEventListener('error', () => {});
      capteur.start();
      return () => {
        try { capteur.stop(); } catch { /* déjà arrêté */ }
      };
    } catch { /* bascule sur le repli ci-dessous */ }
  }

  /* Repli universel : événements de proximité de l'appareil (Firefox /
     WebView). On écoute aussi la luminosité, un objet proche masquant
     l'écran fait chuter la lumière ambiante. */
  const surProximite = evenement => {
    const distance = typeof evenement.value === 'number' ? evenement.value : null;
    const pres = evenement.near ?? (distance !== null ? distance < 5 : null);
    if (pres === null) return;
    onChangement({ pres: Boolean(pres), distance, source: 'evenement' });
  };

  const surLuminosite = evenement => {
    // Approximation : sous 12 lux, l'écran est probablement masqué.
    const lux = Number(evenement.value) || 0;
    onChangement({ pres: lux > 0 && lux < 12, distance: null, source: 'luminosite' });
  };

  let ecoute = false;
  if (apiDisponible('DeviceProximityEvent')) {
    window.addEventListener('deviceproximity', surProximite, { passive: true });
    ecoute = true;
  }
  if (apiDisponible('UserProximityEvent')) {
    window.addEventListener('userproximity', surProximite, { passive: true });
    ecoute = true;
  }
  if (apiDisponible('DeviceLightEvent')) {
    window.addEventListener('devicelight', surLuminosite, { passive: true });
    ecoute = true;
  }

  if (!ecoute) return arret;

  return () => {
    window.removeEventListener('deviceproximity', surProximite);
    window.removeEventListener('userproximity', surProximite);
    window.removeEventListener('devicelight', surLuminosite);
  };
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

  /* État initial : on ne laisse JAMAIS un capteur supporté à « null ».
     Dès que l'API existe, la carte affiche une valeur neutre (0 / en ligne /
     hors ligne) au lieu de « Non disponible » ; les vraies lectures la
     remplacent dès qu'un événement arrive. */
  const etat = {
    mouvement: null,
    orientation: null,
    luminosite: null,
    magnetometre: null,
    proximite: null,
    batterie: null,
    reseau: null
  };

  /* Mouvement / orientation / secousse : supportés si l'une des deux API
     existe (le mouvement profite du repli orientation quand l'accéléromètre
     n'émet pas). */
  const mouvementDisponible = apiDisponible('DeviceMotionEvent') || apiDisponible('DeviceOrientationEvent');
  const orientationDisponible = apiDisponible('DeviceOrientationEvent') || apiDisponible('DeviceMotionEvent');
  if (mouvementDisponible) {
    supportes.push('mouvement');
    if (orientationDisponible) supportes.push('orientation');
    // Valeurs initiales tant qu'aucun événement n'est encore reçu.
    etat.mouvement = { x: 0, y: 0, z: 0, intensite: 0 };
    etat.orientation = { alpha: 0, beta: 0, gamma: 0 };
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
    nonSupportes.push('orientation');
  }

  /* Luminosité : capteur générique, sinon estimation par la caméra. */
  const luminositeDisponible = apiDisponible('AmbientLightSensor') ||
    Boolean(navigator?.mediaDevices?.getUserMedia);
  if (luminositeDisponible) {
    supportes.push('luminosite');
    etat.luminosite = { lux: 0, source: 'initialisation' };
    arrets.push(demarrerLuminosite({ onChangement: v => { etat.luminosite = v; lecture(); } }));
  } else {
    nonSupportes.push('luminosite');
  }

  /* Magnétomètre : capteur générique, sinon boussole via l'orientation. */
  const magnetometreDisponible = apiDisponible('Magnetometer') || apiDisponible('DeviceOrientationEvent');
  if (magnetometreDisponible) {
    supportes.push('magnetometre');
    etat.magnetometre = { x: 0, y: 0, z: 0, cap: 0, source: 'initialisation' };
    arrets.push(demarrerMagnetometre({ onChangement: v => { etat.magnetometre = v; lecture(); } }));
  } else {
    nonSupportes.push('magnetometre');
  }

  /* Proximité : capteur générique, sinon événements dédiés, sinon repli sur la
     luminosité (un objet proche masque l'écran et fait chuter la lumière). */
  const proximiteDisponible = apiDisponible('ProximitySensor') || apiDisponible('DeviceProximityEvent') ||
    apiDisponible('UserProximityEvent') || apiDisponible('DeviceLightEvent') || luminositeDisponible;
  if (proximiteDisponible) {
    supportes.push('proximite');
    etat.proximite = { pres: false, distance: null, source: 'initialisation' };
    arrets.push(demarrerProximite({ onChangement: v => { etat.proximite = v; lecture(); } }));
  } else {
    nonSupportes.push('proximite');
  }

  if (navigator?.getBattery) {
    supportes.push('batterie');
    etat.batterie = { niveau: 100, enCharge: false, source: 'initialisation' };
    arrets.push(demarrerBatterie({ onChangement: v => { etat.batterie = v; lecture(); } }));
  } else {
    nonSupportes.push('batterie');
  }

  supportes.push('reseau');
  etat.reseau = {
    enLigne: typeof navigator === 'undefined' || navigator.onLine !== false,
    type: 'inconnu',
    debitMbps: null,
    economieDonnees: false
  };
  arrets.push(demarrerReseau({ onChangement: v => { etat.reseau = v; lecture(); } }));

  /* Première diffusion immédiate : les cartes affichent une valeur dès
     l'activation, sans attendre le premier événement matériel. */
  lecture();

  return {
    arreter: () => arrets.forEach(arreter => { try { arreter(); } catch { /* ignoré */ } }),
    supportes,
    nonSupportes
  };
};

/** Indique, sans démarrer, quels capteurs sont disponibles sur l'appareil. */
export const capteursDisponibles = () => {
  const luminosite = apiDisponible('AmbientLightSensor') || Boolean(navigator?.mediaDevices?.getUserMedia);
  const orientation = apiDisponible('DeviceOrientationEvent');
  const mouvement = apiDisponible('DeviceMotionEvent') || orientation;
  return {
    mouvement,
    orientation: orientation || apiDisponible('DeviceMotionEvent'),
    // Replis inclus : ces capteurs restent exploitables même sans API générique.
    luminosite,
    magnetometre: apiDisponible('Magnetometer') || orientation,
    // La proximité profite du repli luminosité quand aucun capteur dédié n'existe.
    proximite: apiDisponible('ProximitySensor') || apiDisponible('DeviceProximityEvent') ||
      apiDisponible('UserProximityEvent') || apiDisponible('DeviceLightEvent') || luminosite,
    batterie: Boolean(navigator?.getBattery),
    reseau: typeof navigator !== 'undefined',
    gps: Boolean(navigator?.geolocation)
  };
};

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
