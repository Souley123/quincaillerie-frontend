import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });
const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');

await mongoose.connect(process.env.MONGODB_URI);
const cible = { email: 'ksouleymanesoro60@gmail.com', companyId: 'MAQUINCAILLERIE' };
const maj = await Utilisateur.updateOne(cible, {
  $set: { bloqueReinitialisation: false, reinitialisations: 0, tentativesEchouees: 0 },
  $inc: { verrouillageVersion: 1 }
});
console.log('modifiés :', maj.modifiedCount);
const u = await Utilisateur.findOne(cible).select('email companyId reinitialisations bloqueReinitialisation');
console.log(JSON.stringify(u));
await mongoose.disconnect();
