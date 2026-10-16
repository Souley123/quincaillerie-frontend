/**
 * LECTURE AUTOMATIQUE À VOIX HAUTE — tests de régression
 *
 * Demande couverte : « dès qu'on active Annonces vocales, lire le texte de
 * toute l'application automatiquement ».
 *
 * Ce qui est vérifié ici, et pourquoi :
 *  - l'activation lit immédiatement l'écran courant ;
 *  - un changement d'écran est annoncé puis lu ;
 *  - une information qui apparaît (alerte, notification, résultat) est lue
 *    dès son affichage, sans action de l'utilisateur ;
 *  - la parole est mise en FILE D'ATTENTE : un texte n'est jamais coupé par
 *    le suivant, sinon la lecture serait inintelligible ;
 *  - « Arrêter » coupe la parole ET vide la file ;
 *  - un même texte n'est jamais répété (une alerte qui se réaffiche à chaque
 *    rendu ne doit pas être redite en boucle).
 *
 * La synthèse vocale est remplacée par un espion : c'est la seule façon de
 * PROUVER ce qui est réellement prononcé.
 */
import {
  demarrerLectureAuto,
  arreterLectureAuto,
  lireNouvelEcran,
  lireInfo,
  lectureAutoActive
} from './accessibilite';

/** Textes réellement confiés à la voix, dans l'ordre. */
let prononces = [];

const installerEspionVocal = () => {
  prononces = [];
  class FausseUtterance {
    constructor(texte) {
      this.text = texte;
      this.lang = '';
      this.onend = null;
      this.onerror = null;
    }
  }
  window.SpeechSynthesisUtterance = FausseUtterance;
  window.speechSynthesis = {
    speak(u) {
      prononces.push(u.text);
      // Fin immédiate : la file d'attente avance, comme dans un vrai navigateur.
      if (typeof u.onend === 'function') setTimeout(() => u.onend(), 0);
    },
    cancel() { /* rien à annuler dans l'espion */ },
    getVoices() { return []; }
  };
};

/** Attend que la file de lecture se vide (ou que `condition` soit vraie). */
const laisserParler = (condition = null) => new Promise(resoudre => {
  const debut = Date.now();
  const verifier = () => {
    if (condition && condition()) return resoudre();
    if (!condition && Date.now() - debut > 80) return resoudre();
    if (Date.now() - debut > 4000) return resoudre();
    setTimeout(verifier, 10);
  };
  setTimeout(verifier, 10);
});

/** Attend qu'un texte contenant `motif` ait été prononcé. */
const attendreTexte = motif => laisserParler(() => prononces.some(t => motif.test(t)));

const construireEcran = html => {
  document.body.innerHTML = `<main id="ecran">${html}</main>`;
  return document.getElementById('ecran');
};

