const Entreprise = require('../models/Entreprise');
const Utilisateur = require('../models/Utilisateur');
const crypto = require('crypto');
const {
  hacherMotDePasse,
  verifierMotDePasse,
  signer,
  besoinRehachage,
  verifierFactice
} = require('../services/authService');
const {
  authentifier,
  autoriserRoles,
  enregistrerEchecConnexion,
  enregistrerConnexionReussie
} = require('../middleware/tenant');

/**
 * CONTRÔLEUR : AUTHENTIFICATION & ONBOARDING
 * ------------------------------------------------------------
 * - login        : ouvre une session et renvoie un jeton signé
 *                  contenant le companyId.
 * - inscription  : onboarde un nouvel acheteur (profil entreprise +
 *                  compte administrateur client + abonnement).
 * - moi          : renvoie l'identité et l'entreprise courantes.
 * - utilisateurs : gestion des comptes d'une entreprise (réservé
 *                  à l'administrateur de cette entreprise).
 */

/* Durée de l'essai gratuit, en jours. Surchargeable par variable
   d'environnement, mais bornée (1 à 90) pour éviter toute erreur de saisie.
   Au-delà, l'accès est coupé automatiquement (middleware/tenant.js). */
const DUREE_ESSAI_JOURS = (() => {
  const valeur = Number(process.env.ESSAI_JOURS ?? 3);
  return Number.isFinite(valeur) && valeur >= 1 && valeur <= 90 ? valeur : 3;
})();

/**
 * Génère un mot de passe temporaire lisible (ex. « Skys-4f7a9c ») :
 * 8 caractères minimum, mélange de lettres et de chiffres. Il est
 * communiqué à l'employé, qui devra le changer à sa première connexion.
 */
