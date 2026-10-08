const mongoose = require('mongoose');

/**
 * TRANSACTIONS DE PAIEMENT
 * ------------------------------------------------------------
 * Trace chaque paiement en ligne (Kkiapay) et son état de vérification.
 * Le backend est seul habilité à marquer une transaction « payee » après
 * vérification auprès du prestataire : le frontend ne peut jamais le faire.
 *
 * Deux natures de paiement coexistent, volontairement séparées :
 *   - 'vente'       : le client paie le COMMERÇANT (argent au commerçant) ;
 *   - 'abonnement'  : le commerçant paie l'ÉDITEUR (argent au développeur).
 */
const transactionSchema = new mongoose.Schema(
  {
    // Isolation multi-tenant : toujours filtrer par companyId.
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    nature: {
      type: String,
      enum: ['vente', 'abonnement'],
      required: true,
      index: true
    },

    // Référence unique Kkiapay (transactionId) — clé d'idempotence.
    reference: { type: String, required: true, index: true },

    montant: { type: Number, required: true, min: 0 },
    devise: { type: String, default: 'XOF' },

    // Bénéficiaire du paiement (commerçant ou éditeur).
    beneficiaire: {
      type: String,
      enum: ['commerçant', 'développeur'],
      required: true
    },

    // Compte qui a encaissé (clé publique utilisée côté client).
    compteEncaissement: { type: String, default: '' },

    statut: {
      type: String,
      enum: ['en_attente', 'payee', 'echouee', 'falsifiee'],
      default: 'en_attente',
      index: true
    },

    moyenPaiement: { type: String, default: 'Kkiapay' },

    // Réponse brute du prestataire, conservée pour audit.
    preuveVerification: { type: Object, default: {} },

    verifieLe: { type: Date, default: null },

    // Détection d'anomalie (montant modifié, référence inconnue…).
    alerteSecurite: { type: String, default: '' }
  },
  { timestamps: true, collection: 'transactions' }
);

// Une même référence Kkiapay ne peut être enregistrée qu'une fois :
// empêche le rejeu d'un paiement pour valider plusieurs ventes.
transactionSchema.index({ companyId: 1, reference: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', transactionSchema);
