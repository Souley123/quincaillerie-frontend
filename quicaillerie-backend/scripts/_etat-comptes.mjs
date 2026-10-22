/**
 * VERROU DEFINITIF : l'écran de connexion ne demande pas le slug.
 *
 * L'API `/api/auth/login` cherche l'utilisateur PAR EMAIL SEUL. Avec deux
 * comptes partageant la même adresse, `findOne` retombe sur un compte
 * arbitraire : l'utilisateur peut fournir le bon mot de passe de l'autre
 * compte et être refusé indéfiniment.
 *
 * Ce script rend la situation explicite : combien de comptes existe-t-il pour
 * cette adresse, dans quelles entreprises, et lequel est réellement atteint.
 *
 * Usage : node scripts/_etat-comptes.mjs email@exemple.com
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');
const Entreprise = require('../models/Entreprise');

const email = (process.argv[2] || '').toLowerCase().trim();
await mongoose.connect(process.env.MONGODB_URI);

const comptes = await Utilisateur.find({ email }).select('email companyId role actif emailVerifie forcePasswordChange bloque tentativesEchouees createdAt').sort({ createdAt: 1 });

console.log(`Comptes pour ${email} : ${comptes.length}\n`);
for (const compte of comptes) {
  const entreprise = await Entreprise.findOne({ companyId: compte.companyId }).select('slug raisonSociale actif abonnementActif abonnementEcheance').lean();
  const echeance = entreprise?.abonnementEcheance ? new Date(entreprise.abonnementEcheance) : null;
  console.log(`• [${compte.companyId}] slug=${entreprise?.slug || '?'} — ${entreprise?.raisonSociale || '?'}`);
  console.log(`   rôle=${compte.role} | actif=${compte.actif} | emailVerifie=${compte.emailVerifie} | forcePasswordChange=${compte.forcePasswordChange}`);
  console.log(`   bloque=${compte.bloque} | tentatives=${compte.tentativesEchouees}`);
  console.log(`   abonnementActif=${entreprise?.abonnementActif} | échéance=${echeance ? echeance.toISOString() : 'aucune'}${echeance && echeance.getTime() < Date.now() ? ' (DÉPASSÉE)' : ''}`);
  console.log(`   créé le ${new Date(compte.createdAt).toISOString()}\n`);
}

// Ce que le serveur ACTUEL renvoie pour cet email (sans slug) : le premier
// document trouvé par MongoDB, pas le compte « attendu ».
const atteint = await Utilisateur.findOne({ email });
console.log(`Compte réellement atteint par /login (findOne par email) : ${atteint ? `[${atteint.companyId}]` : 'aucun'}`);

await mongoose.disconnect();
