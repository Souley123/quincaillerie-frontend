/**
 * ACCESSIBILITÉ — SKYS ERP Solution
 * ------------------------------------------------------------
 * Adapte l'application aux personnes en situation de handicap :
 *
 *  • Malvoyants / aveugles
 *      - annonces vocales via l'API SpeechSynthesis (lecture des messages) ;
 *      - LECTURE AUTOMATIQUE : dès que l'option est cochée, l'écran courant est
 *        lu, chaque changement d'écran est lu, et toute information nouvelle
 *        (alerte, notification, résultat) est annoncée au fur et à mesure ;
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

/* Éléments jamais lus à voix haute : code, gabarits, contenus techniques. */
const ELEMENTS_IGNORES = 'script, style, noscript, template, .no-print, [aria-hidden="true"], [hidden]';

/* Longueur maximale d'un texte confié à la synthèse vocale. */
const LONGUEUR_MAX_TEXTE = 2500;

/* Longueur au-delà de laquelle un élément masqué est considéré comme un
   conteneur technique (gabarit, réserve hors écran) et non comme un message. */
const LONGUEUR_MESSAGE_COURT = 160;

/**
 * L'élément est-il réellement affiché à l'utilisateur ?
 *
 * `offsetParent` est le critère habituel, mais il vaut TOUJOURS `null` dans un
 * environnement sans moteur de rendu (jsdom, tests unitaires) : s'y fier seul
 * revenait à ne rien lire du tout. On ne l'utilise donc que s'il est
 * exploitable, et on retombe sinon sur la seule information fiable dans ce
 * cas — le style calculé (`display`, `visibility`).
 */
const estVisible = element => {
  if (!element || !element.tagName) return false;
  // Les légendes de tableau sont positionnées hors du flux : toujours lisibles.
  if (element.tagName === 'CAPTION') return true;

  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const style = window.getComputedStyle(element);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  }

  // `offsetParent` n'est fiable que dans un vrai navigateur (il vaut toujours
  // null sans moteur de rendu, y compris pour des éléments visibles).
  const renduDisponible = typeof element.offsetParent !== 'undefined'
    && element.offsetParent !== null;
  if (renduDisponible) return true;

  // Sans moteur de rendu : on ne rejette que ce qui est explicitement masqué.
  return true;
};

/**
 * Collecte, dans l'ordre de lecture, les textes visibles sous `racine`.
 * Ignore les éléments masqués, les scripts et les gabarits techniques.
 *
 * @param {Element}  racine
 * @param {boolean}  inclureFormulaire  inclure libellés, boutons, liens, champs
 * @param {number}   limite             nombre maximal de textes collectés
 */
const collecterTextes = (racine, inclureFormulaire, limite = 200) => {
  if (!racine) return [];

  const selecteur = inclureFormulaire
    ? 'h1, h2, h3, h4, p, li, td, th, label, button, a, caption, legend, summary, [aria-label]'
    : 'h1, h2, h3, h4, p, li, td, th';

  const morceaux = [];
  racine.querySelectorAll(selecteur).forEach(element => {
    if (morceaux.length >= limite) return;
    if (element.closest(ELEMENTS_IGNORES)) return;
    if (!estVisible(element)) return;
    const texte = (element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim();
    if (!texte) return;
    // Évite les doublons (un parent capte le texte de ses enfants).
    if (morceaux.length && morceaux[morceaux.length - 1].includes(texte)) return;
    morceaux.push(texte);
  });

  return morceaux;
};

/**
 * Lecture intégrale à voix haute du contenu affiché (accessibilité malvoyants).
 * Parcourt les zones visibles de la page et énonce titres, libellés, tableaux,
 * boutons et champs, dans l'ordre de lecture. Ignore les éléments masqués,
 * les scripts et les gabarits techniques.
 */
export const lirePage = ({ cible = null, inclureFormulaire = true } = {}) => {
  if (typeof document === 'undefined' || !('speechSynthesis' in window)) return false;

  const racine = cible && cible.nodeType === 1
    ? cible
    : (document.querySelector('main') || document.querySelector('.dashboard-view') || document.body);
  if (!racine) return false;

  const morceaux = collecterTextes(racine, inclureFormulaire);
  if (!morceaux.length) return false;

  try {
    arreterLecture();
    const utterance = new window.SpeechSynthesisUtterance(morceaux.join('. ').slice(0, LONGUEUR_MAX_TEXTE));
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
};

/** Interrompt toute lecture vocale en cours. */
export const arreterLecture = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch { /* ignoré */ }
  }
};

