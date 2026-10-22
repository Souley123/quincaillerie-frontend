const mongoose = require('mongoose');

/**
 * COLLECTION : categories
 * Référentiel des catégories (ex. « Outillage manuel ») et de leurs
 * sous-catégories (ex. « À main »), propre à chaque entreprise.
 *
 * Pourquoi au serveur et plus dans le navigateur : le référentiel était
 * stocké dans le localStorage, donc invisible depuis un autre poste ou un
 * autre navigateur, alors que les ARTICLES (collection products) sont, eux,
 * partagés. Un article pouvait ainsi être rattaché à une catégorie que
 * personne d'autre ne voyait.
 *
 * Les articles référencent la catégorie par son NOM (product.famille) et la
 * sous-catégorie par son nom (product.sousCategorie) : ce modèle reste donc
 * la seule source de vérité pour les listes et les garde-fous de suppression.
 */
const sousCategorieSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' }
  },
  { _id: true }
);

const categorieSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, uppercase: true, trim: true, index: true },

    nom: { type: String, required: true, trim: true },
    /* Forme normalisée (minuscules, sans accents) : c'est la clé de
       comparaison utilisée par l'interface. La calculer ICI évite que
       « Matelas », « matelas » et « Matélas » créent trois catégories. */
    nomNormalise: { type: String, required: true, index: true },
    description: { type: String, trim: true, default: '' },

    sousCategories: { type: [sousCategorieSchema], default: [] }
  },
  { timestamps: true, collection: 'categories' }
);

// Une seule catégorie par nom normalisé et par entreprise.
categorieSchema.index({ companyId: 1, nomNormalise: 1 }, { unique: true });

module.exports = mongoose.model('Categorie', categorieSchema);
