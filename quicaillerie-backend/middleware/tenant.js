const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');
const Entreprise = require('../models/Entreprise');
const { verifier } = require('../services/authService');
const acces = require('../config/acces');

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

    /* Contrôle STRICT de vérification d'e-mail : tant que l'adresse n'est pas
       confirmée, l'accès à l'ERP est refusé (403). On laisse seulement passer
       les routes indispensables : changement de mot de passe temporaire,
       renvoi de l'e-mail de vérification, lecture de son propre profil
       (GET /api/auth/moi) et déconnexion. */
    if (utilisateur.emailVerifie === false) {
      const routeAutorisee = req.path === '/api/auth/mot-de-passe/changer'
        || req.path === '/api/auth/renvoyer-verification'
        || req.path === '/api/auth/moi'
        || req.path === '/api/auth/deconnexion';
      if (!routeAutorisee) {
        return res.status(403).json({
          error: 'Confirmez votre adresse e-mail avant d\'utiliser SKYS ERP Solution.',
          code: 'EMAIL_NON_VERIFIE',
          emailVerifie: false
        });
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
    // Nouveaux essais : dateCreation + 5 jours. Les abonnements historiques
    // conservent leur échéance existante pour éviter de changer leurs contrats.
    const statutAbonnement = String(entreprise.abonnementActuel || '').toLowerCase();
    const estEssai = statutAbonnement === 'essai'
      || (!statutAbonnement && ['essai', 'expire'].includes(String(entreprise.palier || '').toLowerCase()));
    const echeanceEssai = estEssai
      ? new Date(new Date(entreprise.dateCreation || entreprise.createdAt || Date.now()).getTime() + 5 * 24 * 60 * 60 * 1000)
      : null;
    const palierAbonnement = String(entreprise.palier || '').toLowerCase();
    const echeanceEffective = estEssai
      ? (palierAbonnement === 'expire' && entreprise.abonnementEcheance
        ? entreprise.abonnementEcheance
        : echeanceEssai)
      : entreprise.abonnementEcheance;
    const statutDejaExpire = statutAbonnement === 'expire'
      || (!statutAbonnement && palierAbonnement === 'expire');
    const essaiHistoriqueExpire = !statutAbonnement && String(entreprise.palier || '').toLowerCase() === 'essai'
      && entreprise.abonnementEcheance
      && new Date(entreprise.abonnementEcheance).getTime() < Date.now();
    const echeanceDepassee = (echeanceEffective
      && new Date(echeanceEffective).getTime() < Date.now()) || essaiHistoriqueExpire;

    if ((echeanceDepassee || statutDejaExpire) && (entreprise.abonnementActif || entreprise.abonnementActuel !== 'expire')) {
      // On persiste la fermeture pour que l'état reste cohérent hors requête.
      entreprise.abonnementActif = false;
      entreprise.abonnementActuel = 'expire';
      Entreprise.updateOne(
        { companyId: utilisateur.companyId, abonnementActif: true },
        { $set: { abonnementActif: false, abonnementActuel: 'expire' } }
      ).catch(() => {});
    }

    if ((!entreprise.abonnementActif || echeanceDepassee || statutDejaExpire) && !autoriseePendantEssai) {
      return res.status(402).json({
        code: echeanceDepassee || statutDejaExpire ? 'ESSAI_EXPIRE' : 'ABONNEMENT_INACTIF',
        error: echeanceDepassee || statutDejaExpire
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
  /* Les rôles historiques (Magasinier, Caissier) sont ramenés à leur
     équivalent actuel AVANT comparaison : un compte créé avant la
     réorganisation reste fonctionnel avec les mêmes droits. */
  const role = acces.normaliserRole(req.utilisateur.role);
  const attendus = rolesAutorises.map(r => acces.normaliserRole(r) || r);
  if (!role || !attendus.includes(role)) {
    return res.status(403).json({
      error: 'Accès refusé : votre rôle ne permet pas cette opération.',
      code: 'ROLE_INSUFFISANT'
    });
  }
  next();
};

/* ==========================================================================
   SÉCURITÉ DOUBLE : RÔLE + ABONNEMENT
   --------------------------------------------------------------------------
   `checkRole`        : alias explicite de `autoriserRoles` (RBAC).
   `checkSubscription`: exige un palier minimum pour la route.
   `verifierAccesModule`: vérifie qu'un module est couvert par le rôle ET
                        par l'abonnement — utilisé pour les routes métier.

   Ces contrôles s'EXÉCUTENT APRÈS `authentifier`, qui a chargé
   `req.utilisateur` et `req.entreprise` : aucun accès ne peut contourner le
   filtre multi-tenant.
   ========================================================================== */
const checkRole = autoriserRoles;

const checkSubscription = (palierMinimum) => (req, res, next) => {
  if (!req.entreprise) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  /* Un module de référence permet d'exprimer le niveau via le palier réel
     de l'entreprise : « PRO » couvre Standard + Pro, « ENTERPRISE » couvre
     tout. Les alias (Master, Professionnel / ERP…) sont normalisés. */
  const niveaux = { STANDARD: 2, PRO: 3, ENTERPRISE: 4, ESSAI: 1 };
  const demande = String(palierMinimum || '').toUpperCase();
  const rangDemande = niveaux[demande] || 0;
  const rangEntreprise = acces.rangPalier(req.entreprise.palier);

  /* Offre Transporteur : accès Standard + le module transport. Elle ne
     débloque jamais les modules Pro/Enterprise génériques. */
  if (acces.normaliserPalier(req.entreprise.palier) === 'Transport') {
    if (rangDemande > 2) {
      return res.status(403).json({
        error: 'Cette fonctionnalité n’est pas incluse dans votre abonnement Transporteur.',
        code: 'ABONNEMENT_INSUFFISANT',
        palierRequis: palierMinimum,
        palierActuel: req.entreprise.palier
      });
    }
    return next();
  }

  if (rangEntreprise < rangDemande) {
    return res.status(403).json({
      error: 'Votre abonnement ne donne pas accès à cette fonctionnalité.',
      code: 'ABONNEMENT_INSUFFISANT',
      palierRequis: palierMinimum,
      palierActuel: req.entreprise.palier
    });
  }

  next();
};

/**
 * Vérifie l'accès à UN module (rôle + abonnement) — source de vérité commune
 * avec le frontend. `parametre` peut être un id de module fixe ou une
 * fonction qui le déduit de la requête.
 */
const verifierAccesModule = (parametre) => (req, res, next) => {
  if (!req.utilisateur || !req.entreprise) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  const moduleId = typeof parametre === 'function' ? parametre(req) : parametre;
  const decision = acces.deciderAcces({
    role: req.utilisateur.role,
    palier: req.entreprise.palier,
    moduleId
  });

  if (decision.autorise) return next();

  if (decision.raison === 'role') {
    return res.status(403).json({
      error: 'Accès refusé : votre rôle ne permet pas cette opération.',
      code: 'ROLE_INSUFFISANT',
      module: moduleId
    });
  }

  return res.status(403).json({
    error: 'Votre abonnement ne donne pas accès à ce module.',
    code: 'ABONNEMENT_INSUFFISANT',
    module: moduleId,
    palierRequis: decision.module ? decision.module.niveau : null,
    palierActuel: req.entreprise.palier
  });
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
  checkRole,
  checkSubscription,
  verifierAccesModule,
  CompanyId,
  ObjectIdValide,
  enregistrerEchecConnexion,
  enregistrerConnexionReussie,
  SEUIL_VERROUILLAGE,
  DUREE_VERROUILLAGE_MIN
};
