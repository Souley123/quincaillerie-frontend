import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

const { envoyerEmail } = require('../services/envoiEmail');

console.log('Expéditeur :', JSON.stringify(process.env.SMTP_FROM));
const r = await envoyerEmail({
  from: process.env.SMTP_FROM,
  to: 'supportskys@gmail.com',
  subject: 'Vérification finale — SKYS ERP',
  text: 'Ce message confirme que le service d’envoi fonctionne.'
});
console.log('Résultat :', JSON.stringify(r, null, 2));
