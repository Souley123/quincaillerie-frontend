/**
 * ÉTAT D'ABONNEMENT : pourquoi l'accès est-il bloqué par « essai expiré » ?
 *
 * Le serveur renvoie 402 quand :
 *   - entreprise.abonnementActif === false, OU
 *   - entreprise.abonnementEcheance est dépassée.
 *
 * À l'inscription, un email DÉJÀ UTILISÉ par une autre entreprise démarre
 * volontairement SANS essai (anti-abus) : abonnementActif = false et échéance
 * dans le passé. C'est le cas le plus fréquent de ce blocage.
 *
 * Usage : node scripts/_etat-abonnement.mjs [email]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

const mongoose = require('mongoose');
const Entreprise = require('../models/Entreprise');
const Utilisateur = require('../models/Utilisateur');

const email = process.argv[2] || 'ksouleymanesoro60@gmail.com';

await mongoose.connect(process.env.MONGODB_URI);

const utilisateurs = await Utilisateur.find({ email }).select('email companyId role actif emailVerifie forcePasswordChange').lean();
console.log(`Comptes pour ${email} :`, utilisateurs.length);

for (const utilisateur of utilisateurs) {
  const entreprise = await Entreprise.findOne({ companyId: utilisateur.companyId }).lean();
  if (!entreprise) {
    console.log(`\n[${utilisateur.companyId}] aucune entreprise associée`);
    continue;
  }
  const echeance = entreprise.abonnementEcheance ? new Date(entreprise.abonnementEcheance) : null;
  const passee = echeance ? echeance.getTime() < Date.now() : false;
  console.log(`\nEntreprise ${entreprise.slug} (${entreprise.companyId})`);
  console.log('  raisonSociale     :', entreprise.raisonSociale);
  console.log('  actif             :', entreprise.actif);
  console.log('  abonnementActif   :', entreprise.abonnementActif);
  console.log('  abonnementEcheance:', echeance ? echeance.toISOString() : 'aucune', passee ? '→ DÉPASSÉE' : '→ valide');
  console.log('  palier            :', entreprise.palier);
  console.log('  → accès autorisé  :', entreprise.actif !== false && entreprise.abonnementActif && !passee ? 'OUI' : 'NON (402 essai/abonnement expiré)');
  console.log('  → utilisateur     :', utilisateur.role, '| actif:', utilisateur.actif, '| email vérifié:', utilisateur.emailVerifie);
}

await mongoose.disconnect();
