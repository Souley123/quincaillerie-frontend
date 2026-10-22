/**
 * NETTOYAGE DES DONNÉES DE TEST
 * =============================
 * Supprime UNIQUEMENT les entreprises créées pendant les vérifications
 * automatiques (slugs `qaliens…`, `qadiag…`, `qadia…`, `qaban…`) ainsi que
 * leurs utilisateurs. Aucune autre entreprise n'est touchée.
 *
 * Usage : cd quicaillerie-backend && node scripts/nettoyer-entreprises-test.js
 *         (ajoutez --simuler pour voir sans supprimer)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Entreprise = require('../models/Entreprise');
const Utilisateur = require('../models/Utilisateur');

const PREFIXES_TEST = ['qaliens', 'qadiag', 'qadia', 'qaban'];
const simuler = process.argv.includes('--simuler');

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) {
    console.error('Aucune chaîne de connexion MongoDB dans .env');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const filtre = { slug: { $regex: `^(${PREFIXES_TEST.join('|')})` } };
  const cibles = await Entreprise.find(filtre).select('companyId slug raisonSociale').lean();

  if (!cibles.length) {
    console.log('Aucune entreprise de test à supprimer.');
    await mongoose.disconnect();
    return;
  }

  const companyIds = cibles.map(c => c.companyId);
  console.log(`Entreprises de test trouvées : ${cibles.length}`);
  cibles.forEach(c => console.log(`  - ${c.slug} (${c.companyId}) — ${c.raisonSociale}`));

  if (simuler) {
    console.log('\nSimulation : rien n’a été supprimé.');
    await mongoose.disconnect();
    return;
  }

  const utilisateurs = await Utilisateur.deleteMany({ companyId: { $in: companyIds } });
  const entreprises = await Entreprise.deleteMany({ companyId: { $in: companyIds } });

  console.log(`\nSupprimés : ${entreprises.deletedCount} entreprise(s), ${utilisateurs.deletedCount} utilisateur(s).`);

  const restantes = await Entreprise.find({}).select('slug palier').lean();
  console.log(`Entreprises restantes : ${restantes.map(e => `${e.slug} (${e.palier})`).join(', ')}`);

  await mongoose.disconnect();
})().catch(async erreur => {
  console.error('Échec :', erreur.message);
  try { await mongoose.disconnect(); } catch { /* déjà déconnecté */ }
  process.exit(1);
});
