const mongoose = require('mongoose');

/**
 * COLLECTION : ventes
 * Chaque passage en caisse. Les lignes de vente figent le prix au moment
 * de l encaissement, meme si le catalogue change ensuite.
 */
const ligneVenteSchema = new mongoose.Schema(
  {
    produitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    ref: { type: String, required: true },
    nom: { type: String, required: true },
    quantite: { type: Number, required: true, min: 1 },
    prixUnitaire: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const venteSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    reference: { type: String, required: true, unique: true },

    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    clientNom: { type: String, default: 'Client Comptoir' },

    lignes: {
      type: [ligneVenteSchema],
      validate: {
        validator: lignes => Array.isArray(lignes) && lignes.length > 0,
        message: 'Une vente doit contenir au moins une ligne.'
      }
    },

    sousTotal: { type: Number, required: true, min: 0, default: 0 },
    remise: { type: Number, default: 0, min: 0 },
    tva: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },

    moyenPaiement: { type: String, default: 'Especes' },
    operateur: { type: String, default: '' },
    depot: { type: String, default: 'Dépôt Principal' },

    statut: { type: String, enum: ['Enregistree', 'Annulee'], default: 'Enregistree' },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'ventes' }
);

venteSchema.index({ companyId: 1, date: -1 });
venteSchema.index({ companyId: 1, clientId: 1 });

module.exports = mongoose.model('Vente', venteSchema);