/**
 * DÉFINITION DU MOT DE PASSE PAR DÉFAUT (action explicite de l'administrateur).
 *
 * Remplace l'empreinte du mot de passe et remet le compte en état utilisable :
 * verrou levé, compteur de tentatives remis à zéro, email marqué vérifié.
 * Le mot de passe est fourni en argument : il n'est écrit dans aucun fichier.
 *
 * Usage :
 *   node scripts/_definir-mot-de-passe.mjs email@exemple.com COMPANYID "NouveauMotDePasse"
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');
const { hacherMotDePasse, verifierMotDePasse } = require('../services/authService');

const email = (process.argv[2] || '').toLowerCase().trim();
const companyId = (process.argv[3] || '').toUpperCase().trim();
const motDePasse = process.argv[4];

if (!email || !companyId || !motDePasse) {
  console.error('Usage : node scripts/_definir-mot-de-passe.mjs email@exemple.com COMPANYID "NouveauMotDePasse"');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const compte = await Utilisateur.findOne({ email, companyId });
if (!compte) {
  console.error(`Compte ${email} [${companyId}] introuvable.`);
  await mongoose.disconnect();
  process.exit(1);
}

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

// Relecture en base : confirme que l'empreinte enregistrée valide bien la saisie.
const relu = await Utilisateur.findOne({ email, companyId }).select('+motDePasseHash');
console.log(`Compte ${relu.email} [${relu.companyId}] mis à jour.`);
console.log(`  bloque=${relu.bloque} | tentatives=${relu.tentativesEchouees} | emailVerifie=${relu.emailVerifie} | forcePasswordChange=${relu.forcePasswordChange}`);
console.log(`  vérification de l'empreinte en base : ${verifierMotDePasse(motDePasse, relu.motDePasseHash) ? 'OK' : 'ÉCHEC'}`);

await mongoose.disconnect();
