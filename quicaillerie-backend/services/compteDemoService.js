const Entreprise = require('../models/Entreprise');
const Utilisateur = require('../models/Utilisateur');
const { hacherMotDePasse } = require('./authService');

/**
 * COMPTE DE DÉMONSTRATION / TEST
 * ------------------------------------------------------------
 * Crée (ou rafraîchit) un compte de test prêt à l'emploi, accessible avec un
 * email et un mot de passe par défaut. Sa période d'accès est volontairement
 * limitée : à l'échéance, le middleware multi-tenant coupe l'accès
 * automatiquement (aucune action manuelle requise).
 *
 * Sécurité :
 *   - actif UNIQUEMENT si DEMO_COMPTE=actif (jamais par défaut en production) ;
 *   - les identifiants sont surchargeables par variables d'environnement ;
 *   - le mot de passe par défaut est refusé s'il est trop faible ou trop court ;
 *   - l'échéance est plafonnée (1 à 90 jours) pour éviter un accès sans fin.
 */

const DUREE_JOURS = (() => {
  const valeur = Number(process.env.DEMO_DUREE_JOURS ?? 3);
  return Number.isFinite(valeur) && valeur >= 1 && valeur <= 90 ? valeur : 3;
})();

const EMAIL_DEFAUT = 'demo@skys-erp.com';
const MOT_DE_PASSE_DEFAUT = 'Skys-Demo-2026!';
const SLUG_DEFAUT = 'demo';

/** Le compte de démonstration doit-il être provisionné ? */
const estActif = () => String(process.env.DEMO_COMPTE || '').toLowerCase() === 'actif';

/**
 * Provisionne le compte de démonstration.
 * Idempotent : appelé à chaque démarrage, il prolonge l'échéance de DUREE_JOURS
 * à partir de maintenant (le compte reste donc utilisable pendant la fenêtre).
 * @returns {Promise<{cree:boolean, email:string, motDePasse:string, expedieLe:Date, echeance:Date}|null>}
 */
const provisionnerCompteDemo = async () => {
  if (!estActif()) return null;

  const email = String(process.env.DEMO_EMAIL || EMAIL_DEFAUT).trim().toLowerCase();
  const motDePasse = String(process.env.DEMO_MOT_DE_PASSE || MOT_DE_PASSE_DEFAUT);
  const slug = String(process.env.DEMO_SLUG || SLUG_DEFAUT).trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn('[DÉMO] DEMO_EMAIL invalide : compte de démonstration non créé.');
    return null;
  }
  if (motDePasse.length < 12 || motDePasse.length > 256) {
    console.warn('[DÉMO] DEMO_MOT_DE_PASSE doit contenir entre 12 et 256 caractères : compte non créé.');
    return null;
  }

  const echeance = new Date(Date.now() + DUREE_JOURS * 24 * 60 * 60 * 1000);
  const companyId = slug.toUpperCase().replace(/-/g, '_');

  let entreprise = await Entreprise.findOne({ companyId });
  const cree = !entreprise;
  if (!entreprise) {
    entreprise = await Entreprise.create({
      companyId,
      slug,
      raisonSociale: 'SKYS ERP — Démonstration',
      nomCommercial: 'Démonstration',
      devise: 'FCFA',
      tauxTva: 18,
      palier: 'Pro',
      abonnementActif: true,
      abonnementEcheance: echeance,
      actif: true
    });
  } else {
    entreprise.abonnementActif = true;
    entreprise.abonnementEcheance = echeance;
    entreprise.palier = entreprise.palier || 'Pro';
    entreprise.actif = true;
    await entreprise.save();
  }

  let utilisateur = await Utilisateur.findOne({ companyId, email });
  if (!utilisateur) {
    utilisateur = await Utilisateur.create({
      companyId,
      nom: 'Compte de démonstration',
      email,
      motDePasseHash: hacherMotDePasse(motDePasse),
      role: 'Administrateur',
      actif: true
    });
  } else {
    // Réinitialise proprement le compte de test (mot de passe, blocages, verrous).
    utilisateur.motDePasseHash = hacherMotDePasse(motDePasse);
    utilisateur.role = 'Administrateur';
    utilisateur.actif = true;
    utilisateur.bloque = false;
    utilisateur.bloqueJusqua = null;
    utilisateur.tentativesEchouees = 0;
    utilisateur.bloqueReinitialisation = false;
    utilisateur.forcePasswordChange = false;
    utilisateur.verrouillageVersion = (utilisateur.verrouillageVersion || 0) + 1;
    await utilisateur.save();
  }

  console.log(`[DÉMO] Compte de démonstration prêt : ${email} · accès jusqu'au ${echeance.toLocaleString('fr-FR')}`);
  return { cree, email, motDePasse, expedieLe: new Date(), echeance };
};

module.exports = { provisionnerCompteDemo, estActif, DUREE_JOURS };
