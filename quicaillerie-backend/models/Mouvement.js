const mongoose = require('mongoose');

/**
 * COLLECTION : mouvements
 * Journal des entrées / sorties de stock (traçabilité).
 */
const mouvementSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    type: {
      type: String,
      enum: ['ENTREE', 'SORTIE', 'ACHAT', 'RECEPTION', 'INVENTAIRE', 'TRANSFERT', 'ANNULATION'],
      required: true
    },

    produitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    ref: { type: String, required: true },
    nom: { type: String, default: '' },

    quantite: { type: Number, required: true, min: 0 },
    stockAvant: { type: Number, default: 0 },
    stockApres: { type: Number, default: 0 },

    motif: { type: String, trim: true, default: '' },
    depot: { type: String, default: 'Dépôt Principal' },
    operateur: { type: String, default: '' },

    venteReference: { type: String, default: '' },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'mouvements' }
);

mouvementSchema.index({ companyId: 1, date: -1 });
mouvementSchema.index({ companyId: 1, ref: 1, date: -1 });

module.exports = mongoose.model('Mouvement', mouvementSchema);