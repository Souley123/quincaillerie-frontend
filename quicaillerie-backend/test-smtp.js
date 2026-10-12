/**
 * Test ponctuel de la configuration SMTP (.env).
 * Vérifie les identifiants puis envoie un e-mail de test à ADMIN_EMAIL.
 * Usage : node test-smtp.js
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const requis = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'];
const manquants = requis.filter(cle => !process.env[cle]);
if (manquants.length) {
  console.error('Variables SMTP manquantes :', manquants.join(', '));
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
});

(async () => {
  try {
    console.log(`Connexion à ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} en tant que ${process.env.SMTP_USER}...`);
    await transporter.verify();
    console.log('OK : le serveur SMTP accepte les identifiants.');

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      subject: '[ERP] Test de configuration SMTP',
      text: 'Ceci est un e-mail de test envoyé par test-smtp.js. Si vous le recevez, la configuration SMTP est opérationnelle.'
    });
    console.log('OK : e-mail envoyé. ID =', info.messageId, '| réponse =', info.response);
  } catch (err) {
    console.error('ÉCHEC :', err.message);
    if (err.response) console.error('Réponse SMTP :', err.response);
    process.exit(1);
  }
})();