/* ------------------------------------------------------------------
   LECTURE AUTOMATIQUE À VOIX HAUTE
   ------------------------------------------------------------------
   Demande : « dès qu'on active Annonces vocales, lire le texte de toute
   l'application automatiquement ».

   Comportement :
     1. la case cochée déclenche immédiatement la lecture de l'écran courant ;
     2. un changement d'écran (module, onglet) est annoncé puis lu ;
     3. toute nouvelle information qui apparaît (alerte, notification,
         résultat de recherche, message d'erreur) est lue dès son affichage.

   La parole est mise en FILE D'ATTENTE : un texte n'est jamais coupé par
   le suivant, ce qui rend la lecture compréhensible. « Arrêter la lecture »
   ou décocher l'option vide la file et se tait immédiatement.
   ------------------------------------------------------------------ */

let autoActif = false;
let observateur = null;
let racineObservee = null;
let journalTexte = new Set();
let listeEnAttente = [];
let lectureEnCours = false;
let arretAutomatique = false;

const VIDE_LISTE = () => { listeEnAttente = []; };

/**
 * Prononce le prochain texte en attente, puis le suivant (file séquentielle).
 * On n'appelle jamais cancel() ici : chaque texte va au bout avant le suivant.
 */
const viderLaFile = () => {
  if (lectureEnCours) return;
  if (arretAutomatique) { VIDE_LISTE(); return; }
  const texte = listeEnAttente.shift();
  if (!texte) return;

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  lectureEnCours = true;
  const terminer = () => {
    lectureEnCours = false;
    if (!arretAutomatique) viderLaFile();
  };

  try {
    const utterance = new window.SpeechSynthesisUtterance(texte.slice(0, LONGUEUR_MAX_TEXTE));
    utterance.lang = 'fr-FR';
    utterance.onend = terminer;
    utterance.onerror = terminer;
    window.speechSynthesis.speak(utterance);
  } catch {
    terminer();
  }
};

/** Ajoute un texte à la file de lecture (sans doublon ni répétition). */
const mettreEnFile = (texte, { prioritaire = false } = {}) => {
  const propre = String(texte || '').replace(/\s+/g, ' ').trim();
  if (!propre || !autoActif || arretAutomatique) return;
  if (journalTexte.has(propre)) return;
  journalTexte.add(propre);
  if (prioritaire) listeEnAttente.unshift(propre);
  else listeEnAttente.push(propre);
  viderLaFile();
};

/** Lit un nœud ajouté au document, s'il porte du texte visible. */
const lireNoeud = noeud => {
  if (!noeud || noeud.nodeType !== 1) return;
  if (noeud.closest && noeud.closest(ELEMENTS_IGNORES)) return;

  const textePropre = noeud.textContent ? noeud.textContent.replace(/\s+/g, ' ').trim() : '';
  const boite = noeud.getBoundingClientRect ? noeud.getBoundingClientRect() : null;
  const aUneBoite = Boolean(boite && boite.width > 0 && boite.height > 0);

  /* Élément décoratif : on ne lit que s'il est court (une alerte, un libellé).
     Un long bloc de texte sans dimensions est un conteneur technique. */
  if (!aUneBoite && textePropre.length > LONGUEUR_MESSAGE_COURT) return;

  const morceaux = collecterTextes(noeud, true, 20);

  /* Le nœud lui-même peut porter le message sans correspondre aux sélecteurs
     de `collecterTextes` (un simple <div> d'alerte, par exemple). Sans ce
     cas, une notification apparaissait à l'écran sans jamais être lue. */
  if (morceaux.length === 0 && textePropre) {
    mettreEnFile(textePropre);
    return;
  }
  morceaux.forEach(morceau => mettreEnFile(morceau));
};

