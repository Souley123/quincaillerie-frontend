const mongoose = require('mongoose');

/**
 * COLLECTION : clients
 * Coordonnées et localisation des clients / entreprises.
 */
const clientSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    nom: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    telephone: { type: String, trim: true, default: '' },
    // Accès dédié au portail client ; le hash n'est jamais renvoyé par défaut.
    motDePassePortailHash: { type: String, select: false, default: null },
    comptePortailActif: { type: Boolean, default: false },
    reinitialisationPortailHash: { type: String, select: false, default: null },
    reinitialisationPortailExpire: { type: Date, select: false, default: null },

    region: { type: String, trim: true, default: 'Lagunes' },
    ville: { type: String, trim: true, default: 'Abidjan' },
    district: { type: String, trim: true, default: '' },

    // Encours : dette totale du client, mise à jour par le module Crédits
    soldeDu: { type: Number, default: 0, min: 0 },

    actif: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'clients' }
);

clientSchema.index({ companyId: 1, nom: 1 });
clientSchema.index({ nom: 'text', telephone: 'text', email: 'text' });

module.exports = mongoose.model('Client', clientSchema);