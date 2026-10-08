const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');
const Entreprise = require('../models/Entreprise');
const { verifier } = require('../services/authService');

/**
 * MIDDLEWARE MULTI-TENANT
 * ------------------------------------------------------------
 * 1. authentifier  : lit le jeton Bearer, le vérifie, charge
 *                    l'utilisateur et le rattache à req.entreprise.
 * 2. CompanyId(req) : helper qui retourne le companyId de la
 *                    requête — à utiliser dans TOUS les filtres.
 * 3. autoriserRole  : restreint une route à certains rôles.
 *
 * Règle d'or : un contrôleur ne doit JAMAIS utiliser findById(req.params.id)
 * seul. Il doit passer par Modele.findOne({ _id, companyId }).
 */

const SEUIL_VERROUILLAGE = 5;
const DUREE_VERROUILLAGE_MIN = 15;

/**
 * Résout le companyId : prioritairement celui du jeton, jamais
 * celui fourni par le client dans l'URL ou le corps de la requête.
 */
const CompanyId = req => req.entreprise?.companyId || null;

/**
 * Vérifie qu'un identifiant de route est un ObjectId Mongo valide.
 * Sans ce garde, Modele.findOne({ _id: 'abc' }) leve une erreur de
 * transtypage et répond 500 au lieu d'un 404 propre.
 */
const ObjectIdValide = id =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

/** Middleware : exige un jeton valide et un compte actif. */
const authentifier = async (req, res, next) => {
  try {
    const entete = req.headers.authorization || '';
    const jeton = entete.startsWith('Bearer ') ? entete.slice(7).trim() : null;

    if (!jeton) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }

    const charge = verifier(jeton);
    if (!charge) {
      return res.status(401).json({ error: 'Session expirée ou invalide. Reconnectez-vous.' });
    }

    // companyId provient de la charge signée du jeton, jamais du client.
    const utilisateur = await Utilisateur.findOne({
      companyId: charge.companyId,
      email: charge.email
    });

    if (!utilisateur || !utilisateur.actif) {
      return res.status(401).json({ error: 'Compte introuvable ou désactivé.' });
    }

    if (utilisateur.bloque) {
      const encoreBloque =
        utilisateur.bloqueJusqua && utilisateur.bloqueJusqua.getTime() > Date.now();

      if (encoreBloque) {
        return res.status(423).json({
          error: `Compte temporairement verrouillé jusqu'à ${utilisateur.bloqueJusqua.toLocaleString('fr-FR')}.`
        });
      }
      // Le délai est écoulé : on libère le compte.
      utilisateur.bloque = false;
      utilisateur.bloqueJusqua = null;
      utilisateur.tentativesEchouees = 0;
      await utilisateur.save();
    }

    // Blocage définitif après trop de réinitialisations : même un jeton encore
    // valide ne doit pas donner accès tant qu'un administrateur n'a pas débloqué.
    if (utilisateur.bloqueReinitialisation) {
      return res.status(423).json({
        error: 'Compte bloqué après plusieurs réinitialisations. Un administrateur doit le débloquer.'
      });
    }

    // L'entreprise doit être active ET son abonnement valide.
    const entreprise = await Entreprise.findOne({ companyId: utilisateur.companyId });
    if (!entreprise || !entreprise.actif) {
      return res.status(403).json({ error: 'Entreprise introuvable ou désactivée.' });
    }

    if (!entreprise.abonnementActif) {
      return res.status(402).json({
        error: 'Abonnement inactif. Merci de régulariser votre situation pour accéder à SKYS ERP Solution.'
      });
    }

    req.entreprise = entreprise;
    req.utilisateur = utilisateur;

    // On mémorise la connexion sans bloquer la requête si l'écriture échoue.
    Utilisateur.updateOne(
      { _id: utilisateur._id },
      { $set: { derniereConnexion: new Date() } }
    ).catch(() => {});

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Middleware : restreint l'accès à certains rôles. */
const autoriserRoles = (...rolesAutorises) => (req, res, next) => {
  if (!req.utilisateur) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  if (!rolesAutorises.includes(req.utilisateur.role)) {
    return res.status(403).json({
      error: 'Accès refusé : votre rôle ne permet pas cette operation.'
    });
  }
  next();
};

/**
 * Enregistre un échec de connexion et verrouille le compte au-delà
 * du seuil. À appeler depuis le contrôleur d'authentification.
 */
const enregistrerEchecConnexion = async utilisateur => {
  utilisateur.tentativesEchouees = (utilisateur.tentativesEchouees || 0) + 1;

  if (utilisateur.tentativesEchouees >= SEUIL_VERROUILLAGE) {
    utilisateur.bloque = true;
    utilisateur.bloqueJusqua = new Date(Date.now() + DUREE_VERROUILLAGE_MIN * 60 * 1000);
  }

  await utilisateur.save();
  return utilisateur;
};

/** Remet le compteur à zéro après une connexion réussie. */
const enregistrerConnexionReussie = async utilisateur => {
  utilisateur.tentativesEchouees = 0;
  utilisateur.bloque = false;
  utilisateur.bloqueJusqua = null;
  await utilisateur.save();
};

module.exports = {
  authentifier,
  autoriserRoles,
  CompanyId,
  ObjectIdValide,
  enregistrerEchecConnexion,
  enregistrerConnexionReussie,
  SEUIL_VERROUILLAGE,
  DUREE_VERROUILLAGE_MIN
};