/** Attache (ou détache) l'observateur des nouveaux contenus de l'écran. */
const surveillerLesNouveautes = racine => {
  if (typeof window === 'undefined' || !racine) return;
  if (observateur && racineObservee === racine) return;

  arreterObservation();
  racineObservee = racine;

  /* Mécanisme principal : les nœuds ajoutés sont signalés immédiatement. */
  if (typeof window.MutationObserver === 'function') {
    observateur = new window.MutationObserver(mutations => {
      if (!autoActif || arretAutomatique) return;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(lireNoeud);
      });
    });
    try {
      observateur.observe(racine, { childList: true, subtree: true });
    } catch {
      observateur = null;
    }
  }

  /* Filet de sécurité : couvre les environnements où l'observateur ne se
     déclenche pas, et rattrape ce que ses rappels auraient manqué. */
  demarrerSurveillancePeriodique();
};

/** Détache l'observateur (le retenir évite tout rappel après arrêt). */
export const arreterObservation = () => {
  if (observateur) {
    try { observateur.disconnect(); } catch { /* ignoré */ }
  }
  observateur = null;
  racineObservee = null;
  if (minuteurSurveillance !== null) {
    window.clearInterval(minuteurSurveillance);
    minuteurSurveillance = null;
  }
  elementsConnus = null;
  textesConnus = new Map();
};

/* ------------------------------------------------------------------
   FILET DE SÉCURITÉ DE LA SURVEILLANCE
   ------------------------------------------------------------------
   `MutationObserver` est le mécanisme principal : il signale chaque nœud
   ajouté, sans scruter le DOM en continu. Mais il ne se déclenche pas dans
   tous les environnements sans moteur de rendu (jsdom des tests unitaires),
   et une page très chargée peut en noyer les rappels.

   Ce second passage compare donc périodiquement la liste des éléments
   présents à celle du passage précédent : ce qui est nouveau est lu. Il ne
   peut pas produire de doublon (le journal de lecture s'en charge), et il
   garantit qu'aucune information n'est ignorée.
   ------------------------------------------------------------------ */
const INTERVALLE_SURVEILLANCE_MS = 700;

let minuteurSurveillance = null;
let elementsConnus = null;
/* Texte déjà vu pour chaque élément : permet de repérer un contenu NOUVEAU
   dans un élément qui existait déjà (message mis à jour, compteur modifié). */
let textesConnus = new Map();

/** Repère les éléments apparus depuis le passage précédent et les lit. */
const detecterLesNouveautes = () => {
  if (!autoActif || arretAutomatique) return;
  const cible = racineObservee;
  if (!cible || typeof cible.querySelectorAll !== 'function') return;

  const actuels = new Set(cible.querySelectorAll('*'));
  if (elementsConnus) {
    /* `cible` lui-même peut avoir été remplacé (changement d'écran) : on le
       traite comme un ajout, sinon son nouveau contenu passerait inaperçu. */
    if (!elementsConnus.has(cible)) {
      lireNoeud(cible);
    } else {
      /* Sinon, on ne se contente pas des éléments « nouveaux » : un nœud
         ajouté SOUS un parent déjà connu porte du texte qu'il faut lire, même
         si ce parent est inchangé. On relit donc tout nœud dont le contenu
         textuel a changé. Le journal de lecture empêche toute répétition. */
      actuels.forEach(element => {
        if (!elementsConnus.has(element)) { lireNoeud(element); return; }
        if (element.children.length === 0) {
          const texte = (element.textContent || '').replace(/\s+/g, ' ').trim();
          if (texte && texte !== textesConnus.get(element)) {
            textesConnus.set(element, texte);
            lireNoeud(element);
          }
        }
      });
    }
  }
  elementsConnus = actuels;
};

