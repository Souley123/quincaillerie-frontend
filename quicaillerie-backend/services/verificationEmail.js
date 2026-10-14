const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * SERVICE : VÉRIFICATION D'ADRESSE EMAIL À L'INSCRIPTION
 * ------------------------------------------------------------
 * But : empêcher l'usage d'adresses JETABLES ou inexistantes pour
 * multiplier les essais gratuits.
 *
 * Principe :
 *   1. À l'inscription, on génère un jeton aléatoire à usage unique et on
 *      l'envoie par e-mail. Tant qu'il n'est pas confirmé, l'accès reste
 *      limité (bandeau « vérifiez votre e-mail »).
 *   2. Le jeton n'est jamais stocké en clair : on conserve son EMPREINTE
 *      SHA-256 et une date d'expiration.
 *
 * NB : la vérification est « douce » (non bloquante au niveau 402) pour ne
 * pas bloquer un client légitime dont le SMTP est momentanément indisponible ;
 * l'anti-abus dur (échéance liée à l'email) reste la protection principale.
 */

const DUREE_JETON_HEURES = 48;

/* Transport SMTP partagé (mêmes variables d'environnement que les autres
   services : SMTP_HOST / SMTP_USER / SMTP_PASSWORD / SMTP_PORT). */
const creerTransport = () => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;

  const port = Number(process.env.SMTP_PORT || process.env.PORT_USER || 587);
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

const echapperHtml = texte =>
  String(texte ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[caractere]));

/* Empreinte non réversible d'un jeton (jamais le jeton en clair en base). */
const empreinte = jeton =>
  crypto.createHash('sha256').update(String(jeton)).digest('hex');

/* Nouveau jeton de vérification : valeur claire + empreinte à stocker. */
const genererJetonVerification = () => {
  const jeton = crypto.randomBytes(32).toString('hex');
  return {
    jeton,
    empreinteJeton: empreinte(jeton),
    expire: new Date(Date.now() + DUREE_JETON_HEURES * 60 * 60 * 1000)
  };
};

/* Le jeton fourni correspond-il à l'empreinte stockée ET est-il encore valide ? */
const jetonValide = (empreinteStockee, expiree, jetonFourni) => {
  if (!empreinteStockee || !jetonFourni) return false;
  if (expiree && new Date(expiree).getTime() < Date.now()) return false;
  const fournie = empreinte(jetonFourni);
  // Comparaison à temps constant : évite les attaques temporelles.
  const a = Buffer.from(fournie);
  const b = Buffer.from(String(empreinteStockee));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/* Construit le lien de confirmation (pointe vers APP_URL/frontend). */
const construireLienVerification = (jeton, email) => {
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  if (!base) return '';
  const url = new URL(base);
  url.searchParams.set('verifierEmail', jeton);
  url.searchParams.set('email', String(email || '').toLowerCase());
  return url.toString();
};

/**
 * Envoie l'e-mail de vérification.
 * Renvoie { envoye: boolean, erreur?: string }. Ne lève jamais :
 * l'inscription ne doit pas échouer si le SMTP est indisponible.
 */
const envoyerVerificationEmail = async ({ email, nom = '', jeton = '' }) => {
  const destinataire = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (destinataire.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
    return { envoye: false, erreur: 'Adresse email invalide.' };
  }

  const transport = creerTransport();
  if (!transport) return { envoye: false, erreur: 'SMTP non configuré.' };

  const lien = construireLienVerification(jeton, destinataire);
  if (!lien) return { envoye: false, erreur: 'APP_URL non configurée.' };

  const nomAffiche = String(nom).slice(0, 120);

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: destinataire,
      subject: 'Confirmez votre adresse e-mail — SKYS ERP Solution',
      text: [
        `Bonjour ${nomAffiche || ''},`.trim(),
        '',
        'Confirmez votre adresse e-mail pour activer toutes les fonctions de votre compte.',
        `${lien}`,
        '',
        `Ce lien expire dans ${DUREE_JETON_HEURES} heures.`,
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
      ].join('\n'),
      html: [
        `<p>Bonjour <strong>${echapperHtml(nomAffiche)}</strong>,</p>`,
        '<p>Confirmez votre adresse e-mail pour activer toutes les fonctions de votre compte.</p>',
        `<p><a href="${echapperHtml(lien)}">Confirmer mon adresse e-mail</a></p>`,
        `<p style="color:#64748b;font-size:12px">Ce lien expire dans ${DUREE_JETON_HEURES} heures.</p>`
      ].join('\n')
    });
    return { envoye: true };
  } catch (err) {
    console.error("Échec de l'envoi de la vérification e-mail :", err.message);
    return { envoye: false, erreur: err.message };
  }
};

module.exports = {
  DUREE_JETON_HEURES,
  genererJetonVerification,
  jetonValide,
  construireLienVerification,
  envoyerVerificationEmail,
  creerTransport
};
