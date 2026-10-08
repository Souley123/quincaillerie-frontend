/**
 * MENTIONS LÉGALES — CONFORMITÉ CÔTE D'IVOIRE
 * ------------------------------------------------------------
 * Regroupe les informations obligatoires que doit porter une facture ou
 * un reçu en Côte d'Ivoire, d'après :
 *   - le Code général des Impôts (CGI) ivoirien ;
 *   - les obligations de facturation de la Direction Générale des Impôts (DGI) ;
 *   - la loi sur la société de l'information et le commerce électronique
 *     (loi n° 2013-450) pour les mentions électroniques.
 *
 * Mentions obligatoires sur une facture ivoirienne :
 *   1. Nom et raison sociale du vendeur ;
 *   2. Adresse complète du vendeur ;
 *   3. Numéro de Compte Contribuable (NCC) ;
 *   4. Numéro RCCM (Registre du Commerce et du Crédit Mobilier) ;
 *   5. Régime d'imposition (Réel Normal, Réel Simplifié, TEE) ;
 *   6. Numéro de facture séquentiel et date ;
 *   7. Identité et adresse du client ;
 *   8. Détail des articles/services, quantités, prix unitaires HT ;
 *   9. Taux et montant de la TVA (18 %, 9 % ou 0 %) ;
 *  10. Montants HT, TVA et TTC ;
 *  11. Mode de règlement et conditions de paiement.
 *
 * Ce fichier ne fournit que les textes et la validation : l'affichage se
 * fait dans les documents imprimables de l'application.
 */

export const DEVISE_DEFAUT = 'FCFA';

/* Taux de TVA applicables en Côte d'Ivoire (CGI ivoirien). */
export const TAUX_TVA_CI = [
  { valeur: 0, libelle: '0 % — Exonéré / Exportation' },
  { valeur: 9, libelle: '9 % — Taux réduit (produits de large consommation)' },
  { valeur: 18, libelle: '18 % — Taux normal' }
];

/* Régimes d'imposition reconnus par la DGI. */
export const REGIMES_FISCAUX_CI = [
  'Réel Normal',
  'Réel Simplifié',
  'Taxe d\'État de l\'Entreprenant (TEE)',
  'Contribution des Micro-entreprises (CME)',
  'Non assujetti'
];

/**
 * Informations légales par défaut de l'entreprise. Elles sont modifiables
 * dans Configuration → « Paramètres Généraux » et « Personnalisation du reçu ».
 */
export const MENTIONS_LEGALES_PAR_DEFAUT = {
  ncc: '',                       // Numéro de Compte Contribuable
  rccm: '',                      // Registre du Commerce et du Crédit Mobilier
  regimeFiscal: 'Réel Normal',
  ville: 'Abidjan',
  pays: "Côte d'Ivoire",
  telephoneFixe: '',
  siteWeb: '',
  capitalSocial: '',
  // Mention d'exonération éventuelle (obligatoire si TVA = 0).
  mentionExoneration: '',
  // Clause de réserve de propriété (usage commercial courant en CI).
  clauseReservePropriete:
    'Les marchandises vendues restent la propriété du vendeur jusqu\'au paiement intégral du prix (loi n° 2013-450).',
  // Délai de réclamation sur facture.
  clauseReclamation:
    'Toute réclamation sur cette facture doit être formulée dans un délai de 8 jours à compter de sa date de réception.'
};

/**
 * Vérifie que les mentions obligatoires sont renseignées. Renvoie la liste
 * des champs manquants (vide si tout est conforme).
 */
export const verifierConformite = (entreprise = {}) => {
  const manquants = [];
  if (!entreprise.nomMagasin) manquants.push('Raison sociale');
  if (!entreprise.adresse) manquants.push('Adresse du vendeur');
  if (!entreprise.ncc) manquants.push('Numéro de Compte Contribuable (NCC)');
  if (!entreprise.rccm) manquants.push('Numéro RCCM');
  if (!entreprise.regimeFiscal) manquants.push('Régime d\'imposition');
  if (!entreprise.telephone) manquants.push('Téléphone');
  return manquants;
};

/**
 * Construit le bloc de mentions légales à afficher au bas d'un document.
 * @param {object} entreprise  informations du vendeur
 * @param {object} options
 * @param {boolean} options.avecTva  true si une TVA a été appliquée
 * @returns {string[]} lignes de texte, prêtes à afficher
 */
export const construireMentionsLegales = (entreprise = {}, { avecTva = false } = {}) => {
  const lignes = [];

  const identifiants = [];
  if (entreprise.rccm) identifiants.push(`RCCM : ${entreprise.rccm}`);
  if (entreprise.ncc) identifiants.push(`NCC : ${entreprise.ncc}`);
  if (entreprise.regimeFiscal) identifiants.push(`Régime : ${entreprise.regimeFiscal}`);
  if (identifiants.length) lignes.push(identifiants.join(' · '));

  const localisation = [];
  if (entreprise.adresse) localisation.push(entreprise.adresse);
  if (entreprise.ville) localisation.push(entreprise.ville);
  if (entreprise.pays) localisation.push(entreprise.pays);
  if (localisation.length) lignes.push(localisation.join(', '));

  const contacts = [];
  if (entreprise.telephone) contacts.push(`Tél : ${entreprise.telephone}`);
  if (entreprise.email) contacts.push(`Email : ${entreprise.email}`);
  if (entreprise.siteWeb) contacts.push(entreprise.siteWeb);
  if (contacts.length) lignes.push(contacts.join(' · '));

  if (!avecTva && entreprise.mentionExoneration) {
    lignes.push(entreprise.mentionExoneration);
  }

  if (entreprise.clauseReservePropriete) lignes.push(entreprise.clauseReservePropriete);
  if (entreprise.clauseReclamation) lignes.push(entreprise.clauseReclamation);

  return lignes;
};

/**
 * Génère un numéro de facture séquentiel conforme (exercice + rang).
 * Exemple : « FAC-2026-000123 ».
 */
export const numeroFacture = (compteur = 1, date = new Date()) => {
  const exercice = date.getFullYear();
  const rang = String(Math.max(1, Number(compteur) || 1)).padStart(6, '0');
  return `FAC-${exercice}-${rang}`;
};

/**
 * Textes d'information légale affichés à l'utilisateur lors de
 * l'inscription (consentement à l'utilisation des données).
 */
export const TEXTES_INSCRIPTION = {
  conditionsUtilisation:
    "J'accepte les conditions générales d'utilisation de SKYS ERP Solution et la politique de confidentialité, conformément à la loi ivoirienne n° 2013-450 relative aux transactions électroniques et à la loi n° 2013-451 relative à la lutte contre la cybercriminalité.",
  traitementDonnees:
    "J'autorise le traitement de mes données professionnelles aux fins de gestion de mon activité commerciale, conformément à la loi n° 2013-450. Ces données sont isolées par entreprise et ne sont jamais partagées avec d'autres comptes."
};

const mentionsLegales = {
  DEVISE_DEFAUT,
  TAUX_TVA_CI,
  REGIMES_FISCAUX_CI,
  MENTIONS_LEGALES_PAR_DEFAUT,
  verifierConformite,
  construireMentionsLegales,
  numeroFacture,
  TEXTES_INSCRIPTION
};

export default mentionsLegales;