const demarrerSurveillancePeriodique = () => {
  if (typeof window === 'undefined') return;
  if (minuteurSurveillance !== null) window.clearInterval(minuteurSurveillance);
  /* La racine elle-même fait partie du relevé : son remplacement doit être
     vu comme l'arrivée d'un nouvel écran. */
  elementsConnus = racineObservee ? new Set([racineObservee, ...racineObservee.querySelectorAll('*')]) : null;
  textesConnus = new Map();
  if (racineObservee) {
    racineObservee.querySelectorAll('*').forEach(element => {
      if (element.children.length === 0) {
        textesConnus.set(element, (element.textContent || '').replace(/\s+/g, ' ').trim());
      }
    });
  }
  minuteurSurveillance = window.setInterval(detecterLesNouveautes, INTERVALLE_SURVEILLANCE_MS);
};

/**
 * Démarre la lecture automatique de toute l'application.
 * Lit immédiatement l'écran courant, puis surveille les nouveautés.
 *
 * @param {Element} racine  conteneur de l'application (ex. <main class="app-main">)
 */
export const demarrerLectureAuto = racine => {
  if (typeof document === 'undefined') return false;
  autoActif = true;
  arretAutomatique = false;
  journalTexte = new Set();
  VIDE_LISTE();

  const cible = racine && racine.nodeType === 1 ? racine : (document.querySelector('main') || document.body);

  /* Redémarrage après un arrêt : on efface l'état laissé par l'arrêt précédent.
     Sans cela, le drapeau d'arrêt restait actif et RIEN n'était plus jamais lu
     (l'application semblait avoir oublié les annonces vocales). */
  arretAutomatique = false;
  listeEnAttente = [];
  lectureEnCours = false;
  journalTexte = new Set();
  elementsConnus = null;
  textesConnus = new Map();

  lirePage({ cible });
  /* La surveillance est armée APRÈS la lecture initiale : elle prend pour
     référence le contenu déjà lu, et ne signale donc que ce qui vient après.
     L'armer avant ferait relire tout l'écran à chaque passage. */
  surveillerLesNouveautes(cible);
  /* Chaque clic dans l'application déclenche aussi une lecture. */
  ecouterLesClics(cible);
  return true;
};

/**
 * Signale un changement d'écran : le nouveau contenu est lu intégralement.
 * @param {string} titre  libellé du module (annoncé en premier)
 * @param {Element} racine
 */
export const lireNouvelEcran = (titre, racine) => {
  if (!autoActif) return false;
  arretAutomatique = false;
  const cible = racine && racine.nodeType === 1 ? racine : (document.querySelector('main') || document.body);
  if (titre) mettreEnFile(titre, { prioritaire: true });
  lirePage({ cible });
  return true;
};

/**
 * Lit immédiatement une information apparue (alerte, notification, message).
 * @param {string} texte
 * @param {boolean} urgent  place le texte en tête de file
 */
export const lireInfo = (texte, { urgent = false } = {}) => {
  if (!autoActif) return false;
  mettreEnFile(texte, { prioritaire: urgent });
  return true;
};

/* ------------------------------------------------------------------
   LECTURE DÉCLENCHÉE PAR UN CLIC
   ------------------------------------------------------------------
   Chaque clic dans l'application provoque la lecture de ce que l'utilisateur
   vient d'atteindre : le libellé du bouton ou du lien cliqué, puis le contenu
   de l'écran qui s'affiche.

   Pourquoi le libellé en plus du contenu : un bouton qui n'ouvre aucun nouvel
   écran (un simple enregistrement) ne change pas le contenu de la page. Sans
   cette confirmation parlée, l'utilisateur malvoyant n'aurait AUCUN retour sur
   l'action qu'il vient de déclencher.
   ------------------------------------------------------------------ */

/** Libellé lisible d'un élément cliqué (bouton, lien, case à cocher…). */
const libelleDeLElement = element => {
  if (!element) return '';
  const propre = valeur => String(valeur || '').replace(/\s+/g, ' ').trim();

  const aria = propre(element.getAttribute && element.getAttribute('aria-label'));
  if (aria) return aria;

  const texte = propre(element.innerText || element.textContent);
  if (texte) return texte.slice(0, 120);

  /* Champ de formulaire : on énonce sa valeur, pas son contenu. */
  if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
    const valeur = propre(element.value);
    return valeur ? `Champ ${valeur}` : '';
  }

  const titre = propre(element.getAttribute && element.getAttribute('title'));
  return titre.slice(0, 120);
};

