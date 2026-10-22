/**
 * INVENTAIRE D'UN TENANT (lecture seule).
 *
 * Avant toute suppression définitive, montre ce que contient l'entreprise,
 * collection par collection, et ce que le login atteindrait réellement.
 *
 * Usage : node scripts/_inventaire-tenant.mjs MAQUINCAILLERIE1
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

const companyId = String(process.argv[2] || '').toUpperCase().trim();
if (!companyId) {
  console.error('Usage : node scripts/_inventaire-tenant.mjs COMPANYID');
  process.exit(1);
}

const modeles = { Abonnement, Categorie, Client, Commande, Depense, Fournisseur, Mouvement, Product, Transaction, Transport, Vente };

await mongoose.connect(process.env.MONGODB_URI);

const entreprise = await Entreprise.findOne({ companyId }).lean();
console.log(`Entreprise ${companyId} : ${entreprise ? `${entreprise.raisonSociale} (slug ${entreprise.slug})` : 'ABSENTE'}\n`);

const utilisateurs = await Utilisateur.find({ companyId }).select('email nom role actif emailVerifie bloque').lean();
console.log(`Utilisateurs (${utilisateurs.length}) :`);
utilisateurs.forEach(u => console.log(`  • ${u.email} — ${u.nom} | ${u.role} | actif=${u.actif} | emailVerifie=${u.emailVerifie} | bloque=${u.bloque}`));

console.log('\nDocuments métier :');
let total = 0;
for (const [nom, modele] of Object.entries(modeles)) {
  const n = await modele.countDocuments({ companyId });
  total += n;
  console.log(`  ${nom.padEnd(12)} ${n}`);
}
console.log(`  TOTAL        ${total}`);

// Le slug est-il revendiqué ailleurs (donc les comptes de MAQUINCAILLERIE passent-ils par là) ?
const email = utilisateurs[0]?.email;
if (email) {
  const doublons = await Utilisateur.find({ email }).select('companyId bloqué bloque').lean();
  const atteint = await Utilisateur.findOne({ email }).select('companyId').lean();
  console.log(`\nAdresse ${email} : ${doublons.length} compte(s) → ${doublons.map(d => d.companyId).join(', ')}`);
  console.log(`Atteint par /login (findOne par email) : ${atteint?.companyId}`);
}

await mongoose.disconnect();
