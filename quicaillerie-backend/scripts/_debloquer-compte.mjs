/**
 * DÉBLOCAGE D'UN COMPTE (verrou de tentatives échouées).
 *
 * Le serveur renvoie 423 « Compte temporairement verrouillé après plusieurs
 * tentatives » et refuse TOUT mot de passe, y compris le bon, jusqu'à
 * l'expiration du délai ou un déblocage explicite.
 *
 * Usage : node scripts/_debloquer-compte.mjs email@exemple.com [companyId]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');

const email = (process.argv[2] || '').toLowerCase().trim();
const companyId = process.argv[3];

if (!email) {
  console.error('Usage : node scripts/_debloquer-compte.mjs email@exemple.com [companyId]');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const filtre = { email, ...(companyId ? { companyId } : {}) };
const comptes = await Utilisateur.find(filtre).select('email companyId bloque bloqueJusqua tentativesEchouees bloqueReinitialisation reinitialisations');

console.log(`Comptes trouvés : ${comptes.length}`);
for (const compte of comptes) {
  console.log(`  ${compte.email} [${compte.companyId}]`);
  console.log(`    bloque=${compte.bloque} jusqu'à=${compte.bloqueJusqua ? new Date(compte.bloqueJusqua).toISOString() : '—'}`);
  console.log(`    tentativesEchouees=${compte.tentativesEchouees} bloqueReinitialisation=${compte.bloqueReinitialisation} reinitialisations=${compte.reinitialisations}`);
}

const maj = await Utilisateur.updateMany(filtre, {
  $set: { bloque: false, bloqueJusqua: null, tentativesEchouees: 0, bloqueReinitialisation: false, reinitialisations: 0 },
  $inc: { verrouillageVersion: 1 }
});
console.log(`\nComptes débloqués : ${maj.modifiedCount}`);

const apres = await Utilisateur.find(filtre).select('email companyId bloque bloqueJusqua tentativesEchouees bloqueReinitialisation');
apres.forEach(c => console.log(`  après → ${c.email} [${c.companyId}] bloque=${c.bloque} tentatives=${c.tentativesEchouees} bloqueReinit=${c.bloqueReinitialisation}`));

await mongoose.disconnect();
