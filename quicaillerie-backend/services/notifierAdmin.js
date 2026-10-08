const nodemailer = require('nodemailer');

/**
 * NOTIFICATION DE L'ADMINISTRATEUR
 * ------------------------------------------------------------
 * Envoie un message d'alerte à l'adresse ADMIN_EMAIL lorsque la
 * configuration SMTP est présente. Utilisé notamment pour signaler
 * un compte bloqué après trop de réinitialisations de mot de passe.
 *
 * L'échec d'envoi ne doit jamais faire échouer l'action métier :
 * la fonction renvoie simplement `false`.
 */
const notifierAdmin = async ({ sujet, texte }) => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, ADMIN_EMAIL } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !ADMIN_EMAIL) {
    return false;
  }

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
    });

    await transport.sendMail({
      from: process.env.SMTP_FROM || SMTP_USER,
      to: ADMIN_EMAIL,
      subject: `[ERP] ${sujet}`,
      text: texte
    });

    return true;
  } catch (err) {
    console.error('Notification administrateur échouée :', err.message);
    return false;
  }
};

module.exports = { notifierAdmin };
