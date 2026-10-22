/**
 * SUPPRESSION DÉFINITIVE D'UN TENANT (action explicite, irréversible).
 *
 * Efface l'entreprise, ses comptes et TOUS ses documents métier (produits,
 * ventes, clients, fournisseurs, dépenses, abonnements, transactions…).
 * Aucune route de l'API ne le permet : c'est volontaire.
 *
 * Garde-fous :
 *   - le slug doit être fourni et correspondre EXACTEMENT à l'entreprise ;
 *   - le compte admin de ce tenant ne doit pas être l'unique compte de son
 *     adresse email, sinon cette adresse ne pourrait plus jamais se connecter
 *     (le login cherche par email seul et tomberait sur un compte absent).
 *
 * Usage :
 *   node scripts/_supprimer-tenant.mjs <slug> [--confirmer]
 * Sans --confirmer, le script affiche seulement ce qui SERAIT supprimé.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

const mongoose = require('mongoose');
const Entreprise = require('../models/Entreprise');
const Utilisateur = require('../models/Utilisateur');
const Abonnement = require('../models/Abonnement');
const Categorie = require('../models/Categorie');
const Client = require('../models/Client');
const Commande = require('../models/Commande');
const Depense = require('../models/Depense');
const Fournisseur = require('../models/Fournisseur');
const Mouvement = require('../models/Mouvement');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Transport = require('../models/Transport');
const Vente = require('../models/Vente');

const slug = String(process.argv[2] || '').toLowerCase().trim();
const confirmer = process.argv.includes('--confirmer');
if (!slug) {
  console.error('Usage : node scripts/_supprimer-tenant.mjs <slug> [--confirmer]');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const entreprise = await Entreprise.findOne({ slug });
if (!entreprise) {
  console.error(`Aucune entreprise avec le slug « ${slug} ». Rien n'a été modifié.`);
  await mongoose.disconnect();
  process.exit(1);
}
const companyId = entreprise.companyId;
console.log(`Entreprise ciblée : ${companyId} — ${entreprise.raisonSociale} (slug ${entreprise.slug})`);

// Garde-fou : ne jamais supprimer l'unique compte d'une adresse email.
const utilisateurs = await Utilisateur.find({ companyId }).select('email').lean();
for (const u of utilisateurs) {
  const autres = await Utilisateur.countDocuments({ email: u.email, companyId: { $ne: companyId } });
  if (autres === 0) {
    console.error(`REFUS : ${u.email} n'existe QUE dans ${companyId}. Le supprimer rendrait cette adresse impossible à connecter.`);
    await mongoose.disconnect();
    process.exit(1);
  }
}

const modeles = { Utilisateur, Abonnement, Categorie, Client, Commande, Depense, Fournisseur, Mouvement, Product, Transaction, Transport, Vente };
const plan = {};
for (const [nom, modele] of Object.entries(modeles)) {
  plan[nom] = await modele.countDocuments({ companyId });
}
plan.Entreprise = 1;
console.log('\nDocuments à supprimer :');
for (const [nom, n] of Object.entries(plan)) console.log(`  ${nom.padEnd(12)} ${n}`);

if (!confirmer) {
  console.log('\nSimulation uniquement. Relancez avec --confirmer pour supprimer définitivement.');
  await mongoose.disconnect();
  process.exit(0);
}

// Ordre : d'abord les données métier, l'entreprise en dernier.
for (const [nom, modele] of Object.entries(modeles)) {
  const r = await modele.deleteMany({ companyId });
  console.log(`  supprimé ${nom} : ${r.deletedCount}`);
}
const r = await Entreprise.deleteOne({ companyId, slug });
console.log(`  supprimé Entreprise : ${r.deletedCount}`);

// Contrôle final : plus rien ne doit rester.
const restants = [];
for (const [nom, modele] of Object.entries(modeles)) {
  const n = await modele.countDocuments({ companyId });
  if (n) restants.push(`${nom}=${n}`);
}
const resteEntreprise = await Entreprise.countDocuments({ companyId });
if (resteEntreprise) restants.push(`Entreprise=${resteEntreprise}`);
console.log(restants.length ? `\nRESTES : ${restants.join(', ')}` : `\n${companyId} supprimé définitivement : plus aucun document rattaché.`);

await mongoose.disconnect();
