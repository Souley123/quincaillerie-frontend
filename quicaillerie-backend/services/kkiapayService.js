const crypto = require('crypto');

/**
 * SERVICE KKIAPAY — VÉRIFICATION SERVEUR
 * ------------------------------------------------------------
 * Le frontend ne fait qu'OUVRIR le widget de paiement. La confirmation
 * réelle (« ce paiement a-t-il été encaissé ? ») est TOUJOURS vérifiée
 * ici, côté serveur, auprès de l'API Kkiapay.
 *
 * La clé SECRÈTE ne quitte jamais le serveur : elle vit dans les variables
 * d'environnement (KKIAPAY_SECRET, KKIAPAY_PUBLIC, KKIAPAY_PRIVATE).
 *
 * Sans ces variables, la vérification échoue volontairement : mieux vaut
 * refuser une vente que d'enregistrer un paiement non prouvé.
 */

const BASE_API = process.env.KKIAPAY_BASE_URL || 'https://api.kkiapay.me';

/** Les secrets sont-ils configurés ? */
const estConfigure = () => Boolean(process.env.KKIAPAY_SECRET && process.env.KKIAPAY_PUBLIC);

/**
 * Vérifie une transaction auprès de Kkiapay.
 * @param {string} transactionId  référence renvoyée par le widget
 * @returns {Promise<object|null>} la transaction si elle existe et est réussie
 */
const verifierTransaction = async transactionId => {
  if (!estConfigure() || !transactionId) return null;

  const entetes = {
    'x-public-key': process.env.KKIAPAY_PUBLIC,
    'x-secret-key': process.env.KKIAPAY_SECRET,
    'x-api-key': process.env.KKIAPAY_PRIVATE || process.env.KKIAPAY_SECRET,
    Accept: 'application/json'
  };

  // Plusieurs chemins existent selon l'offre Kkiapay : on tente les deux.
  const chemins = [
    `${BASE_API}/api/v1/transactions/status/${encodeURIComponent(transactionId)}`,
    `${BASE_API}/api/v1/transactions/${encodeURIComponent(transactionId)}`
  ];

  for (const url of chemins) {
    try {
      const reponse = await fetch(url, { method: 'GET', headers: entetes });
      if (!reponse.ok) continue;
      const donnees = await reponse.json();
      if (donnees && (donnees.transactionId || donnees.id || donnees.status || donnees.state)) {
        return donnees;
      }
    } catch (err) {
      console.error('Kkiapay : échec de vérification pour', transactionId, err.message);
    }
  }
  return null;
};

/**
 * La transaction est-elle considérée comme réussie ?
 * Kkiapay renvoie selon les versions : status: 'SUCCESS' | state: 'SUCCESS'.
 */
const estReussie = transaction => {
  if (!transaction) return false;
  const etat = String(transaction.status || transaction.state || '').toUpperCase();
  return ['SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED'].includes(etat);
};

/** Montant réellement encaissé, quelle que soit la forme de la réponse. */
const montantDe = transaction => {
  if (!transaction) return 0;
  return Number(transaction.amount ?? transaction.montant ?? transaction.total ?? 0) || 0;
};

/**
 * Signature d'idempotence : évite qu'une même référence serve à valider
 * deux ventes. Renvoie un identifiant stable et non réversible.
 */
const empreinteReference = (companyId, transactionId) =>
  crypto.createHash('sha256')
    .update(`${String(companyId).toUpperCase()}|${String(transactionId)}`)
    .digest('hex');

module.exports = {
  verifierTransaction,
  estReussie,
  montantDe,
  empreinteReference,
  estConfigure
};