const genererMotDePasseTemporaire = () => {
  const suffixe = crypto.randomBytes(16).toString('base64url');
  return `T9!${suffixe}a`;
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { slug, email, motDePasse } = req.body || {};

    if (typeof email !== 'string' || typeof motDePasse !== 'string' || email.length > 254 || motDePasse.length > 256) {
      return res.status(400).json({ error: 'Email ou mot de passe invalide.' });
    }

    if (!email.trim() || !motDePasse) {
      return res.status(400).json({ error: 'Email et mot de passe obligatoires.' });
    }

    // L'email suffit à retrouver l'utilisateur : il est unique par tenant.
    const utilisateur = await Utilisateur.findOne({
      email: String(email).toLowerCase().trim()
    });

    if (!utilisateur || !utilisateur.actif) {
      // Message volontairement générique : ne pas révéler si le compte existe.
      // Le coût PBKDF2 équivalent réduit aussi l'énumération par timing.
      verifierMotDePasse(motDePasse, verifierFactice());
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const entreprise = await Entreprise.findOne({ companyId: utilisateur.companyId });

    // Si un sous-domaine est fourni, il doit correspondre à l'entreprise
    // du compte : cela empêche de se connecter sur le mauvais tenant.
    if (!entreprise || (slug && entreprise.slug !== String(slug).toLowerCase().trim())) {
      verifierMotDePasse(motDePasse, verifierFactice());
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    if (utilisateur.bloque && utilisateur.bloqueJusqua?.getTime() > Date.now()) {
      return res.status(423).json({ error: 'Compte temporairement verrouillé. Réessayez plus tard.' });
    }

    if (!verifierMotDePasse(motDePasse, utilisateur.motDePasseHash)) {
      await enregistrerEchecConnexion(utilisateur);
      return res.status(utilisateur.bloque ? 423 : 401).json({
        error: utilisateur.bloque
          ? 'Compte temporairement verrouillé après plusieurs tentatives. Réessayez plus tard.'
          : 'Identifiants incorrects.'
      });
    }

    if (utilisateur.bloque) {
      return res.status(423).json({
        error: `Compte verrouillé jusqu'à ${utilisateur.bloqueJusqua?.toLocaleString('fr-FR')}.`
      });
    }

    // Compte bloqué après trop de réinitialisations : seul un administrateur
    // peut le débloquer. Le mot de passe correct ne suffit pas.
    if (utilisateur.bloqueReinitialisation) {
      return res.status(423).json({
        error:
          'Compte bloqué après plusieurs réinitialisations de mot de passe. Seul un administrateur peut le débloquer.'
      });
    }
    if (utilisateur.forcePasswordChange) {
      const jetonChangement = signer({
        companyId: utilisateur.companyId,
        email: utilisateur.email,
        role: utilisateur.role,
        id: String(utilisateur._id),
        forcePasswordChange: true,
        verrouillageVersion: utilisateur.verrouillageVersion || 0
      });
      return res.status(200).json({
        jeton: jetonChangement,
        utilisateur: {
          id: utilisateur._id,
          nom: utilisateur.nom,
          email: utilisateur.email,
          role: utilisateur.role,
          forcePasswordChange: true
        },
        entreprise: {
          companyId: entreprise.companyId,
          slug: entreprise.slug,
          raisonSociale: entreprise.raisonSociale
        }
      });
    }

    // Les mots de passe historiques peuvent être plus courts que la nouvelle
    // politique. Les laisser se connecter; la migration se fera lorsqu'ils
    // choisissent un secret conforme au changement de mot de passe.
    if (besoinRehachage(utilisateur.motDePasseHash) && motDePasse.length >= 12) {
      utilisateur.motDePasseHash = hacherMotDePasse(motDePasse);
    }
    await enregistrerConnexionReussie(utilisateur);

    /* Blocage automatique à l'échéance : même si le booléen abonnementActif est
       resté à true (montant non mis à jour), un essai/abonnement expiré doit
       interdire la connexion. Sans ce contrôle, l'accès resterait ouvert après
       la fin de la période d'essai tant qu'une requête authentifiée n'a pas eu
       lieu pour le détecter. */
    const echeanceDepassee = entreprise.abonnementEcheance
      && new Date(entreprise.abonnementEcheance).getTime() < Date.now();

    if (echeanceDepassee) {
      entreprise.abonnementActif = false;
      await entreprise.save().catch(() => {});
    }

    if (!entreprise.abonnementActif || echeanceDepassee) {
      return res.status(402).json({
        error: echeanceDepassee
          ? "Votre période d'essai ou d'abonnement est expirée. Merci de régulariser votre situation."
          : 'Abonnement inactif : merci de régulariser votre abonnement SKYS ERP Solution.'
      });
    }

    const jeton = signer({
      companyId: utilisateur.companyId,
      email: utilisateur.email,
      role: utilisateur.role,
      id: String(utilisateur._id),
      forcePasswordChange: Boolean(utilisateur.forcePasswordChange),
      verrouillageVersion: utilisateur.verrouillageVersion || 0
    });

    res.json({
      jeton,
      utilisateur: {
        id: utilisateur._id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
        forcePasswordChange: Boolean(utilisateur.forcePasswordChange)
      },
      entreprise: {
        companyId: entreprise.companyId,
        slug: entreprise.slug,
        raisonSociale: entreprise.raisonSociale,
        devise: entreprise.devise,
        tauxTva: entreprise.tauxTva,
        logoUrl: entreprise.logoUrl,
        palier: entreprise.palier
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/auth/moi → identité courante
const moi = async (req, res) => {
  res.json({
    utilisateur: {
      id: req.utilisateur._id,
      nom: req.utilisateur.nom,
      email: req.utilisateur.email,
      role: req.utilisateur.role
    },
    entreprise: {
      companyId: req.entreprise.companyId,
      slug: req.entreprise.slug,
      raisonSociale: req.entreprise.raisonSociale,
      devise: req.entreprise.devise,
      tauxTva: req.entreprise.tauxTva,
      logoUrl: req.entreprise.logoUrl,
      palier: req.entreprise.palier
    }
  });
};

// POST /api/auth/inscription
// Onboarding d'un nouvel acheteur : profil entreprise + compte
// administrateur client + activation de l'abonnement.
const inscription = async (req, res) => {
  try {
    const {
      raisonSociale, slug, email, motDePasse, nom,
      devise = 'FCFA', tauxTva = 18, logoUrl = '',
      palier = 'Essai', adresse = '', telephone = ''
    } = req.body || {};

    if (!raisonSociale || !slug || !email || !motDePasse) {
      return res.status(400).json({
        error: 'Raison sociale, sous-domaine, email et mot de passe sont obligatoires.'
      });
    }

    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }

    if (typeof motDePasse !== 'string' || motDePasse.length < 12 || motDePasse.length > 256) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir entre 12 et 256 caractères.'
      });
    }

    const slugNormalise = String(slug).toLowerCase().trim();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,30})$/.test(slugNormalise)) {
      return res.status(400).json({ error: 'Le sous-domaine est invalide.' });
    }

    const slugPris = await Entreprise.findOne({ slug: slugNormalise });
    if (slugPris) {
      return res.status(409).json({ error: `Le sous-domaine « ${slugNormalise} » est déjà utilisé.` });
    }

    // companyId dérivé du sous-domaine : lisible et unique.
    const companyId = slugNormalise.toUpperCase().replace(/-/g, '_');

    const entreprise = await Entreprise.create({
      companyId,
      slug: slugNormalise,
      raisonSociale,
      logoUrl,
      adresse,
      telephone,
      devise,
      tauxTva: Number(tauxTva) || 0,
      palier,
      abonnementActif: true,
      // Essai de 3 jours : l'accès est coupé automatiquement à l'échéance
      // (contrôlé à chaque requête dans middleware/tenant.js).
      abonnementEcheance: new Date(Date.now() + DUREE_ESSAI_JOURS * 24 * 60 * 60 * 1000)
    });

    const utilisateur = await Utilisateur.create({
      companyId,
      nom: nom || raisonSociale,
      email: String(email).toLowerCase().trim(),
      motDePasseHash: hacherMotDePasse(motDePasse),
      role: 'Administrateur'
    });

    const jeton = signer({
      companyId,
      email: utilisateur.email,
      role: utilisateur.role,
      id: String(utilisateur._id),
      forcePasswordChange: false,
      verrouillageVersion: utilisateur.verrouillageVersion || 0
    });

    res.status(201).json({
      jeton,
      entreprise,
      utilisateur: {
        id: utilisateur._id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role
      },
      acces: `https://${slugNormalise}.skyserp.com`
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ce sous-domaine ou cet email existe déjà.' });
    }
    res.status(400).json({ error: err.message });
  }
};

