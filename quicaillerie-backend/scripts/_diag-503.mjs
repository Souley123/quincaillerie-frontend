/**
 * REPRODUIT LE 503 DE LA RÉINITIALISATION EN PRODUCTION
 *
 * On exécute le VRAI service de réinitialisation avec les variables
 * d'environnement de production (pas de SMTP, Brevo seul, comme sur Render)
 * et on affiche le journal du serveur pour identifier la branche responsable.
 *
 * Usage : node scripts/_diag-503.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

// Configuration de Render : Brevo seul, aucun SMTP, service payant.
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASSWORD = '';
process.env.BREVO_API_KEY = process.env.BREVO_API_KEY || '';
delete process.env.RENDER;

const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');
const Entreprise = require('../models/Entreprise');
const { envoyerEmail } = require('../services/envoiEmail');

// On capture la VRAIE tentative d'envoi pour éviter un e-mail réel.
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  console.log('  → appel fournisseur :', url);
  return originalFetch(url, { method: 'GET', headers: options?.headers }).catch(() => null);
};

await mongoose.connect(process.env.MONGODB_URI);
const compte = await Utilisateur.findOne({ email: 'ksouleymanesoro60@gmail.com', companyId: 'MAQUINCAILLERIE' });
const entreprise = await Entreprise.findOne({ companyId: 'MAQUINCAILLERIE' });

console.log('Vérifications préalables :');
console.log('  compte trouvé        :', Boolean(compte));
console.log('  bloqueReinitialisation:', compte?.bloqueReinitialisation);
console.log('  BREVO_API_KEY        :', process.env.BREVO_API_KEY ? 'présente' : 'ABSENTE');
console.log('  SMTP_FROM            :', JSON.stringify(process.env.SMTP_FROM));
console.log('  SMTP_USER            :', JSON.stringify(process.env.SMTP_USER));
console.log('  APP_URL              :', JSON.stringify(process.env.APP_URL));

const { construireLienReinitialisation } = require('../services/reinitialisationService');
try {
  const lien = construireLienReinitialisation(compte.email, 'a'.repeat(64), entreprise.slug, process.env.APP_URL);
  console.log('  lien construit       :', lien.toString().replace('a'.repeat(64), '…'));
} catch (erreur) {
  console.log('  ERREUR de construction du lien :', erreur.message);
}

console.log('\nAppel réel du service d\'envoi (Brevo) :');
const resultat = await envoyerEmail({
  from: process.env.SMTP_FROM,
  to: compte.email,
  subject: 'Diagnostic 503',
  text: 'Test de diagnostic'
});
console.log('  résultat :', JSON.stringify(resultat));

await mongoose.disconnect();
