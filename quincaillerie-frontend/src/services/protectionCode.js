/**
 * PROTECTION DU CODE — SKYS ERP Solution
 * ------------------------------------------------------------
 * Objectif : décourager l'inspection et la modification du code / de
 * l'interface dans le navigateur.
 *
 * LIMITE ASSUMÉE : une application web est exécutée PAR le navigateur de
 * l'utilisateur, donc son HTML/CSS/JS lui est forcément livré. Aucune
 * protection côté client n'est un verrou absolu ; un utilisateur déterminé
 * peut toujours contourner ces mesures. Le rôle réel de ce module est de :
 *   1. bloquer les raccourcis d'inspection (F12, Ctrl+Shift+I/J/C, Ctrl+U) ;
 *   2. désactiver le menu contextuel (clic droit) ;
 *   3. détecter l'ouverture des DevTools et réagir (alerte + trace).
 *
 * La VRAIE sécurité (données, permissions, intégrité) reste côté serveur :
 * jeton JWT signé, filtrage multi-tenant, rôles et CORS. Ce module ne
 * remplace jamais ces contrôles ; il les complète.
 *
 * Le module est inactif en développement (npm start) pour ne pas gêner le
 * travail, et actif uniquement dans le build de production.
 */

/* Détecte l'environnement de développement (React fournit NODE_ENV au build). */
const enDeveloppement = (() => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();

/* Raccourcis clavier ouvrant les outils de développement ou le code source. */
const estRaccourciInterdit = evenement => {
  const touche = (evenement.key || '').toLowerCase();
  // F12
  if (evenement.key === 'F12') return true;
  // Ctrl+Shift+I (inspecteur), J (console), C (sélecteur d'élément)
  if (evenement.ctrlKey && evenement.shiftKey && ['i', 'j', 'c'].includes(touche)) return true;
  // Ctrl+U (code source)
  if (evenement.ctrlKey && touche === 'u') return true;
  // Cmd+Alt+I / J / C sur macOS
  if (evenement.metaKey && evenement.altKey && ['i', 'j', 'c'].includes(touche)) return true;
  // Cmd+Alt+U (code source) sur macOS
  if (evenement.metaKey && evenement.altKey && touche === 'u') return true;
  return false;
};

/**
 * Active la protection du code.
 * @param {object} options
 * @param {Function} options.onIntrusion  appelé lors d'une tentative détectée
 * @returns {Function} désactivation complète des protections
 */
export const activerProtectionCode = ({ onIntrusion = () => {} } = {}) => {
  // En développement : on ne bride rien, pour permettre le diagnostic.
  if (enDeveloppement || typeof window === 'undefined') return () => {};

  const signaler = (raison, evenement) => {
    try { onIntrusion(raison, evenement); } catch { /* ignoré */ }
  };

  /* 1. Bloquer les raccourcis d'inspection. */
  const surTouche = evenement => {
    if (estRaccourciInterdit(evenement)) {
      evenement.preventDefault();
      evenement.stopPropagation();
      signaler(`Raccourci d'inspection bloqué : ${evenement.key}`, evenement);
      return false;
    }
  };

  /* 2. Désactiver le menu contextuel (clic droit). */
  const surMenuContextuel = evenement => {
    evenement.preventDefault();
    signaler('Clic droit désactivé (menu contextuel).', evenement);
    return false;
  };

  /* 3. Détecter l'ouverture des DevTools via l'écart de dimensions.
     Un panneau d'outils amovible réduit la fenêtre d'affichage : on
     compare la taille interne à la taille externe (tolérance pour les
     barres d'outils et le zoom). */
  let dernierSignal = 0;
  const verifierDevTools = () => {
    const largeurEcart = window.outerWidth - window.innerWidth;
    const hauteurEcart = window.outerHeight - window.innerHeight;
    const ouvert = largeurEcart > 160 || hauteurEcart > 160;
    if (ouvert && Date.now() - dernierSignal > 4000) {
      dernierSignal = Date.now();
      signaler('Outils de développement détectés ouverts.', null);
    }
  };
  const minuteurDevTools = window.setInterval(verifierDevTools, 2000);

  /* 4. Empêcher le glisser-déposer du contenu (extraction de texte). */
  const surGlisser = evenement => evenement.preventDefault();

  window.addEventListener('keydown', surTouche, true);
  window.addEventListener('contextmenu', surMenuContextuel, true);
  window.addEventListener('dragstart', surGlisser, true);

  return () => {
    window.clearInterval(minuteurDevTools);
    window.removeEventListener('keydown', surTouche, true);
    window.removeEventListener('contextmenu', surMenuContextuel, true);
    window.removeEventListener('dragstart', surGlisser, true);
  };
};

export default activerProtectionCode;