// GET /api/auth/utilisateurs → comptes de MON entreprise
const listerUtilisateurs = async (req, res) => {
  try {
    const utilisateurs = await Utilisateur.find({ companyId: req.entreprise.companyId })
      .select('-motDePasseHash')
      .sort({ nom: 1 });

    res.json(utilisateurs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/utilisateurs → créer un compte (Administrateur, Caissier, Magasinier)
const creerUtilisateur = async (req, res) => {
  try {
    const { nom, email, motDePasse, role = 'Caissier' } = req.body || {};
    const companyId = req.entreprise.companyId;

    if (typeof nom !== 'string' || !nom.trim() || nom.length > 120 ||
        typeof email !== 'string' || email.length > 254) {
      return res.status(400).json({ error: 'Nom ou email invalide.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }

    const doublon = await Utilisateur.findOne({
      companyId,
      email: String(email).toLowerCase().trim()
    });
    if (doublon) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé dans votre entreprise.' });
    }

    /* Si aucun mot de passe n'est fourni, en générer un temporaire. */
    if (motDePasse !== undefined && motDePasse !== '' &&
        (typeof motDePasse !== 'string' || motDePasse.length < 12 || motDePasse.length > 256)) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir entre 12 et 256 caractères.'
      });
    }

    const motDePasseFourni = typeof motDePasse === 'string' && motDePasse.length >= 12;
    const motDePasseTemporaire = motDePasseFourni ? null : genererMotDePasseTemporaire();
    const motDePasseFinal = motDePasseFourni ? motDePasse : motDePasseTemporaire;

    const utilisateur = await Utilisateur.create({
      companyId,
      nom,
      email: String(email).toLowerCase().trim(),
      motDePasseHash: hacherMotDePasse(motDePasseFinal),
      role,
      forcePasswordChange: !motDePasseFourni
    });

    res.status(201).json({
      id: utilisateur._id,
      nom: utilisateur.nom,
      email: utilisateur.email,
      role: utilisateur.role,
      forcePasswordChange: utilisateur.forcePasswordChange,
      // Renvoyé une seule fois : l'administrateur le communique à l'employé,
      // qui devra le changer dès sa première connexion.
      // Affiché une seule fois à l'administrateur qui vient de créer le compte.
      // L'API et l'interface ne doivent pas le journaliser ni l'ajouter à une URL.
      motDePasseTemporaire
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/auth/utilisateurs/:id → désactiver un compte
const supprimerUtilisateur = async (req, res) => {
  try {
    const cible = await Utilisateur.findOne({
      _id: req.params.id,
      companyId: req.entreprise.companyId
    });

    if (!cible) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    // Garde-fou : une entreprise doit toujours garder au moins
    // un administrateur actif, sinon elle se verrouillerait dehors.
    if (cible.role === 'Administrateur') {
      const autres = await Utilisateur.countDocuments({
        companyId: req.entreprise.companyId,
        role: 'Administrateur',
        actif: true,
        _id: { $ne: cible._id }
      });
      if (autres === 0) {
        return res.status(400).json({
          error: 'Impossible : ce compte est le dernier administrateur actif de l\'entreprise.'
        });
      }
    }

    cible.actif = false;
    await cible.save();

    res.json({ message: `Compte « ${cible.email} » désactivé.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/utilisateurs/:id/debloquer → lever le blocage de réinitialisation
// Réservé à l'administrateur de l'entreprise. Deux modes :
//   - debloquer   : remet le compteur à zéro et rend l'accès au compte ;
//   - laisser     : maintient le blocage (journalise la décision).
const debloquerUtilisateur = async (req, res) => {
  try {
    const cible = await Utilisateur.findOne({
      _id: req.params.id,
      companyId: req.entreprise.companyId
    });

    if (!cible) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    const laisserBloque = String(req.body?.decision || '').toLowerCase() === 'laisser';

    if (laisserBloque) {
      return res.json({
        message: `Le blocage du compte « ${cible.email} » est maintenu.`,
        bloqueReinitialisation: true,
        reinitialisations: cible.reinitialisations || 0
      });
    }

    cible.bloqueReinitialisation = false;
    cible.reinitialisations = 0;
    cible.tentativesEchouees = 0;
    cible.verrouillageVersion = (cible.verrouillageVersion || 0) + 1;
    await cible.save();

    res.json({
      message: `Compte « ${cible.email} » débloqué. L'utilisateur peut se reconnecter.`,
      bloqueReinitialisation: false,
      reinitialisations: 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/mot-de-passe/changer → l'utilisateur connecté remplace son
// mot de passe (notamment le mot de passe temporaire à la première connexion).
const changerMotDePasse = async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body || {};

    if (typeof nouveauMotDePasse !== 'string' || nouveauMotDePasse.length < 12 || nouveauMotDePasse.length > 256) {
      return res.status(400).json({
        error: 'Le nouveau mot de passe doit contenir entre 12 et 256 caractères.'
      });
    }

    const utilisateur = await Utilisateur.findById(req.utilisateur._id);
    if (!utilisateur) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    // Un mot de passe temporaire n'est pas un second facteur : exiger sa
    // vérification avant d'autoriser le changement, et toujours pour le reste.
    if (typeof ancienMotDePasse !== 'string' ||
        !verifierMotDePasse(ancienMotDePasse, utilisateur.motDePasseHash)) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
    }
    const ancienHash = utilisateur.motDePasseHash;

    utilisateur.motDePasseHash = hacherMotDePasse(nouveauMotDePasse);
    utilisateur.forcePasswordChange = false;
    utilisateur.verrouillageVersion = (utilisateur.verrouillageVersion || 0) + 1;
    if (besoinRehachage(ancienHash)) {
      utilisateur.tentativesEchouees = 0;
      utilisateur.bloque = false;
      utilisateur.bloqueJusqua = null;
    }
    await utilisateur.save();

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  login,
  moi,
  inscription,
  listerUtilisateurs,
  creerUtilisateur,
  supprimerUtilisateur,
  debloquerUtilisateur,
  changerMotDePasse,
  authentifier,
  autoriserRoles
};