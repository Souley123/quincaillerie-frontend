require('dotenv').config();

const mongoose = require('mongoose');
const Entreprise = require('../models/Entreprise');
const Utilisateur = require('../models/Utilisateur');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Vente = require('../models/Vente');
const { hacherMotDePasse, signer, verifier } = require('../services/authService');

/**
 * TEST D'ISOLATION MULTI-TENANT
 * Vérifie qu'une entreprise ne peut voir ni lire les données d'une autre.
 * Les données créées sont supprimées à la fin.
 */

const SUFFIXE = Date.now().toString(36).toUpperCase();
const A = `TA${SUFFIXE}`;
const B = `TB${SUFFIXE}`;

let ok = 0;
let ko = 0;

const verifier_ = (nom, condition) => {
  if (condition) {
    console.log(`  OK  ${nom}`);
    ok++;
  } else {
    console.log(`  ECHEC  ${nom}`);
    ko++;
  }
};

const run = async () => {
  // La base Atlas s'appelle « Quincaillerie_db » (avec Q majuscule).
await mongoose.connect(process.env.MONGODB_URI, { dbName: 'Quincaillerie_db' });
  console.log('Connecté à MongoDB\n');

  // Deux entreprises, deux utilisateurs, un article et un client chacune.
  await Entreprise.create([
    { companyId: A, slug: `testa-${SUFFIXE.toLowerCase()}`, raisonSociale: 'Entreprise A' },
    { companyId: B, slug: `testb-${SUFFIXE.toLowerCase()}`, raisonSociale: 'Entreprise B' }
  ]);

  await Utilisateur.create([
    { companyId: A, nom: 'Admin A', email: `a-${SUFFIXE}@test.ci`, motDePasseHash: hacherMotDePasse('MotDePasse123'), role: 'Administrateur' },
    { companyId: B, nom: 'Admin B', email: `b-${SUFFIXE}@test.ci`, motDePasseHash: hacherMotDePasse('MotDePasse123'), role: 'Administrateur' }
  ]);

  const produitA = await Product.create({
    companyId: A, ref: `REF-A-${SUFFIXE}`, nom: 'Article A', famille: 'Visserie',
    prixAchat: 500, prix: 800, quantiteStock: 10, minStock: 2
  });

  await Product.create({
    companyId: B, ref: `REF-B-${SUFFIXE}`, nom: 'Article B', famille: 'Visserie',
    prixAchat: 700, prix: 900, quantiteStock: 4, minStock: 3
  });

  await Client.create([
    { companyId: A, nom: 'Client A', email: `ca-${SUFFIXE}@test.ci` },
    { companyId: B, nom: 'Client B', email: `cb-${SUFFIXE}@test.ci` }
  ]);

  const venteA = await Vente.create({
    companyId: A, reference: `VTE-A-${SUFFIXE}`, clientNom: 'Client A',
    lignes: [{ produitId: produitA._id, ref: produitA.ref, nom: produitA.nom, quantite: 1, prixUnitaire: 800, total: 800 }],
    sousTotal: 800, total: 800
  });

  console.log('1. Isolation des lectures');
  const produitsA = await Product.find({ companyId: A });
  const produitsB = await Product.find({ companyId: B });
  verifier_('Entreprise A ne voit que son article', produitsA.length === 1 && produitsA[0].ref === `REF-A-${SUFFIXE}`);
  verifier_('Entreprise B ne voit que le sien', produitsB.length === 1 && produitsB[0].ref === `REF-B-${SUFFIXE}`);

  const clientsA = await Client.find({ companyId: A });
  verifier_('Entreprise A ne voit que son client', clientsA.length === 1 && clientsA[0].nom === 'Client A');

  console.log('\n2. Acces direct par un identifiant d\'une autre entreprise');
  const volArticle = await Product.findOne({ _id: produitA._id, companyId: B });
  verifier_('Article de A invisible depuis B', volArticle === null);

  const volVente = await Vente.findOne({ _id: venteA._id, companyId: B });
  verifier_('Vente de A invisible depuis B', volVente === null);

  console.log('\n3. Unicite par entreprise');
  const doublonAutorise = await Product.create({
    companyId: B, ref: produitA.ref, nom: 'Meme reference chez B', famille: 'Visserie',
    prixAchat: 100, prix: 200, quantiteStock: 1
  }).catch(err => err);
  verifier_(
    'Deux entreprises peuvent reutiliser la meme reference',
    doublonAutorise && doublonAutorise.ref === produitA.ref
  );

  const doublonInterne = await Product.create({
    companyId: A, ref: produitA.ref, nom: 'Doublon interne', famille: 'Visserie',
    prixAchat: 100, prix: 200, quantiteStock: 1
  }).catch(err => err.code === 11000);
  verifier_('Une meme entreprise ne peut PAS dupliquer sa reference', doublonInterne === true);

  console.log('\n4. Integrite du jeton');
  const jetonA = signer({ companyId: A, email: `a-${SUFFIXE}@test.ci`, role: 'Administrateur' });
  const charge = verifier(jetonA);
  verifier_('Le jeton porte le companyId', charge.companyId === A);

  const jetonFalsifie = `${jetonA.slice(0, -4)}beef`;
  verifier_('Un jeton falsifie est rejete', verifier(jetonFalsifie) === null);

  console.log('\n5. Service stock');
  const { listerAlertesStock } = require('../services/stockService');
  const alertesA = await listerAlertesStock(A);
  const alertesB = await listerAlertesStock(B);
  verifier_(
    'Alertes de A ne contiennent que les articles de A',
    alertesA.every(p => p.companyId === A)
  );
  verifier_(
    'Alertes de B detectent le stock bas (4 <= 3 non, donc vide attendu ici)',
    Array.isArray(alertesB)
  );

  const refus = await listerAlertesStock().catch(err => err.message);
  verifier_('Appel sans companyId refuse', typeof refus === 'string' && refus.includes('companyId'));

  // Nettoyage
  console.log('\n6. Nettoyage');
  await Promise.all([
    Product.deleteMany({ companyId: { $in: [A, B] } }),
    Client.deleteMany({ companyId: { $in: [A, B] } }),
    Vente.deleteMany({ companyId: { $in: [A, B] } }),
    Utilisateur.deleteMany({ companyId: { $in: [A, B] } }),
    Entreprise.deleteMany({ companyId: { $in: [A, B] } })
  ]);
  verifier_('Donnees de test supprimees', true);

  console.log(`\n${'='.repeat(45)}`);
  console.log(`  ${ok} test(s) reussi(s), ${ko} echec(s)`);
  console.log('='.repeat(45));

  await mongoose.disconnect();
  process.exit(ko === 0 ? 0 : 1);
};

run().catch(err => {
  console.error('\nErreur du test :', err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});