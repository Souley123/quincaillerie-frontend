const crypto = require('crypto');
const { envoyerEmail } = require('./envoiEmail');

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
const MILLISECONDES_PAR_HEURE = 60 * 60 * 1000;
const URL_APPLICATION_PAR_DEFAUT = 'https://souley123.github.io/quincaillerie-frontend';
const MESSAGE_ERREUR_URL = 'APP_URL doit être une URL HTTPS valide sans paramètres ni identifiants.';
const MESSAGE_ERREUR_ENVOI = 'Le fournisseur e-mail n’a pas confirmé la prise en charge du message.';
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const configurationEmailDisponible = (env = process.env) => Boolean(
  env.BREVO_API_KEY || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD)
);

const smtpBloqueSurRenderGratuit = (env = process.env) => Boolean(
  env.RENDER && env.RENDER_SERVICE_TYPE === 'web' && env.RENDER_INSTANCE_TYPE === 'free'
);

/* Adaptateur léger vers le fournisseur configuré dans services/envoiEmail.js. */
const creerTransport = () => configurationEmailDisponible() &&
  (process.env.BREVO_API_KEY || !smtpBloqueSurRenderGratuit())
  ? { sendMail: options => envoyerEmail(options) }
  : null;

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
    expire: new Date(Date.now() + DUREE_JETON_HEURES * MILLISECONDES_PAR_HEURE)
  };
};

const estExpire = expiree => {
  if (!expiree) return false;
  const horodatageExpiration = new Date(expiree).getTime();
  return !Number.isFinite(horodatageExpiration) || horodatageExpiration < Date.now();
};

/* Compare les empreintes à temps constant après validation du format stocké. */
const jetonValide = (empreinteStockee, expiree, jetonFourni) => {
  if (!empreinteStockee || !jetonFourni || estExpire(expiree)) return false;

  const fournie = Buffer.from(empreinte(jetonFourni), 'hex');
  const stockee = Buffer.from(String(empreinteStockee), 'hex');
  return fournie.length === stockee.length && fournie.length > 0 && crypto.timingSafeEqual(fournie, stockee);
};

/* Construit le lien de confirmation (pointe vers APP_URL/frontend). */
const construireLienVerification = (jeton, email) => {
  const base = process.env.APP_URL || URL_APPLICATION_PAR_DEFAUT;
  let url;

  try {
    url = new URL(base);
  } catch {
    throw new Error(MESSAGE_ERREUR_URL);
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(MESSAGE_ERREUR_URL);
  }
  url.searchParams.set('verifierEmail', String(jeton || ''));
  url.searchParams.set('email', String(email || '').toLowerCase());
  return url.toString();
};

const normaliserEmail = email => typeof email === 'string' ? email.trim().toLowerCase() : '';

const creerContenuEmail = ({ nom, lien, destinataire }) => {
  const nomAffiche = String(nom ?? '').slice(0, 120);
  return {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destinataire,
    subject: 'Confirmez votre adresse e-mail — SKYS ERP Solution',
    text: [
      `Bonjour ${nomAffiche || ''},`.trim(),
      '',
      'Confirmez votre adresse e-mail pour activer toutes les fonctions de votre compte.',
      lien,
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
  };
};

const resultatEchec = erreur => ({ envoye: false, erreur });

/**
 * Envoie l'e-mail de vérification.
 * Renvoie { envoye: boolean, erreur?: string }. Ne lève jamais :
 * l'inscription ne doit pas échouer si le fournisseur mail est indisponible.
 */
const envoyerVerificationEmail = async ({ email, nom = '', jeton = '' } = {}) => {
  const destinataire = normaliserEmail(email);
  if (destinataire.length > 254 || !FORMAT_EMAIL.test(destinataire)) {
    return resultatEchec('Adresse email invalide.');
  }

  const transport = creerTransport();
  if (!transport) {
    return resultatEchec(smtpBloqueSurRenderGratuit()
      ? 'L’envoi SMTP est bloqué sur Render gratuit. Configurez BREVO_API_KEY pour utiliser HTTPS.'
      : 'Aucun canal e-mail configuré.');
  }

  try {
    const lien = construireLienVerification(jeton, destinataire);
    const message = creerContenuEmail({ nom, lien, destinataire });
    const resultat = await transport.sendMail(message);

    if (!resultat || resultat.envoye !== true) {
      const erreur = resultat?.erreur || MESSAGE_ERREUR_ENVOI;
      console.error("Échec de l'envoi de la vérification e-mail :", erreur);
      return resultatEchec(erreur);
    }

    return { envoye: true, mode: resultat.mode || transport.mode, id: resultat.id || null };
  } catch (err) {
    const erreur = err instanceof Error ? err.message : String(err);
    console.error("Échec de l'envoi de la vérification e-mail :", erreur);
    return resultatEchec(erreur);
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
