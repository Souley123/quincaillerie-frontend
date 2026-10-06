const mongoose = require('mongoose');

/**
 * COLLECTION : abonnements
 * Paliers d'abonnement SKYS ERP Solution (Essai, Standard, Pro, Enterprise, Transport).
 */
const abonnementSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    utilisateur: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },

    palier: {
      type: String,
      enum: ['Essai', 'Standard', 'Pro', 'Enterprise', 'Transport'],
      default: 'Essai'
    },

    prix: { type: Number, default: 0, min: 0 },
    devise: { type: String, default: 'FCFA' },
    periode: { type: String, enum: ['mensuel', 'annuel'], default: 'mensuel' },

    moyenPaiement: { type: String, default: 'Mobile Money' },
    referenceTransaction: { type: String, default: '' },

    debut: { type: Date, default: Date.now },
    echeance: { type: Date, required: true },
    actif: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'abonnements' }
);

abonnementSchema.index({ companyId: 1, email: 1, actif: 1 });

/* Calcule la date d'echeance (1 mois par defaut). */
abonnementSchema.pre('validate', function(next) {
  if (!this.echeance) {
    const debut = this.debut || new Date();
    const echeance = new Date(debut);
    if (this.periode === 'annuel') {
      echeance.setFullYear(echeance.getFullYear() + 1);
    } else {
      echeance.setMonth(echeance.getMonth() + 1);
    }
    this.echeance = echeance;
  }
  next();
});

module.exports = mongoose.model('Abonnement', abonnementSchema);