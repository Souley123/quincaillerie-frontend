/**
 * REMISE EN ÉTAT D'UN COMPTE (action explicite, jamais automatique).
 *
 * Pourquoi ? Un compte peut se retrouver inutilisable par accumulation :
 *   - `bloque` / `bloqueReinitialisation` (tentatives échouées, réinitialisations),
 *   - `emailVerifie = false` → le serveur refuse TOUT accès à l'ERP (403),
 *   - mot de passe dont le titulaire n'est plus certain.
 *
 * Le script réinitialise ces trois points et AFFICHE UNE SEULE FOIS le
 * nouveau mot de passe. Il ne l'écrit dans aucun fichier ni journal.
 *
 * Usage :
 *   node scripts/_remettre-en-etat.mjs email@exemple.com companyId
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

const crypto = require('crypto');
const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');
const Entreprise = require('../models/Entreprise');
const { hacherMotDePasse } = require('../services/authService');

const email = (process.argv[2] || '').toLowerCase().trim();
const companyId = process.argv[3];

if (!email || !companyId) {
  console.error('Usage : node scripts/_remettre-en-etat.mjs email@exemple.com COMPANYID');
  process.exit(1);
}

/* Mot de passe lisible et robuste : 16 caractères, majuscule, minuscule,
   chiffre et symbole (la politique serveur exige 12 caractères minimum). */
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const tirer = n => Array.from(crypto.randomBytes(n)).map(octet => alphabet[octet % alphabet.length]).join('');
const motDePasse = `${tirer(4)}-${tirer(4)}-${tirer(4)}-${tirer(2)}9!`;

await mongoose.connect(process.env.MONGODB_URI);

const compte = await Utilisateur.findOne({ email, companyId });
if (!compte) {
  console.error(`Compte ${email} [${companyId}] introuvable.`);
  await mongoose.disconnect();
  process.exit(1);
}
const entreprise = await Entreprise.findOne({ companyId }).select('slug raisonSociale').lean();

compte.motDePasseHash = hacherMotDePasse(motDePasse);
compte.bloque = false;
compte.bloqueJusqua = null;
compte.tentativesEchouees = 0;
compte.bloqueReinitialisation = false;
compte.reinitialisations = 0;
compte.forcePasswordChange = false;
compte.emailVerifie = true;
compte.verificationEmailHash = null;
compte.verificationEmailExpire = null;
compte.verrouillageVersion = (compte.verrouillageVersion || 0) + 1;
await compte.save();

console.log('Compte remis en état :');
console.log(`  ${compte.email} [${compte.companyId}] — ${entreprise?.raisonSociale || ''} (slug : ${entreprise?.slug || '?'})`);
console.log(`  rôle=${compte.role} | bloque=${compte.bloque} | emailVerifie=${compte.emailVerifie} | tentatives=${compte.tentativesEchouees}`);
console.log(`\nNOUVEAU MOT DE PASSE (affiché une seule fois, rien n'est enregistré) :\n  ${motDePasse}`);

await mongoose.disconnect();
