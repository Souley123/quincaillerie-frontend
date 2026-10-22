
/**
 * VÉRIFICATION DU MESSAGE D'E-MAIL PRODUIT
 * ------------------------------------------------------------
 * Deux questions différentes :
 *
 *   A. « Le message que NOUS fabriquons contient-il ce qu'il faut
 *      (destinataire, sujet, lien) ? »
 *      → vérifié ici, hors réseau, sur le message RÉELLEMENT construit par
 *        services/verificationEmail.js.
 *
 *   B. « Gmail l'a-t-il accepté et livré ? » → un « 250 OK » signifie
 *      ACCEPTÉ, pas reçu. Seul un envoi vers VOTRE adresse le prouve :
 *           node scripts/diagnostic-smtp.mjs votre.adresse@gmail.com
 *      puis vérifier la boîte ET le dossier Spam.
 *
 * Usage :
 *   node scripts/verifier-reception-email.mjs                    # lien de confirmation
 *   node scripts/verifier-reception-email.mjs reinit             # lien de réinitialisation
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: new URL('../.env', import.meta.url) });

const { envoyerVerificationEmail } = require('../services/verificationEmail');
const { construireLienReinitialisation } = require('../services/reinitialisationService');
const { modeEnvoi } = require('../services/envoiEmail');

const destinataire = 'test-reception@exemple.ci';
const decoderQuotedPrintable = texte => String(texte)
  .replace(/=\r?\n/g, '')
  .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

/* Le service utilise sendMail() du transport : on remplace le transport
   réel par une capture, ce qui évite toute connexion tout en laissant
   s'exécuter le VRAI code de construction du message. */
const { _definirTransportSmtpPourTests } = require('../services/envoiEmail');
const capture = { options: null };
_definirTransportSmtpPourTests({
  mode: 'capture',
  async sendMail(options) {
    capture.options = options;
    return {
      envoye: true,
      mode: 'smtp',
      id: 'capture-locale',
      accepted: [].concat(options.to || []),
      rejected: [],
      response: '250 OK (capturé)'
    };
  }
});

const principal = async () => {
  const modeReinit = process.argv[2] === 'reinit';
  console.log('=== A. Contenu du message ===');
  console.log(`Canal configuré : ${modeEnvoi()}`);
  console.log(`Expéditeur      : ${process.env.SMTP_FROM || process.env.SMTP_USER || '(absent)'}`);
  console.log(`APP_URL         : ${process.env.APP_URL || '(absent)'}`);
  console.log('');

  let message;
  let controles;

  if (modeReinit) {
    /* Lien construit par le produit, puis texte IDENTIQUE à celui de
       reinitialisationService.demander(). */
    const lien = construireLienReinitialisation(destinataire, 'a'.repeat(64), 'demo', process.env.APP_URL);
    message = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: destinataire,
      subject: 'Réinitialisation de votre mot de passe SKYS ERP',
      text: `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) : ${lien}`
    };
    controles = {
      lienPresent: message.text.includes(String(lien)),
      lienHttps: /^https:\/\//.test(String(lien)),
      jetonDansLien: /jeton=[a-f0-9]{64}/.test(String(lien)),
      slugDansLien: /slug=demo/.test(String(lien))
    };
  } else {
    /* VRAI service : même code que la route /api/auth/renvoyer-verification. */
    const resultat = await envoyerVerificationEmail({
      email: destinataire,
      nom: 'Test',
      jeton: 'b'.repeat(64)
    });
    message = capture.options;
    controles = { serviceAReussi: resultat?.envoye === true };
  }

  console.log(JSON.stringify(message ? {
    de: message.from,
    a: message.to,
    objet: message.subject,
    debutTexte: String(message.text || '').slice(0, 200)
  } : '(aucun message produit)', null, 2));

  const texte = decoderQuotedPrintable(message?.text || '');
  const html = decoderQuotedPrintable(message?.html || '');
  Object.assign(controles, {
    destinataireCorrect: String(message?.to || '').trim().toLowerCase() === destinataire,
    expediteurAvecAdresse: /@/.test(String(message?.from || '')),
    objetPresent: Boolean(message?.subject),
    textePresent: texte.length > 40,
    htmlPresent: modeReinit ? true : html.includes('Confirmer mon adresse'),
    pasDeMotDePasse: !/mot de passe\s*:\s*\S{6,}/i.test(texte)
  });

  console.log(JSON.stringify(controles, null, 2));
  const a = Object.values(controles).every(Boolean);
  console.log('');
  console.log(`Message produit correct : ${a ? 'OUI' : 'NON'}`);
  console.log('\nPour la livraison réelle, il faut une boîte que vous contrôlez :');
  console.log('  node scripts/diagnostic-smtp.mjs votre.adresse@gmail.com');
  process.exit(a ? 0 : 1);
};

principal().catch(erreur => {
  console.error('Erreur :', erreur.message);
  process.exit(1);
});
