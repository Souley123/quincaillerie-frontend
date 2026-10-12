const nodemailer = require('nodemailer');

/**
 * CONTRÔLEUR : ENVOI D'E-MAILS
 * ------------------------------------------------------------
 * - envoyerLienConnexion : transmet à un nouvel utilisateur le lien
 *   de connexion à SKYS ERP Solution (appelé par le frontend lors de
 *   la création d'un compte : POST /api/email/lien-connexion).
 *
 * Le mot de passe temporaire n'est JAMAIS inclus dans l'e-mail :
 * l'administrateur le communique de vive voix. Seul le lien est envoyé.
 */

/* Le champ « lienConnexion » est fourni par le frontend : on ne fait pas
   confiance à une URL arbitraire. On n'accepte que http(s) et on borne la
   longueur. Une valeur invalide retombe sur APP_URL (site officiel). */
const lienSur = valeur => {
  if (typeof valeur !== 'string' || valeur.length > 2048) return null;
  try {
    const url = new URL(valeur);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

/* Échappe le HTML pour éviter toute injection depuis le nom, le rôle
   ou le slug (données d'un utilisateur de l'entreprise). */
const echapperHtml = texte =>
  String(texte ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[caractere]));

const creerTransport = () => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;

  const port = Number(process.env.SMTP_PORT || process.env.PORT_USER || 587);
  /* Le mode « secure » (TLS implicite) dépend du port : 465 l'exige,
     alors que 587/25/2525 utilisent STARTTLS (secure = false). Si
     SMTP_SECURE n'est pas fourni, on le déduit du port pour éviter
     un échec de connexion quand seul le port a été changé. */
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000
  });
};

// POST /api/email/lien-connexion
const envoyerLienConnexion = async (req, res) => {
  const { to, nom = '', role = '', codeInitial = '', lienConnexion = '', slug = '' } = req.body || {};

  const emailDestinataire = typeof to === 'string' ? to.trim().toLowerCase() : '';
  if (emailDestinataire.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestinataire)) {
    return res.status(400).json({ error: 'Adresse email du destinataire invalide.' });
  }

  const transport = creerTransport();
  if (!transport) {
    // Le service d'envoi n'est pas configuré : on le signale sans bloquer
    // la création du compte (le frontend retombe sur la transmission manuelle).
    console.error('Envoi du lien de connexion indisponible : SMTP non configuré.');
    return res.status(503).json({ error: "Service d'envoi d'e-mails indisponible." });
  }

  // Le lien doit toujours pointer vers le site officiel, jamais vers une URL
  // arbitraire fournie par le client (protection contre le phishing).
  const lien = lienSur(lienConnexion) || process.env.APP_URL || '';
  if (!lien) {
    return res.status(503).json({ error: "Service d'envoi d'e-mails indisponible." });
  }

  const nomAffiche = String(nom).slice(0, 120);
  const roleAffiche = String(role).slice(0, 60);
  const slugAffiche = String(slug).slice(0, 80);
  const codeAffiche = String(codeInitial).slice(0, 40);

  const sujet = 'Votre accès à SKYS ERP Solution';
  const texte = [
    `Bonjour ${nomAffiche || ''},`.trim(),
    '',
    'Votre compte a été créé sur SKYS ERP Solution.',
    roleAffiche ? `Rôle : ${roleAffiche}` : '',
    slugAffiche ? `Entreprise : ${slugAffiche}` : '',
    codeAffiche ? `Code d'activation : ${codeAffiche}` : '',
    '',
    `Connectez-vous ici : ${lien}`,
    '',
    'Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message.'
  ].filter(ligne => ligne !== '').join('\n');

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: emailDestinataire,
      subject: sujet,
      text: texte,
      html: [
        `<p>Bonjour <strong>${echapperHtml(nomAffiche)}</strong>,</p>`,
        '<p>Votre compte a été créé sur <strong>SKYS ERP Solution</strong>.</p>',
        roleAffiche ? `<p>Rôle : <strong>${echapperHtml(roleAffiche)}</strong></p>` : '',
        slugAffiche ? `<p>Entreprise : <strong>${echapperHtml(slugAffiche)}</strong></p>` : '',
        codeAffiche ? `<p>Code d'activation : <strong>${echapperHtml(codeAffiche)}</strong></p>` : '',
        `<p><a href="${echapperHtml(lien)}">Se connecter à SKYS ERP Solution</a></p>`,
        '<p style="color:#64748b;font-size:12px">Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message.</p>'
      ].filter(Boolean).join('\n')
    });

    return res.status(200).json({ envoye: true, message: 'Lien de connexion envoyé.' });
  } catch (err) {
    console.error("Échec de l'envoi du lien de connexion :", err.message);
    return res.status(502).json({ error: "Impossible d'envoyer l'e-mail de connexion." });
  }
};

module.exports = { envoyerLienConnexion };
