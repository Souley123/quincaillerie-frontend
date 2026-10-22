/**
 * TEST DE L'ENVOI D'E-MAIL VIA BREVO (API HTTPS)
 * ------------------------------------------------------------
 * Envoie un vrai message avec le code de production
 * (services/envoiEmail.js) et affiche la RÉPONSE BRUTE en cas d'échec.
 *
 * Pourquoi ce script ? « L'e-mail n'arrive pas » a plusieurs causes très
 * différentes, et elles ne se corrigent pas au même endroit :
 *   - clé API invalide / expirée            → 401
 *   - expéditeur non validé dans Brevo      → 400 « sender not valid »
 *   - destinataire bloqué (liste noire)     → 400 « blocked »
 *   - quota quotidien atteint               → 400 « quota »
 *
 * Usage :
 *   node scripts/test-brevo.mjs votre.adresse@gmail.com
 *   node scripts/test-brevo.mjs votre.adresse@gmail.com autre.expediteur@domaine.tld
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: new URL('../.env', import.meta.url) });

const { envoyerEmail, modeEnvoi, analyserExpediteur } = require('../services/envoiEmail');

const destinataire = process.argv[2];
const expediteur = process.argv[3] || process.env.SMTP_FROM || process.env.SMTP_USER;

if (!destinataire || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
  console.error('Usage : node scripts/test-brevo.mjs <adresse.destinataire@domaine> [expediteur]');
  process.exit(1);
}

const principal = async () => {
  console.log('Canal détecté :', modeEnvoi());
  console.log('Expéditeur    :', JSON.stringify(expediteur), '→', JSON.stringify(analyserExpediteur(expediteur, process.env.SMTP_USER)));
  console.log('Destinataire  :', destinataire);
  console.log('Clé Brevo     :', process.env.BREVO_API_KEY ? `présente (${process.env.BREVO_API_KEY.slice(0, 12)}…)` : 'ABSENTE');
  console.log('\nEnvoi en cours…\n');

  const debut = Date.now();
  const resultat = await envoyerEmail({
    from: expediteur,
    to: destinataire,
    subject: 'Test SKYS ERP — envoi Brevo',
    text: `Ce message confirme que l'envoi d'e-mails fonctionne.\n\nEnvoyé le ${new Date().toISOString()} depuis le script de test.`,
    html: `<p>Ce message confirme que l'envoi d'e-mails fonctionne.</p><p style="color:#64748b;font-size:12px">${new Date().toISOString()}</p>`
  });

  console.log('Durée         :', Math.round((Date.now() - debut) / 100) / 10, 's');
  console.log('Résultat brut :', JSON.stringify(resultat, null, 2));

  if (resultat?.envoye) {
    console.log('\nVERDICT : Brevo a ACCEPTÉ le message.');
    console.log('Cela signifie « pris en charge », pas encore « reçu » : vérifiez la boîte');
    console.log('de réception ET le dossier Spam dans les 2 minutes.');
    process.exit(0);
  }

  console.log('\nVERDICT : échec de l\'envoi.');
  const erreur = String(resultat?.erreur || '');
  if (/^HTTP 401/.test(erreur) || /unauthorized|api-key|key not found/i.test(erreur)) {
    console.log('→ Clé API refusée. Régénérez-la dans Brevo (SMTP & API → API Keys) et recopiez-la sans espace.');
  } else if (/sender|exp[ée]diteur/i.test(erreur) || /^HTTP 400/.test(erreur)) {
    console.log('→ Expéditeur refusé ou requête invalide. Vérifiez que l\'adresse de SMTP_FROM');
    console.log('  est VALIDÉE dans Brevo (Senders) et que le compte n\'est pas bloqué.');
    console.log('  Essayez : node scripts/test-brevo.mjs ' + destinataire + ' lAdresseValideeChezBrevo@exemple.com');
  } else if (/quota|limit/i.test(erreur)) {
    console.log('→ Quota atteint : attendez la réinitialisation quotidienne ou vérifiez le forfait.');
  }
  process.exit(1);
};

principal().catch(erreur => {
  console.error('Erreur inattendue :', erreur.message);
  process.exit(1);
});
