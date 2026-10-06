const mongoose = require('mongoose');

/**
 * COLLECTION : depenses
 * Charges et dépenses de l'entreprise (module Dépenses & Charges).
 */
const depenseSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    libelle: { type: String, required: true, trim: true },
    montant: { type: Number, required: true, min: 0 },

    categorie: { type: String, enum: ['Fixe', 'Variable'], default: 'Fixe' },
    date: { type: Date, default: Date.now },

    actif: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'depenses' }
);

depenseSchema.index({ companyId: 1, date: -1 });

module.exports = mongoose.model('Depense', depenseSchema);
