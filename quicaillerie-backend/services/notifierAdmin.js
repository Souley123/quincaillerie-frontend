const { creerTransport } = require('./envoiEmail');

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
  const { SMTP_USER, ADMIN_EMAIL } = process.env;

  if (!ADMIN_EMAIL) return false;

  /* creerTransport() renvoie null si aucun canal n'est configure
     (ni BREVO_API_KEY ni SMTP_HOST/SMTP_USER/SMTP_PASSWORD). */
  const transport = creerTransport();
  if (!transport) return false;

  try {
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
