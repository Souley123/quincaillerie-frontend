/**
 * STOCKAGE ISOLÉ PAR COMPTE
 * ------------------------------------------------------------
 * Chaque entreprise (companyId) et chaque utilisateur (email) dispose de
 * son propre espace de stockage local. Deux comptes différents sur le même
 * navigateur ne partagent donc JAMAIS leurs données.
 *
 * Clé finale : `skys_<companyId>__<email>__<cle>`.
 * Pour l'utilisateur non connecté (mode démo), on utilise `demo__demo`.
 *
 * IMPORTANT : ce stockage local n'est qu'un confort hors-ligne. La vérité
 * reste le backend, qui filtre déjà toutes les données par companyId.
 */

const PREFIXE = 'skys';
const SEPARATEUR = '__';

/** Identité courante, lue depuis la session enregistrée. */
const lireIdentite = () => {
  try {
    const brut = localStorage.getItem('skys_erp_entreprise');
    if (!brut) return null;
    const session = JSON.parse(brut);
    const companyId = session?.entreprise?.companyId || '';
    const email = session?.utilisateur?.email || '';
    if (!companyId) return null;
    return { companyId: String(companyId).toLowerCase(), email: String(email).toLowerCase() };
  } catch {
    return null;
  }
};

/**
 * Construit le préfixe d'isolation. Sans session (mode démo), on retombe sur
 * un espace `demo` commun à l'appareil, volontairement séparé des comptes.
 */
export const prefixeCompte = () => {
  const identite = lireIdentite();
  if (!identite) return `${PREFIXE}${SEPARATEUR}demo${SEPARATEUR}demo${SEPARATEUR}`;
  return `${PREFIXE}${SEPARATEUR}${identite.companyId}${SEPARATEUR}${identite.email}${SEPARATEUR}`;
};

/** Construit la clé de stockage isolée pour une donnée donnée. */
export const cleIsolee = cle => `${prefixeCompte()}${cle}`;

/** Lit une donnée dans l'espace du compte courant. */
export const lire = (cle, secours) => {
  try {
    const valeur = localStorage.getItem(cleIsolee(cle));
    return valeur === null ? secours : JSON.parse(valeur);
  } catch {
    return secours;
  }
};

/** Écrit une donnée dans l'espace du compte courant. */
export const ecrire = (cle, valeur) => {
  try {
    localStorage.setItem(cleIsolee(cle), JSON.stringify(valeur));
    return true;
  } catch (error) {
    console.warn(`Persistance locale indisponible pour ${cle}:`, error);
    return false;
  }
};

/**
 * Supprime TOUTES les données locales du compte courant (et uniquement
 * les siennes) : utilisé à la déconnexion pour éviter toute fuite d'un
 * compte vers un autre.
 */
export const effacerDonneesCompte = () => {
  try {
    const prefixe = prefixeCompte();
    const aSupprimer = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const cle = localStorage.key(i);
      if (cle && cle.startsWith(prefixe)) aSupprimer.push(cle);
    }
    aSupprimer.forEach(cle => localStorage.removeItem(cle));
    return aSupprimer.length;
  } catch {
    return 0;
  }
};

/**
 * Migration douce : recopie les anciennes clés non isolées (`skys_demo_x`)
 * vers l'espace du compte courant, une seule fois, puis les supprime pour
 * ne plus jamais exposer les données à un autre compte.
 */
export const migrerAnciennesCles = cles => {
  try {
    let migrees = 0;
    cles.forEach(cle => {
      const ancienne = localStorage.getItem(`skys_demo_${cle}`);
      if (ancienne !== null) {
        const cible = cleIsolee(cle);
        if (localStorage.getItem(cible) === null) {
          localStorage.setItem(cible, ancienne);
          migrees += 1;
        }
        // On retire la clé partagée : elle ne doit plus servir à personne.
        localStorage.removeItem(`skys_demo_${cle}`);
      }
    });
    return migrees;
  } catch {
    return 0;
  }
};

const stockageCompte = {
  cleIsolee,
  prefixeCompte,
  lire,
  ecrire,
  effacerDonneesCompte,
  migrerAnciennesCles
};

export default stockageCompte;
