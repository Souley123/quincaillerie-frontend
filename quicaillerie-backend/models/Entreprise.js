const mongoose = require('mongoose');

/**
 * COLLECTION : entreprises
 * Tenant SKYS ERP Solution. Chaque acheteur de la licence dispose d'une ligne ici.
 * Le sous-domaine (slug) sert de route d'identification : l'utilisateur
 * se connecte sur client1.skyserp.com et l'API résout le tenant correspondant.
 */
const entrepriseSchema = new mongoose.Schema(
  {
    // Identifiant technique du tenant : c'est la clé company_id
    // présente dans TOUTES les collections métier.
    companyId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 32
    },

    // Sous-domaine d'accès : client1.skyserp.com
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]([a-z0-9-]{1,30})?$/, 'slug invalide (lettres, chiffres et tirets).']
    },

    // --- Profil entreprise (édition des documents) ---
    raisonSociale: { type: String, required: true, trim: true },
    nomCommercial: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
    adresse: { type: String, trim: true, default: '' },
    telephone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    nif: { type: String, trim: true, default: '' },

    // --- Paramètres de facturation / fiscalité ---
    devise: { type: String, default: 'FCFA', trim: true },
    tauxTva: { type: Number, default: 18, min: 0, max: 100 },

    // --- Abonnement rattaché à l'entreprise ---
    palier: {
      type: String,
      enum: ['Essai', 'Standard', 'Pro', 'Enterprise', 'Transport'],
      default: 'Essai'
    },
    abonnementActif: { type: Boolean, default: true },
    abonnementEcheance: { type: Date, default: null },

    actif: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'entreprises' }
);

// Index composé indispensable : la plupart des lectures filtrent par
// companyId puis trient par nom ou par date.
entrepriseSchema.index({ companyId: 1, raisonSociale: 1 });

module.exports = mongoose.model('Entreprise', entrepriseSchema);
