/**
 * Un seul envoi de réinitialisation (pour vérification manuelle).
 * Pose un jeton connu, demande l'envoi réel, puis affiche le lien exact
 * contenu dans l'e-mail — sans consommer le jeton (pas de confirmation).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

const crypto = require('crypto');
const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');
const { construireLienReinitialisation } = require('../services/reinitialisationService');
const { envoyerEmail } = require('../services/envoiEmail');

const EMAIL = 'ksouleymanesoro60@gmail.com';
const SLUG = 'maquincaillerie';
const hashJeton = jeton => crypto.createHash('sha256').update(jeton).digest('hex');

await mongoose.connect(process.env.MONGODB_URI);
const utilisateur = await Utilisateur.findOne({ email: EMAIL, companyId: 'MAQUINCAILLERIE' })
  .select('+reinitialisationHash +reinitialisationExpire');
if (!utilisateur) {
  console.error('Compte introuvable.');
  process.exit(1);
}

const jeton = crypto.randomBytes(32).toString('hex');
utilisateur.reinitialisationHash = hashJeton(jeton);
utilisateur.reinitialisationExpire = new Date(Date.now() + 30 * 60 * 1000);
await utilisateur.save();

const lien = construireLienReinitialisation(EMAIL, jeton, SLUG, process.env.APP_URL).toString();
const resultat = await envoyerEmail({
  from: process.env.SMTP_FROM,
  to: EMAIL,
  subject: 'Réinitialisation de votre mot de passe SKYS ERP',
  text: `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) : ${lien}`
});

console.log('Envoi :', JSON.stringify(resultat));
console.log('\nLIEN EXACT ENVOYÉ :\n' + lien);
await mongoose.disconnect();
