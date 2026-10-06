const mongoose = require('mongoose');

/**
 * COLLECTION : transports
 * Expéditions / livraisons planifiées (module Transport & Logistique).
 */
const transportSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    nomResponsable: { type: String, required: true, trim: true },
    prenomsResponsable: { type: String, trim: true, default: '' },

    vehicule: { type: String, trim: true, default: '' },
    immatriculation: { type: String, trim: true, uppercase: true, default: '' },

    nombreVoyage: { type: Number, default: 1, min: 1 },

    destination: { type: String, trim: true, default: '' },
    client: { type: String, trim: true, default: '' },

    frais: { type: Number, default: 0, min: 0 },
    commentaires: { type: String, trim: true, default: '' },

    date: { type: Date, default: Date.now },
    actif: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'transports' }
);

transportSchema.index({ companyId: 1, date: -1 });

module.exports = mongoose.model('Transport', transportSchema);
