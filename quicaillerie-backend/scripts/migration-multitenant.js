require('dotenv').config();

const mongoose = require('mongoose');
const readline = require('readline');
const Entreprise = require('../models/Entreprise');
const Utilisateur = require('../models/Utilisateur');
const { hacherMotDePasse } = require('../services/authService');

/**
 * SCRIPT DE MIGRATION MULTI-TENANT
 * ------------------------------------------------------------
 * Les données existantes (catalogue, ventes, clients...) ont été
 * créées AVANT l'introduction du companyId. Ce script les rattache
 * à une entreprise afin qu'elles restent accessibles.
 *
 * Usage :
 *   node scripts/migration-multitenant.js --slug quincaillerie-01 \
 *        --raison-sociale "Ma Quincaillerie SARL" \
 *        --email admin@quincaillerie.ci --mot-de-passe "MotDePasse123"
 *
 * ⚠ Le mot de passe n'est stocké que sous forme d'empreinte PBKDF2.
 */

const arg = (nom, defaut = null) => {
  const index = process.argv.indexOf(`--${nom}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : defaut;
};

const COLLECTIONS = [
  'products',
  'clients',
  'ventes',
  'mouvements',
  'fournisseurs',
  'commandes',
  'abonnements'
];

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI absent du .env.');
    process.exit(1);
  }

  const slug = (arg('slug') || 'quincaillerie-principale').toLowerCase();
  const raisonSociale = arg('raison-sociale') || 'Quincaillerie Principale';
  const email = (arg('email') || 'admin@quincaillerie.ci').toLowerCase();
  const motDePasse = arg('mot-de-passe');
  const nomAdmin = arg('nom') || 'Administrateur';
  const dryRun = process.argv.includes('--dry-run');

  if (!motDePasse) {
    console.error(
      '\nMot de passe obligatoire.\n' +
      'Usage : node scripts/migration-multitenant.js --slug mon-client ' +
      '--raison-sociale "Ma Société" --email admin@societe.ci --mot-de-passe "MotDePasse123"\n' +
      'Ajoutez --dry-run pour simuler sans rien écrire.\n'
    );
    process.exit(1);
  }

  if (motDePasse.length < 8) {
    console.error('Le mot de passe doit contenir au moins 8 caractères.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecté à MongoDB.\n');

  const companyId = slug.toUpperCase().replace(/-/g, '_');
  console.log(`Entreprise cible : ${companyId} (${slug})\n`);

  // Compte-rendu avant écriture, pour vérifier ce qui sera modifié.
  const apercu = {};
  for (const nom of COLLECTIONS) {
    const sansCompany = await mongoose.connection.db.collection(nom).countDocuments({
      companyId: { $exists: false }
    });
    apercu[nom] = sansCompany;
  }

  console.log('Documents SANS companyId par collection :');
  for (const [nom, total] of Object.entries(apercu)) {
    console.log(`  ${nom.padEnd(14)} ${total}`);
  }
  console.log('');

  if (dryRun) {
    console.log('Mode --dry-run : aucune écriture effectuée.');
    await mongoose.disconnect();
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirmation = await new Promise(resolve =>
    rl.question(`Rattacher ces données à « ${raisonSociale} » ? (oui/non) `, resolve)
  );
  rl.close();

  if (confirmation.trim().toLowerCase() !== 'oui') {
    console.log('Annulé : aucune modification.');
    await mongoose.disconnect();
    return;
  }

  // 1. Profil d'entreprise
  let entreprise = await Entreprise.findOne({ companyId });
  if (entreprise) {
    entreprise.raisonSociale = raisonSociale;
    await entreprise.save();
    console.log(`Entreprise « ${companyId} » mise à jour.`);
  } else {
    entreprise = await Entreprise.create({
      companyId,
      slug,
      raisonSociale,
      devise: 'FCFA',
      tauxTva: 18,
      palier: 'Essai',
      abonnementActif: true,
      abonnementEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    console.log(`Entreprise « ${companyId} » créée.`);
  }

  // 2. Compte administrateur
  const existant = await Utilisateur.findOne({ companyId, email });
  if (existant) {
    console.log(`Compte ${email} déjà présent : mot de passe inchangé.`);
  } else {
    await Utilisateur.create({
      companyId,
      nom: nomAdmin,
      email,
      motDePasseHash: hacherMotDePasse(motDePasse),
      role: 'Administrateur'
    });
    console.log(`Compte administrateur ${email} créé.`);
  }

  // 3. Rattachement des collections
  for (const nom of COLLECTIONS) {
    const resultat = await mongoose.connection.db.collection(nom).updateMany(
      { companyId: { $exists: false } },
      { $set: { companyId } }
    );
    if (resultat.modifiedCount > 0) {
      console.log(`  ${nom.padEnd(14)} ${resultat.modifiedCount} document(s) rattaché(s)`);
    }
  }

  // 4. Purge des doublons antérieurs : la référence article était
  //    unique globalement, elle doit l'être par entreprise désormais.
  const produits = mongoose.connection.db.collection('products');
  const doublons = await produits.aggregate([
    { $group: { _id: '$ref', nombre: { $sum: 1 } } },
    { $match: { nombre: { $gt: 1 } } }
  ]).toArray();

  if (doublons.length) {
    console.log(
      `\n⚠ ${doublons.length} référence(s) article en doublon détectée(s) : ` +
      doublons.slice(0, 10).map(d => d._id).join(', ')
    );
    console.log('  Les index uniques (companyId + ref) ne pourront pas être');
    console.log('  créés tant que ces doublons existent. Corrigez-les d\'abord.');
  }

  // 5. Création des index uniques
  console.log('\nSynchronisation des index...');
  await Promise.all([
    Entreprise.syncIndexes(),
    Utilisateur.syncIndexes(),
    mongoose.connection.db.collection('products').createIndex(
      { companyId: 1, ref: 1 }, { unique: true }
    ),
    mongoose.connection.db.collection('fournisseurs').createIndex(
      { companyId: 1, nom: 1 }, { unique: true }
    )
  ]);

  console.log('\n✅ Migration terminée.');
  console.log(`   Connexion : ${email} / sur ${slug}.skyserp.com`);

  await mongoose.disconnect();
};

run().catch(err => {
  console.error('\n❌ Échec de la migration :', err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});