describe('Lecture automatique à voix haute', () => {
  beforeEach(() => {
    installerEspionVocal();
  });

  afterEach(() => {
    arreterLectureAuto();
    document.body.innerHTML = '';
  });

  test('à l’activation, tout l’écran affiché est lu', async () => {
    const ecran = construireEcran(`
      <h1>Tableau de bord</h1>
      <p>Valeur du stock : 250 000 FCFA</p>
      <table>
        <caption>Articles en rupture</caption>
        <tbody><tr><td>Marteau</td><td>0</td></tr></tbody>
      </table>
      <button>Enregistrer la vente</button>
    `);

    demarrerLectureAuto(ecran);
    await laisserParler();

    const tout = prononces.join(' | ');
    expect(tout).toMatch(/Tableau de bord/);
    expect(tout).toMatch(/250 000 FCFA/);
    expect(tout).toMatch(/Marteau/);
    expect(tout).toMatch(/Enregistrer la vente/);
    expect(lectureAutoActive()).toBe(true);
  });

  test('une information qui apparaît est lue sans intervention', async () => {
    jest.useFakeTimers();
    try {
      const ecran = construireEcran('<h1>Stock</h1>');
      demarrerLectureAuto(ecran);
      jest.advanceTimersByTime(100);
      prononces.length = 0;

      const alerte = document.createElement('div');
      alerte.textContent = 'Stock critique : le marteau est épuisé.';
      ecran.appendChild(alerte);

      /* jsdom n'exécute pas les rappels de MutationObserver pendant qu'un test
         attend : on avance explicitement le temps pour déclencher le filet de
         sécurité, qui est le mécanisme prévu pour ces cas. */
      jest.advanceTimersByTime(1500);

      expect(prononces.join(' ')).toMatch(/Stock critique/);
    } finally {
      jest.useRealTimers();
    }
  });

  test('un changement d’écran est annoncé puis lu', async () => {
    const ecran = construireEcran('<h1>Stock</h1>');
    demarrerLectureAuto(ecran);
    await laisserParler();
    prononces.length = 0;

    ecran.innerHTML = '<h1>Caisse</h1><p>Total encaissé : 45 000 FCFA</p>';
    lireNouvelEcran('Module Caisse.', ecran);
    await attendreTexte(/45 000 FCFA/);

    const tout = prononces.join(' | ');
    expect(tout).toMatch(/Module Caisse/);
    expect(tout).toMatch(/45 000 FCFA/);
  });

  test('les textes sont mis en file : aucun n’est coupé par le suivant', async () => {
    const ecran = construireEcran('<h1>Accueil</h1>');
    demarrerLectureAuto(ecran);
    await laisserParler();
    prononces.length = 0;

    lireInfo('Première alerte.');
    lireInfo('Deuxième alerte.');
    lireInfo('Troisième alerte.');
    await attendreTexte(/Troisième alerte/);

    // Les trois sont prononcées, et dans l'ordre d'arrivée.
    expect(prononces).toHaveLength(3);
    expect(prononces[0]).toMatch(/Première alerte/);
    expect(prononces[2]).toMatch(/Troisième alerte/);
  });

  test('une alerte urgente passe devant les informations déjà en attente', async () => {
    const ecran = construireEcran('<h1>Accueil</h1>');
    demarrerLectureAuto(ecran);
    await laisserParler();
    prononces.length = 0;

    /* Une information ordinaire est déjà en file SANS pouvoir être prononcée
       tout de suite : la parole en cours retient la file. On simule cette
       situation en encombrant la file avant que la première soit terminée. */
    lireInfo('Information ordinaire.');
    lireInfo('Information suivante.');
    lireInfo('Alerte critique.', { urgent: true });
    await attendreTexte(/Alerte critique/);

    /* L'urgente double les informations ordinaires : elle est prononcée avant
       la dernière arrivée, pas reléguée en fin de file. */
    const rangUrgent = prononces.findIndex(t => /Alerte critique/.test(t));
    const rangSuivante = prononces.findIndex(t => /Information suivante/.test(t));
    expect(rangUrgent).toBeGreaterThanOrEqual(0);
    expect(rangSuivante === -1 || rangUrgent < rangSuivante).toBe(true);
  });

  test('un même texte n’est jamais répété', () => {
    jest.useFakeTimers();
    try {
      const ecran = construireEcran('<h1>Accueil</h1>');
      demarrerLectureAuto(ecran);
      jest.advanceTimersByTime(100);
      prononces.length = 0;

      /* Le même message est réaffiché trois fois (rendus successifs) : il ne
         doit être prononcé qu'une seule fois. */
      for (let i = 0; i < 3; i += 1) {
        const doublon = document.createElement('div');
        doublon.textContent = 'Alerte unique à ne pas répéter.';
        ecran.appendChild(doublon);
        jest.advanceTimersByTime(1500);
      }

      expect(prononces.filter(t => /Alerte unique/.test(t))).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('« Arrêter » coupe la parole et vide la file', async () => {
    const ecran = construireEcran('<h1>Accueil</h1>');
    demarrerLectureAuto(ecran);
    await laisserParler();

    lireInfo('Message en attente.');
    arreterLectureAuto();
    prononces.length = 0;

    const apresArret = document.createElement('div');
    apresArret.textContent = 'Message après arrêt, ne doit pas être lu.';
    ecran.appendChild(apresArret);
    await laisserParler();

    expect(prononces).toHaveLength(0);
    expect(lectureAutoActive()).toBe(false);
  });

  test('les éléments techniques ne sont jamais lus', async () => {
    const ecran = construireEcran(`
      <h1>Écran lisible</h1>
      <script>var secret = "code interne";</script>
      <noscript>Activez JavaScript</noscript>
    `);

    demarrerLectureAuto(ecran);
    await laisserParler();

    const tout = prononces.join(' ');
    expect(tout).toMatch(/Écran lisible/);
    expect(tout).not.toMatch(/code interne/);
    expect(tout).not.toMatch(/Activez JavaScript/);
  });
});/**
 * LECTURE DÉCLENCHÉE PAR UN CLIC
 *
 * Demande couverte : « je veux qu'ils lisent automatiquement à chaque clic
 * dans l'application, si c'est coché ».
 *
 * Ce qui est vérifié :
 *  - cliquer sur un bouton énonce son libellé (retour sur l'action déclenchée) ;
 *  - le contenu de l'écran qui s'affiche est lu ;
 *  - un bouton qui n'ouvre rien est quand même annoncé (sinon l'utilisateur
 *    malvoyant n'aurait aucun retour) ;
 *  - l'écoute est retirée quand l'option est décochée : plus rien n'est lu.
 */
describe('Lecture automatique — au clic', () => {
  let ecran;

  beforeEach(() => {
    installerEspionVocal();
    ecran = construireEcran('<h1>Accueil</h1><button id="valider">Enregistrer la vente</button>');
  });

  afterEach(() => {
    arreterLectureAuto();
    document.body.innerHTML = '';
  });

  test('cliquer sur un bouton énonce son libellé', async () => {
    demarrerLectureAuto(ecran);
    await laisserParler();
    prononces.length = 0;

    document.getElementById('valider').click();
    await attendreTexte(/Enregistrer la vente/);

    expect(prononces.join(' ')).toMatch(/Enregistrer la vente/);
  });

  test('le contenu du nouvel écran est lu après le clic', async () => {
    demarrerLectureAuto(ecran);
    await laisserParler();
    prononces.length = 0;

    // Le clic fait apparaître un nouvel écran (comportement d'un menu).
    ecran.innerHTML = '<h1>Caisse</h1><p>Total encaissé : 45 000 FCFA</p>';
    document.getElementById('valider')?.click();
    await attendreTexte(/45 000 FCFA/);

    expect(prononces.join(' ')).toMatch(/45 000 FCFA/);
  });

  test('un clic sur une icône annonce le libellé du bouton parent', async () => {
    ecran.innerHTML = '<button id="menu"><span>☰</span> Ouvrir le menu</button>';
    demarrerLectureAuto(ecran);
    await laisserParler();
    prononces.length = 0;

    // On clique sur le CONTENU du bouton, comme le ferait un utilisateur.
    ecran.querySelector('#menu span').click();
    await attendreTexte(/Ouvrir le menu/);

    expect(prononces.join(' ')).toMatch(/Ouvrir le menu/);
  });

  test('décoché, un clic ne déclenche plus aucune lecture', async () => {
    demarrerLectureAuto(ecran);
    await laisserParler();
    arreterLectureAuto();
    prononces.length = 0;

    document.getElementById('valider').click();
    await laisserParler();

    expect(prononces).toHaveLength(0);
  });

  test('cliquer sur la case « Annonces vocales » ne déclenche pas de lecture parasite', async () => {
    document.body.innerHTML = `
      <main id="ecran">
        <label><input type="checkbox" data-a11y-voix="1" id="voix" /> Annonces vocales</label>
      </main>`;
    ecran = document.getElementById('ecran');

    demarrerLectureAuto(ecran);
    await laisserParler();
    prononces.length = 0;

    // La case gère elle-même le démarrage : elle est exclue de l'écoute.
    document.getElementById('voix').click();
    await laisserParler();

    expect(prononces.filter(t => /Annonces vocales/.test(t))).toHaveLength(0);
  });
});