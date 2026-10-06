const Entreprise = require('../models/Entreprise');
const Utilisateur = require('../models/Utilisateur');
const {
  hacherMotDePasse,
  verifierMotDePasse,
  signer
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

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { slug, email, motDePasse } = req.body || {};

    if (!email || !motDePasse) {
      return res.status(400).json({ error: 'Email et mot de passe obligatoires.' });
    }

    // L'email suffit à retrouver l'utilisateur : il est unique par tenant.
    const utilisateur = await Utilisateur.findOne({
      email: String(email).toLowerCase().trim()
    });

    if (!utilisateur || !utilisateur.actif) {
      // Message volontairement générique : ne pas révéler
      // si l'email existe ou non.
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const entreprise = await Entreprise.findOne({ companyId: utilisateur.companyId });

    // Si un sous-domaine est fourni, il doit correspondre à l'entreprise
    // du compte : cela empêche de se connecter sur le mauvais tenant.
    if (slug && (!entreprise || entreprise.slug !== String(slug).toLowerCase().trim())) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    if (!verifierMotDePasse(motDePasse, utilisateur.motDePasseHash)) {
      await enregistrerEchecConnexion(utilisateur);
      return res.status(401).json({
        error: 'Identifiants incorrects.',
        tentativesRestantes: Math.max(
          0,
          5 - (utilisateur.tentativesEchouees || 0)
        )
      });
    }

    if (utilisateur.bloque) {
      return res.status(423).json({
        error: `Compte verrouillé jusqu'à ${utilisateur.bloqueJusqua?.toLocaleString('fr-FR')}.`
      });
    }

    await enregistrerConnexionReussie(utilisateur);

    if (!entreprise.abonnementActif) {
      return res.status(402).json({
        error: 'Abonnement inactif : merci de régulariser votre abonnement SKYS ERP Solution.'
      });
    }

    const jeton = signer({
      companyId: utilisateur.companyId,
      email: utilisateur.email,
      role: utilisateur.role,
      id: String(utilisateur._id)
    });

    res.json({
      jeton,
      utilisateur: {
        id: utilisateur._id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }

    if (String(motDePasse).length < 8) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 8 caractères.'
      });
    }

    const slugNormalise = String(slug).toLowerCase().trim();

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
      abonnementEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
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
      id: String(utilisateur._id)
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

// POST /api/auth/utilisateurs → créer un compte (Administrateur ou Caissier)
const creerUtilisateur = async (req, res) => {
  try {
    const { nom, email, motDePasse, role = 'Caissier' } = req.body || {};
    const companyId = req.entreprise.companyId;

    if (!nom || !email || !motDePasse) {
      return res.status(400).json({
        error: 'Nom, email et mot de passe sont obligatoires.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }

    if (String(motDePasse).length < 8) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 8 caractères.'
      });
    }

    const doublon = await Utilisateur.findOne({
      companyId,
      email: String(email).toLowerCase().trim()
    });
    if (doublon) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé dans votre entreprise.' });
    }

    const utilisateur = await Utilisateur.create({
      companyId,
      nom,
      email: String(email).toLowerCase().trim(),
      motDePasseHash: hacherMotDePasse(motDePasse),
      role
    });

    res.status(201).json({
      id: utilisateur._id,
      nom: utilisateur.nom,
      email: utilisateur.email,
      role: utilisateur.role
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

module.exports = {
  login,
  moi,
  inscription,
  listerUtilisateurs,
  creerUtilisateur,
  supprimerUtilisateur,
  authentifier,
  autoriserRoles
};