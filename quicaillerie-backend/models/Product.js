const mongoose = require('mongoose');

/**
 * COLLECTION : products
 * Catalogue de la quincaillerie (vis, prises, marteaux, ciment...).
 */
const productSchema = new mongoose.Schema(
  {
    // Clé d'isolation multi-tenant : présente sur TOUTES les collections
    // métier. Aucune lecture ne doit se faire sans ce filtre.
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    ref: { type: String, required: true, trim: true, uppercase: true },
    nom: { type: String, required: true, trim: true },
    codeBarre: { type: String, trim: true, default: '' },
    famille: { type: String, required: true },
    fournisseur: { type: String, trim: true, default: '' },

    prixAchat: { type: Number, required: true, min: 0, default: 0 },
    prix: { type: Number, required: true, min: 0 },

    quantiteStock: { type: Number, required: true, min: 0, default: 0 },
    minStock: { type: Number, min: 0, default: 0 },
    maxStock: { type: Number, min: 0, default: 0 },

    depot: { type: String, default: 'Dépôt Principal' },
    zone: { type: String, default: 'Zone A' },
    classe: { type: String, default: 'Classe A' },

    actif: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'products' }
);

// La référence doit être unique PAR ENTREPRISE : deux quincailleries
// peuvent utiliser la même référence article sans conflit.
productSchema.index({ companyId: 1, ref: 1 }, { unique: true });
productSchema.index({ companyId: 1, codeBarre: 1 });
productSchema.index({ companyId: 1, nom: 1 });
productSchema.index({ nom: 'text', famille: 'text' });

module.exports = mongoose.model('Product', productSchema);