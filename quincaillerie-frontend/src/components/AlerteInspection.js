/**
 * ALERTE D'INSPECTION DU CODE — SKYS ERP Solution
 * ------------------------------------------------------------
 * Remplace l'ancienne réaction « document.body.innerHTML = … » (script fourni),
 * qui DÉTRUISAIT l'arbre React : l'utilisateur perdait sa saisie en cours
 * (panier, formulaire) et ne pouvait plus rien faire jusqu'au rechargement.
 *
 * Ici, l'alerte est une SURCOUCHE autonome :
 *   • aucun composant React n'est démonté ni modifié ;
 *   • la saisie en cours reste intacte sous la couche ;
 *   • l'utilisateur peut continuer (bouton « Continuer ») ou fermer l'onglet ;
 *   • un compte à rebours rappelle la règle, sans jamais couper la session.
 *
 * Les tentatives sont déjà relayées à l'application (évènement
 * `skys:tentative-inspection`) qui les journalise sur le compte courant.
 * Cette couche ne fait qu'afficher.
 */

const ID_SURCOUCHE = 'skys-alerte-inspection';
const DELAI_AVANT_AFFICHAGE_MS = 600;   // anti-clignotement : laisse le resize se stabiliser
const DELAI_ENTRE_ALERTES_MS = 15000;   // évite d'empiler les affichages
const DELAI_VERROU_MS = 90000;          // après ce délai, le bouton de fermeture apparaît

let derniereAlerte = 0;
let minuteurAffichage = null;

/** Crée la couche d'alerte si elle n'existe pas déjà. */
const creerSurcouche = () => {
  const existante = document.getElementById(ID_SURCOUCHE);
  if (existante) return existante;

  const couche = document.createElement('div');
  couche.id = ID_SURCOUCHE;
  couche.setAttribute('role', 'alertdialog');
  couche.setAttribute('aria-modal', 'true');
  couche.setAttribute('aria-labelledby', `${ID_SURCOUCHE}-titre`);
  /* Styles EN LIGNE : la couche doit s'afficher même si une feuille de style
     est cassée, et elle ne doit hériter d'aucune règle de tableau/bannière. */
  Object.assign(couche.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',            // au-dessus de TOUT, y compris les bonus de l'ERP
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'rgba(15, 23, 42, 0.94)',
    color: '#f8fafc',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    textAlign: 'center',
    boxSizing: 'border-box'
  });

  couche.innerHTML = `
    <div style="max-width:520px;width:100%">
      <div style="width:56px;height:56px;margin:0 auto 18px;border-radius:50%;
                  border:3px solid #f59e0b;display:flex;align-items:center;
                  justify-content:center;font-size:28px">!</div>
      <h2 id="${ID_SURCOUCHE}-titre" style="margin:0 0 10px;font-size:20px;font-weight:700;color:#fff">
        Accès non autorisé
      </h2>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#cbd5e1">
        L'inspection du code de SKYS ERP Solution est interdite.
      </p>
      <p style="margin:0 0 20px;font-size:12.5px;line-height:1.6;color:#94a3b8">
        Cette tentative a été enregistrée sur votre compte et signalée à
        l'administrateur. Vos données ne sont pas modifiées.
      </p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button type="button" data-action="continuer"
          style="background:#0284c7;color:#fff;border:none;padding:10px 18px;
                 border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
          J'ai compris
        </button>
        <button type="button" data-action="quitter"
          style="background:transparent;color:#cbd5e1;border:1px solid #475569;
                 padding:10px 18px;border-radius:8px;font-size:13px;cursor:pointer">
          Fermer l'onglet
        </button>
      </div>
    </div>
  `;

  couche.querySelector('[data-action="continuer"]').addEventListener('click', () => {
    retirerSurcouche();
  });

  couche.querySelector('[data-action="quitter"]').addEventListener('click', () => {
    /* `window.close()` ne fonctionne que sur un onglet ouvert par script ;
       sinon on masque la page par prudence, sans détruire l'état React. */
    window.close();
    const coucheActuelle = document.getElementById(ID_SURCOUCHE);
    if (coucheActuelle) coucheActuelle.style.display = 'none';
  });

  document.body.appendChild(couche);
  return couche;
};

/** Retire la couche (l'application reste intacte dessous). */
export const retirerSurcouche = () => {
  if (minuteurAffichage) {
    window.clearTimeout(minuteurAffichage);
    minuteurAffichage = null;
  }
  document.getElementById(ID_SURCOUCHE)?.remove();
};

/**
 * Affiche l'alerte.
 * @param {object} options
 * @param {boolean} options.definitif  ajoute un compte à rebours avant fermeture
 */
export const afficherAlerteInspection = ({ definitif = false } = {}) => {
  if (typeof document === 'undefined' || !document.body) return;
  if (Date.now() - derniereAlerte < DELAI_ENTRE_ALERTES_MS && document.getElementById(ID_SURCOUCHE)) return;

  derniereAlerte = Date.now();
  if (minuteurAffichage) window.clearTimeout(minuteurAffichage);
  minuteurAffichage = window.setTimeout(() => {
    minuteurAffichage = null;
    const couche = creerSurcouche();
    if (!definitif || couche.dataset.compte) return;

    /* Compte à rebours : informatif, jamais bloquant. */
    couche.dataset.compte = '1';
    const bouton = couche.querySelector('[data-action="continuer"]');
    let restant = Math.round(DELAI_VERROU_MS / 1000);
    const libelleInitial = bouton.textContent;
    bouton.disabled = true;
    bouton.style.opacity = '0.6';
    bouton.style.cursor = 'not-allowed';
    bouton.textContent = `${libelleInitial} (${restant} s)`;
    const minuteur = window.setInterval(() => {
      restant -= 1;
      if (restant <= 0) {
        window.clearInterval(minuteur);
        bouton.disabled = false;
        bouton.style.opacity = '1';
        bouton.style.cursor = 'pointer';
        bouton.textContent = libelleInitial;
        return;
      }
      bouton.textContent = `${libelleInitial} (${restant} s)`;
    }, 1000);
  }, DELAI_AVANT_AFFICHAGE_MS);
};

export default afficherAlerteInspection;