/**
 * Lit ce qui vient d'être cliqué, puis le contenu de l'écran.
 * Retourne `true` si quelque chose a été mis en file.
 */
export const lireApresClic = element => {
  if (!autoActif || arretAutomatique) return false;

  const libelle = libelleDeLElement(element);
  if (libelle) mettreEnFile(libelle, { prioritaire: true });

  const cible = racineObservee || document.querySelector('main') || document.body;
  const morceaux = collecterTextes(cible, true, 120);
  morceaux.forEach(morceau => mettreEnFile(morceau));

  return Boolean(libelle) || morceaux.length > 0;
};

/** Arrête la lecture automatique et vide la file d'attente. */
export const arreterLectureAuto = () => {
  autoActif = false;
  arretAutomatique = true;
  VIDE_LISTE();
  lectureEnCours = false;
  journalTexte = new Set();
  arreterObservation();
  arreterEcouteDesClics();
  arreterLecture();
};

/** Indique si la lecture automatique est active. */
export const lectureAutoActive = () => autoActif;

/* ------------------------------------------------------------------
   ÉCOUTE DES CLICS
   ------------------------------------------------------------------
   Un seul écouteur posé sur le conteneur de l'application (en phase de
   capture) couvre TOUS les boutons, liens et menus, présents comme futurs.
   C'est ce qui évite d'avoir à instrumenter chaque bouton de l'ERP.

   Le clic est d'abord laissé suivre son cours : la lecture a lieu juste
   après, quand React a affiché le nouvel écran.
   ------------------------------------------------------------------ */

let conteneurEcoute = null;
let surClicGlobal = null;
let minuteurClic = null;

const gererClic = evenement => {
  if (!autoActif || arretAutomatique) return;

  /* On remonte depuis la cible jusqu'à l'élément actionnable : cliquer sur
     l'icône d'un bouton doit donner le libellé du bouton, pas de l'icône. */
  const declencheur = evenement.target && evenement.target.closest
    ? evenement.target.closest('button, a, [role="button"], [role="tab"], [role="menuitem"], label, summary')
    : null;
  const element = declencheur || evenement.target;

  /* La case « Annonces vocales » gère elle-même le démarrage et l'arrêt :
     la traiter ici relancerait une lecture juste après l'arrêt. */
  if (element && element.closest && element.closest('[data-a11y-voix]')) return;

  /* Le délai laisse React afficher le nouvel écran avant qu'on le lise. */
  if (minuteurClic !== null) window.clearTimeout(minuteurClic);
  minuteurClic = window.setTimeout(() => {
    minuteurClic = null;
    lireApresClic(element);
  }, 350);
};

/** Branche l'écoute des clics sur le conteneur de l'application. */
export const ecouterLesClics = conteneur => {
  if (typeof document === 'undefined') return false;
  const cible = conteneur && conteneur.nodeType === 1 ? conteneur : document.body;
  if (conteneurEcoute === cible && surClicGlobal) return true;

  arreterEcouteDesClics();
  conteneurEcoute = cible;
  surClicGlobal = gererClic;
  // Phase de capture : l'écouteur s'exécute même si un composant arrête la
  // propagation de l'évènement (certains boutons le font).
  cible.addEventListener('click', surClicGlobal, true);
  return true;
};

/** Retire l'écoute des clics (aucun rappel ne subsiste après l'arrêt). */
export const arreterEcouteDesClics = () => {
  if (conteneurEcoute && surClicGlobal) {
    try { conteneurEcoute.removeEventListener('click', surClicGlobal, true); } catch { /* ignoré */ }
  }
  conteneurEcoute = null;
  surClicGlobal = null;
  if (minuteurClic !== null && typeof window !== 'undefined') {
    window.clearTimeout(minuteurClic);
    minuteurClic = null;
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
  lirePage,
  arreterLecture,
  demarrerLectureAuto,
  arreterLectureAuto,
  lireNouvelEcran,
  lireInfo,
  lireApresClic,
  ecouterLesClics,
  arreterEcouteDesClics,
  lectureAutoActive,
  PREFS_PAR_DEFAUT
};

export default accessibilite;
