/**
 * PAIEMENTS — DISTINCTION COMMERÇANT / DÉVELOPPEUR
 * ------------------------------------------------------------
 * L'application gère DEUX flux de paiement totalement différents :
 *
 *  1. PAIEMENT DE VENTE (commerçant)
 *     Le client final paie un article au commerçant (boutique, quincaillerie,
 *     vendeur de gaz…). L'argent doit aller sur LE COMPTE DU COMMERÇANT.
 *     → chaque administrateur renseigne ses propres références de paiement
 *       (Mobile Money, compte bancaire, clé Kkiapay de son entreprise).
 *
 *  2. PAIEMENT D'ABONNEMENT (développeur)
 *     Le commerçant paie son abonnement à la plateforme SKYS ERP Solution.
 *     L'argent doit aller sur LE COMPTE DU DÉVELOPPEUR.
 *     → références fixes, définies par l'éditeur de l'application.
 *
 * Les références du développeur sont RÉSERVÉES : un commerçant ne peut ni
 * les voir ni les modifier. Celles du commerçant sont isolées par compte
 * et stockées dans son espace (aucun autre compte ne les voit).
 */

const CLE_COMMERCANT = 'erp_paiement_commercant';

/* ------------------------------------------------------------------
   RÉFÉRENCES DU DÉVELOPPEUR (éditeur de SKYS ERP Solution)
   Ces coordonnées reçoivent les ABONNEMENTS. Elles sont figées ici et
   ne sont jamais exposées aux administrateurs clients.
   ------------------------------------------------------------------ */
export const COMPTE_DEVELOPPEUR = {
  operateur: 'SKYS ERP Solution',
  kkiapayClePublique: 'dd07f3b0f51c11efa1b7dd84e0e85289',
  // Kkiapay distingue clé publique (widget) et clé secrète (API) :
  // la clé secrète ne doit JAMAIS être dans le frontend, elle vit côté serveur.
  kkiapayClePubliqueDev: '',
  mobileMoney: {
    orange: '',
    mtn: '',
    moov: '',
    wave: ''
  },
  banque: {
    nom: '',
    iban: '',
    swift: ''
  },
  email: 'contact@skys-erp.com',
  telephone: '',
  siteWeb: 'https://skys-erp.com'
};

/* ------------------------------------------------------------------
   RÉFÉRENCES PAR DÉFAUT DU COMMERÇANT (vides : à renseigner)
   ------------------------------------------------------------------ */
export const PAIEMENT_COMMERCANT_PAR_DEFAUT = {
  nomBeneficiaire: '',
  kkiapayClePublique: '',
  mobileMoney: {
    orange: '',
    mtn: '',
    moov: '',
    wave: ''
  },
  banque: {
    nom: '',
    iban: '',
    swift: ''
  },
  // Comportement du paiement en ligne pour les ventes.
  accepterCarteEnLigne: false,
  accepterMobileMoney: true,
  accepterEspeces: true,
  instructions: ''
};

/**
 * Vérifie que le commerçant a bien renseigné ses références de paiement.
 * Renvoie la liste des manques (vide si tout est prêt).
 */
export const verifierReferencesCommercant = (refs = {}) => {
  const manquants = [];
  if (!refs.nomBeneficiaire) manquants.push('Nom du bénéficiaire');
  const mm = refs.mobileMoney || {};
  const aMobileMoney = [mm.orange, mm.mtn, mm.moov, mm.wave].some(v => v && String(v).trim());
  const aBanque = refs.banque?.iban;
  const aKkiapay = refs.kkiapayClePublique;

  if (!aMobileMoney && !aBanque && !aKkiapay) {
    manquants.push('Au moins un moyen de paiement (Mobile Money, banque ou clé Kkiapay)');
  }
  return manquants;
};

/**
 * Indique si un paiement de vente en ligne est possible (le commerçant a
 * fourni sa propre clé). Sinon, il faut encaisser en espèces.
 */
export const venteEnLignePossible = (refs = {}) =>
  Boolean(refs.kkiapayClePublique) && refs.accepterCarteEnLigne !== false;

/**
 * Construit la configuration du widget Kkiapay pour une VENTE au commerçant.
 * @param {object} refs  références du commerçant
 * @param {number} montant
 */
export const configKkiapayVente = (refs, montant) => ({
  cle: refs?.kkiapayClePublique || '',
  montant: Number(montant) || 0,
  destinataire: 'commerçant',
  beneficiaire: refs?.nomBeneficiaire || ''
});

/**
 * Construit la configuration du widget Kkiapay pour un ABONNEMENT au
 * développeur. La clé du développeur n'est jamais modifiable par le client.
 */
export const configKkiapayAbonnement = montant => ({
  cle: COMPTE_DEVELOPPEUR.kkiapayClePublique,
  montant: Number(montant) || 0,
  destinataire: 'développeur',
  beneficiaire: COMPTE_DEVELOPPEUR.operateur
});

/** Résume lisiblement les moyens de paiement d'un commerçant. */
export const resumerPaiementsCommercant = (refs = {}) => {
  const moyens = [];
  const mm = refs.mobileMoney || {};
  if (mm.orange) moyens.push(`Orange Money : ${mm.orange}`);
  if (mm.mtn) moyens.push(`MTN MoMo : ${mm.mtn}`);
  if (mm.moov) moyens.push(`Moov Money : ${mm.moov}`);
  if (mm.wave) moyens.push(`Wave : ${mm.wave}`);
  if (refs.banque?.iban) moyens.push(`Banque : ${refs.banque.nom || '—'} (${refs.banque.iban})`);
  if (refs.kkiapayClePublique) moyens.push('Carte bancaire en ligne (Kkiapay)');
  return moyens;
};

export const CLE_REFERENCES_COMMERCANT = CLE_COMMERCANT;

const paiements = {
  COMPTE_DEVELOPPEUR,
  PAIEMENT_COMMERCANT_PAR_DEFAUT,
  CLE_REFERENCES_COMMERCANT,
  verifierReferencesCommercant,
  venteEnLignePossible,
  configKkiapayVente,
  configKkiapayAbonnement,
  resumerPaiementsCommercant
};

export default paiements;
