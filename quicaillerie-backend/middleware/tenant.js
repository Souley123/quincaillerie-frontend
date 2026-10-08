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
    if ((Number(charge.verrouillageVersion) || 0) !== (utilisateur.verrouillageVersion || 0)) {
      return res.status(401).json({ error: 'Session expirée ou révoquée. Reconnectez-vous.' });
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
    if (utilisateur.forcePasswordChange) {
      const methodeChangement = req.method === 'POST' && req.path === '/api/auth/mot-de-passe/changer';
      if (!methodeChangement) {
        return res.status(403).json({ error: 'Changez le mot de passe temporaire avant d’utiliser cette ressource.' });
      }
    }

    // L'entreprise doit être active ET son abonnement valide.
    const entreprise = await Entreprise.findOne({ companyId: utilisateur.companyId });
    if (!entreprise || !entreprise.actif) {
      return res.status(403).json({ error: 'Entreprise introuvable ou désactivée.' });
    }

    const autoriseePendantEssai = utilisateur.forcePasswordChange &&
      req.method === 'POST' && req.path === '/api/auth/mot-de-passe/changer';

    /* Contrôle d'échéance : le booléen abonnementActif ne suffit pas.
       Un abonnement ou un essai expiré doit couper l'accès automatiquement,
       sinon un paiement d'il y a des mois laisserait l'ERP ouvert pour toujours. */
    const echeanceDepassee = entreprise.abonnementEcheance
      && new Date(entreprise.abonnementEcheance).getTime() < Date.now();

    if (echeanceDepassee && entreprise.abonnementActif) {
      // On persiste la fermeture pour que l'état reste cohérent hors requête.
      entreprise.abonnementActif = false;
      Entreprise.updateOne(
        { companyId: utilisateur.companyId, abonnementActif: true },
        { $set: { abonnementActif: false } }
      ).catch(() => {});
    }

    if ((!entreprise.abonnementActif || echeanceDepassee) && !autoriseePendantEssai) {
      return res.status(402).json({
        error: echeanceDepassee
          ? 'Votre période d\'essai ou d\'abonnement est expirée. Merci de régulariser votre situation pour accéder à SKYS ERP Solution.'
          : 'Abonnement inactif. Merci de régulariser votre situation pour accéder à SKYS ERP Solution.'
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
  const tentatives = (utilisateur.tentativesEchouees || 0) + 1;
  const verrouille = tentatives >= SEUIL_VERROUILLAGE;
  const filtre = { _id: utilisateur._id, companyId: utilisateur.companyId, tentativesEchouees: utilisateur.tentativesEchouees || 0 };
  const maj = { $inc: { tentativesEchouees: 1 } };
  if (verrouille) {
    maj.$set = { bloque: true, bloqueJusqua: new Date(Date.now() + DUREE_VERROUILLAGE_MIN * 60 * 1000) };
    maj.$inc.verrouillageVersion = 1;
  }
  const resultat = await Utilisateur.updateOne(filtre, maj);
  if (resultat.modifiedCount === 1) {
    utilisateur.tentativesEchouees = tentatives;
    if (verrouille) {
      utilisateur.bloque = true;
      utilisateur.bloqueJusqua = maj.$set.bloqueJusqua;
      utilisateur.verrouillageVersion = (utilisateur.verrouillageVersion || 0) + 1;
    }
  }
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
