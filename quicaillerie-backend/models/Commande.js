const mongoose = require('mongoose');

/**
 * COLLECTION : commandes
 * Bons de commande fournisseurs (générés par le réapprovisionnement).
 */
const commandeSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    reference: { type: String, required: true, unique: true },

    fournisseur: { type: String, required: true, trim: true },
    fournisseurId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fournisseur', default: null },

    produits: {
      type: [{
        produitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        ref: { type: String, required: true },
        nom: { type: String, default: '' },
        quantite: { type: Number, required: true, min: 1 },
        prixAchat: { type: Number, default: 0, min: 0 }
      }],
      validate: {
        validator: items => Array.isArray(items) && items.length > 0,
        message: 'Une commande doit contenir au moins un produit.'
      }
    },

    montantTotal: { type: Number, default: 0, min: 0 },

    mode: { type: String, enum: ['Manuelle', 'Automatique', 'Pré-remplie'], default: 'Manuelle' },
    statut: { type: String, enum: ['À commander', 'Commandée', 'Réceptionnée', 'Annulée'], default: 'À commander' },

    depot: { type: String, default: 'Dépôt Principal' },
    date: { type: Date, default: Date.now },
    dateReception: { type: Date, default: null },
    commentaire: { type: String, trim: true, default: '' }
  },
  { timestamps: true, collection: 'commandes' }
);

commandeSchema.index({ companyId: 1, statut: 1, date: -1 });

module.exports = mongoose.model('Commande', commandeSchema);