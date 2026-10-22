/**
 * DONNE AU COMPTE « maquincaillerie » L'ACCÈS COMPLET DE DÉVELOPPEUR
 * ================================================================
 * Ne crée AUCUN nouveau compte : il met à niveau l'entreprise existante
 * `maquincaillerie` et son administrateur déjà en place.
 *
 * Ce qui est modifié :
 *   • Entreprise MAQUINCAILLERIE : palier → Enterprise (Master),
 *     abonnement actif avec échéance lointaine ;
 *   • L'administrateur existant : e-mail validé, compte débloqué, rôle
 *     Administrateur, mot de passe définitif (optionnel).
 *
 * Ce qui n'est JAMAIS touché :
 *   • les données métier (articles, ventes, clients, mouvements…) ;
 *   • les autres utilisateurs de l'entreprise ;
 *   • l'adresse e-mail du compte (identifiant de connexion).
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────
 *   cd quicaillerie-backend
 *   node scripts/acces-developpeur-maquincaillerie.js
 *
 * Changer le mot de passe (optionnel) :
 *   COMPTE_DEV_MDP='MonMotDePasse2026!' node scripts/acces-developpeur-maquincaillerie.js
 *
 * ── SÉCURITÉ ──────────────────────────────────────────────────────────────
 *   • refuse de s'exécuter si NODE_ENV=production (sauf --forcer) ;
 *   • affiche avant/après pour que rien ne soit modifié à l'aveugle ;
 *   • le mot de passe reste haché en base.
 * ==========================================================================
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');
const Entreprise = require('../models/Entreprise');
const { hacherMotDePasse } = require('../services/authService');
const acces = require('../config/acces');

const SLUG = String(process.env.COMPTE_SLUG || 'maquincaillerie').toLowerCase().trim();
const NOUVEAU_MDP = process.env.COMPTE_DEV_MDP || '';
const forcer = process.argv.includes('--forcer');

(async () => {
  if (process.env.NODE_ENV === 'production' && !forcer) {
    console.error('\n⛔ Refus : NODE_ENV=production (ajoutez --forcer pour outrepasser).\n');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) {
    console.error('\n⛔ Aucune chaîne de connexion MongoDB dans .env\n');
    process.exit(1);
  }

  await mongoose.connect(uri);

  /* ---------- 1. L'entreprise doit EXISTER : on n'en crée aucune ---------- */
  const entreprise = await Entreprise.findOne({ slug: SLUG });
  if (!entreprise) {
    console.error(`\n⛔ Entreprise « ${SLUG} » introuvable : aucune modification effectuée.\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\nEntreprise trouvée : ${entreprise.raisonSociale} (${entreprise.companyId})`);
  console.log(`AVANT — palier : ${entreprise.palier} | actif : ${entreprise.abonnementActif} | échéance : ${entreprise.abonnementEcheance || '—'}`);

  /* ---------- 2. Mise à niveau de l'abonnement ---------- */
  await Entreprise.updateOne(
    { _id: entreprise._id },
    {
      $set: {
        palier: 'Enterprise',
        abonnementActif: true,
        abonnementEcheance: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        actif: true
      }
    }
  );

  const apres = await Entreprise.findOne({ _id: entreprise._id });
  console.log(`APRÈS — palier : ${apres.palier} | actif : ${apres.abonnementActif} | échéance : ${apres.abonnementEcheance.toISOString().slice(0, 10)}`);

  /* ---------- 3. Administrateur(s) de CELLE entreprise ---------- */
  const administrateurs = await Utilisateur.find({
    companyId: entreprise.companyId,
    role: 'Administrateur'
  });

  if (!administrateurs.length) {
    console.log('\n⚠ Aucun administrateur dans cette entreprise : aucun compte modifié.');
    console.log('  (L’abonnement est néanmoins passé à Enterprise.)\n');
    await mongoose.disconnect();
    return;
  }

  for (const compte of administrateurs) {
    const miseAJour = {
      role: acces.ROLES.ADMIN,
      emailVerifie: true,
      verificationEmailHash: null,
      verificationEmailExpire: null,
      forcePasswordChange: false,
      bloque: false,
      bloqueJusqua: null,
      bloqueReinitialisation: false,
      tentativesEchouees: 0,
      actif: true
    };

    /* Le mot de passe n'est remplacé que si on le demande explicitement :
       on ne casse pas une connexion existante sans raison. */
    if (NOUVEAU_MDP) {
      if (NOUVEAU_MDP.length < 12) {
        console.error('\n⛔ Mot de passe trop court (12 caractères minimum).\n');
        await mongoose.disconnect();
        process.exit(1);
      }
      miseAJour.motDePasseHash = hacherMotDePasse(NOUVEAU_MDP);
    }

    await Utilisateur.updateOne({ _id: compte._id }, { $set: miseAJour });
    console.log(`✔ Compte mis à niveau : ${compte.email}${NOUVEAU_MDP ? ' (mot de passe remplacé)' : ' (mot de passe inchangé)'}`);
  }

  /* ---------- 4. Récapitulatif des droits accordés ---------- */
  const modules = acces.modulesAutorises({ role: acces.ROLES.ADMIN, palier: 'Enterprise' });

  console.log(`
─────────────────────────────────────────────────────────────
  ACCÈS COMPLET ACTIVÉ SUR « ${SLUG} »
─────────────────────────────────────────────────────────────
  Entreprise        : ${apres.raisonSociale} (slug : ${apres.slug})
  Abonnement        : Enterprise / Master
  Compte(s)         : ${administrateurs.map(c => c.email).join(', ')}
  Mot de passe      : ${NOUVEAU_MDP ? 'remplacé (voir COMPTE_DEV_MDP)' : 'inchangé — utilisez le vôtre'}

  Modules ouverts   : ${modules.length} / ${acces.MODULES.length}
  ${modules.join(', ')}

  Les modules sensibles demandent EN PLUS leur mot de passe dédié :
  Trésorerie, Comptabilité, Rapports KPI, Crédits, Dépenses, Sécurité.
─────────────────────────────────────────────────────────────
`);

  await mongoose.disconnect();
})().catch(async erreur => {
  console.error('\n⛔ Échec :', erreur.message, '\n');
  try { await mongoose.disconnect(); } catch { /* déjà déconnecté */ }
  process.exit(1);
});
