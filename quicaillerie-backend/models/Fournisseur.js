const mongoose = require('mongoose');

/**
 * COLLECTION : fournisseurs
 * Fournisseurs référencés par les articles du catalogue.
 */
const fournisseurSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    nom: { type: String, required: true, trim: true },
    contact: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    telephone: { type: String, trim: true, default: '' },

    adresse: { type: String, trim: true, default: '' },
    ville: { type: String, trim: true, default: 'Abidjan' },

    delaiLivraisonJours: { type: Number, default: 7, min: 0 },
    actif: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'fournisseurs' }
);

// Un nom de fournisseur est unique PAR ENTREPRISE.
fournisseurSchema.index({ companyId: 1, nom: 1 }, { unique: true });

module.exports = mongoose.model('Fournisseur', fournisseurSchema);