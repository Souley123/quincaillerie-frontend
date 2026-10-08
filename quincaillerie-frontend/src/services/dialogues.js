/**
 * DIALOGUES COMPATIBLES ANDROID / iOS / WEB
 * ------------------------------------------------------------
 * Les WebViews Capacitor (Android et iOS) ne supportent PAS de façon fiable :
 *   - window.confirm()  → renvoie toujours true (l'utilisateur ne voit rien) ;
 *   - window.prompt()   → renvoie toujours null (aucune saisie possible) ;
 *   - window.alert()    → peut être bloqué silencieusement ;
 *   - window.print()    → n'ouvre aucune boîte d'impression sur Android.
 *
 * Ce service fournit des équivalents fiables, basés sur une interface
 * HTML rendue dans le DOM, qui fonctionnent partout.
 *
 * Les fonctions asynchrones (confirmer, demander, alerter) renvoient une
 * Promise : `await confirmer(...)`.
 */

/** Détecte une exécution dans une application native (Capacitor). */
export const estApplicationNative = () => {
  try {
    if (typeof window === 'undefined') return false;
    // Capacitor expose `Capacitor` sur window quand le plugin est présent.
    if (window.Capacitor?.isNativePlatform) return window.Capacitor.isNativePlatform();
    // Repli : présence du schéma natif utilisé par Capacitor.
    const protocole = window.location?.protocol || '';
    const hote = window.location?.hostname || '';
    const estMobile = /android|iphone|ipad/i.test(navigator.userAgent || '');
    return protocole === 'capacitor:' || (hote === 'localhost' && estMobile);
  } catch {
    return false;
  }
};

/** Crée (une seule fois) le conteneur de dialogue dans le DOM. */
const obtenirConteneur = () => {
  if (typeof document === 'undefined') return null;
  let conteneur = document.getElementById('skys-dialogue');
  if (conteneur) return conteneur;

  conteneur = document.createElement('div');
  conteneur.id = 'skys-dialogue';
  conteneur.style.position = 'fixed';
  conteneur.style.inset = '0';
  conteneur.style.zIndex = '100000';
  conteneur.style.display = 'none';
  conteneur.style.alignItems = 'center';
  conteneur.style.justifyContent = 'center';
  conteneur.style.backgroundColor = 'rgba(15,23,42,0.55)';
  conteneur.style.padding = '18px';
  document.body.appendChild(conteneur);
  return conteneur;
};

/**
 * Affiche un dialogue HTML et résout la promesse selon l'action.
 * @param {object} options
 * @param {string} options.titre
 * @param {string} options.message
 * @param {string} [options.champ]  libellé : affiche un champ de saisie
 * @param {string} [options.valeur] valeur initiale du champ
 * @param {string} [options.typeChamp] type d'input (text, password...)
 * @param {boolean} [options.confirmation] affiche Annuler / Confirmer
 * @returns {Promise<string|boolean|null>} saisie, true/false, ou null si annulé
 */
const afficherDialogue = ({ titre, message, champ = null, valeur = '', typeChamp = 'text', confirmation = false }) => {
  return new Promise(resoudre => {
    const conteneur = obtenirConteneur();
    if (!conteneur) {
      // Pas de DOM (environnement de test) : comportement de repli sûr.
      if (confirmation) resoudre(false);
      else if (champ) resoudre(null);
      else resoudre(true);
      return;
    }

    conteneur.innerHTML = '';
    conteneur.style.display = 'flex';

    const carte = document.createElement('div');
    carte.setAttribute('role', 'dialog');
    carte.setAttribute('aria-modal', 'true');
    Object.assign(carte.style, {
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '20px',
      maxWidth: '420px',
      width: '100%',
      boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
      fontFamily: "'Segoe UI', sans-serif"
    });

    const h = document.createElement('h3');
    h.textContent = titre || 'Confirmation';
    Object.assign(h.style, { margin: '0 0 10px', color: '#0f172a', fontSize: '16px' });
    carte.appendChild(h);

    if (message) {
      const p = document.createElement('p');
      p.textContent = message;
      Object.assign(p.style, { margin: '0 0 14px', color: '#334155', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' });
      carte.appendChild(p);
    }

    let input = null;
    if (champ) {
      const label = document.createElement('label');
      label.textContent = champ;
      Object.assign(label.style, { display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#334155' });
      carte.appendChild(label);

      input = document.createElement('input');
      input.type = typeChamp;
      input.value = valeur;
      Object.assign(input.style, { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', marginBottom: '14px' });
      carte.appendChild(input);
    }

    const boutons = document.createElement('div');
    Object.assign(boutons.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end' });

    const fermer = resultat => {
      conteneur.style.display = 'none';
      conteneur.innerHTML = '';
      resoudre(resultat);
    };

    if (confirmation || champ) {
      const annuler = document.createElement('button');
      annuler.type = 'button';
      annuler.textContent = 'Annuler';
      Object.assign(annuler.style, { backgroundColor: '#e2e8f0', color: '#334155', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' });
      annuler.onclick = () => fermer(champ ? null : false);
      boutons.appendChild(annuler);
    }

    const valider = document.createElement('button');
    valider.type = 'button';
    valider.textContent = 'Valider';
    Object.assign(valider.style, { backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' });
    valider.onclick = () => fermer(champ ? (input ? input.value : '') : true);
    boutons.appendChild(valider);

    carte.appendChild(boutons);
    conteneur.appendChild(carte);

    if (input) {
      // Le clavier s'ouvre directement sur mobile.
      window.setTimeout(() => input.focus(), 50);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') valider.click();
      });
    }
  });
};

/** Remplace window.confirm. Renvoie une Promise<boolean>. */
export const confirmer = (message, titre = 'Confirmation') =>
  afficherDialogue({ titre, message, confirmation: true });

/** Remplace window.prompt. Renvoie une Promise<string|null>. */
export const demander = (message, { titre = 'Saisie', valeur = '', typeChamp = 'text' } = {}) =>
  afficherDialogue({ titre, message, champ: message || 'Valeur', valeur, typeChamp });

/** Remplace window.alert. Renvoie une Promise<void>. */
export const alerter = (message, titre = 'Information') =>
  afficherDialogue({ titre, message }).then(() => undefined);

/**
 * Impression compatible : sur le web on utilise window.print(), sur mobile
 * (où window.print est inopérant) on propose d'ouvrir la page dans un
 * navigateur externe ou d'enregistrer en PDF via le partage natif.
 */
export const imprimer = () => {
  try {
    if (typeof window === 'undefined') return;
    if (estApplicationNative()) {
      // Sur Android/iOS, window.print() ne fait rien : on prévient clairement
      // l'utilisateur plutôt que de laisser un bouton sans effet.
      return alerter(
        "L'impression directe n'est pas disponible dans l'application mobile. Utilisez le bouton de partage de votre téléphone pour envoyer le reçu, ou ouvrez l'application sur un ordinateur pour imprimer.",
        'Impression'
      );
    }
    window.print();
  } catch {
    /* Impression indisponible : aucune action bloquante. */
  }
  return undefined;
};

const dialogues = { confirmer, demander, alerter, imprimer, estApplicationNative };

export default dialogues;
