const mongoose = require('mongoose');

/**
 * COLLECTION : utilisateurs
 * Comptes d'accès au sein d'une entreprise (tenant).
 * Le rôle détermine les modules autorisés (voir MODULES_AUTORISES_PAR_ROLE
 * côté frontend) ; le companyId détermine l'isolation des données.
 */
const utilisateurSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },

    nom: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Adresse email invalide.']
    },

    // Empreinte SHA-256 du mot de passe : le mot de passe en clair
    // n'est JAMAIS stocké en base.
    motDePasseHash: { type: String, required: true },

    role: {
      type: String,
      enum: ['Administrateur', 'Caissier', 'Magasinier'],
      default: 'Caissier'
    },

    // Verrouillage après N échecs de connexion.
    tentativesEchouees: { type: Number, default: 0, min: 0 },
    bloque: { type: Boolean, default: false },
    bloqueJusqua: { type: Date, default: null },
    derniereConnexion: { type: Date, default: null },
    reinitialisationHash: { type: String, default: null, select: false },
    reinitialisationExpire: { type: Date, default: null, select: false },

    actif: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'utilisateurs' }
);

// Un email est unique PAR ENTREPRISE (deux entreprises peuvent avoir
// le même contact), ce qui passe par un index composé.
utilisateurSchema.index({ companyId: 1, email: 1 }, { unique: true });
utilisateurSchema.index({ email: 1 });

module.exports = mongoose.model('Utilisateur', utilisateurSchema);
