const nodemailer = require('nodemailer');

/**
 * SERVICE : ENVOI D'E-MAIL UNIFIE (SMTP local OU API HTTPS distante)
 * ------------------------------------------------------------------
 * Pourquoi ce module ?
 *   Render (offre gratuite) BLOQUE tout le trafic SMTP sortant : les ports
 *   465, 587 et 2525 renvoient tous ETIMEDOUT. Resultat : impossible de
 *   joindre smtp.gmail.com depuis le serveur heberge, alors que le meme
 *   code fonctionne parfaitement en local.
 *
 *   Les ports 443 (HTTPS) sont, eux, parfaitement ouverts. On passe donc
 *   par l'API HTTP d'un relais d'e-mail (Brevo) lorsque sa cle est fournie.
 *
 * Deux modes, choisis automatiquement :
 *   1. BREVO_API_KEY definie  -> envoi via https://api.brevo.com (port 443)
 *      -> mode a utiliser sur Render.
 *   2. Sinon                  -> SMTP classique (SMTP_HOST/SMTP_USER/...)
 *      -> mode de developpement local.
 *
 * Le module expose la MEME interface que l'ancien creerTransport() :
 *   - creerTransport()          -> { sendMail, mode } ou null si non configure
 *   - envoyerEmail({...})       -> fonctionne dans les deux modes
 *
 * Aucune fonction ne leve d'exception : elles renvoient
 * { envoye: boolean, erreur?: string, mode?: string }.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const validerDestinataire = adresse => {
  const email = String(adresse || '').trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Adresse destinataire invalide: ${email || '(vide)'}`);
  }
  return email;
};
const validerExpediteur = expediteur => {
  if (!expediteur.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expediteur.email)) {
    throw new Error('Adresse expéditeur absente ou invalide (SMTP_FROM ou SMTP_USER).');
  }
  return expediteur;
};
const reponseBrevoAcceptee = reponse => reponse.ok && reponse.status >= 200 && reponse.status < 300;

/* Normalise "Nom <adresse@domaine>" ou "adresse@domaine" vers { nom, email }. */
const analyserExpediteur = (brut, defaut = '') => {
  const valeur = String(brut || defaut || '').trim();
  const correspondance = valeur.match(/^(.*?)<([^>]+)>\s*$/);
  if (correspondance) {
    return {
      nom: correspondance[1].trim().replace(/^"|"$/g, ''),
      email: correspondance[2].trim()
    };
  }
  return { nom: '', email: valeur };
};

const smtpBloqueSurRenderGratuit = () => Boolean(
  process.env.RENDER &&
  process.env.RENDER_SERVICE_TYPE === 'web' &&
  process.env.RENDER_INSTANCE_TYPE === 'free'
);
const modeEnvoi = () => {
  if (process.env.BREVO_API_KEY) return 'api';
  if (smtpBloqueSurRenderGratuit()) return 'indisponible';
  return 'smtp';
};
let transportSmtpPourTests = null;

/* ------------------------------------------------------------------ */
/* Mode 1 : API HTTPS Brevo (port 443)                                 */
/* ------------------------------------------------------------------ */

const envoyerViaApi = async ({ from, to, subject, text, html, replyTo }) => {
  const expediteur = validerExpediteur(analyserExpediteur(from, process.env.SMTP_USER));
  const destinataires = (Array.isArray(to) ? to : [to]).map(validerDestinataire);
  if (!destinataires.length) return { envoye: false, erreur: 'Aucun destinataire fourni.', mode: 'api' };
  if (!subject || (!text && !html)) {
    return { envoye: false, erreur: 'Sujet et contenu du courriel obligatoires.', mode: 'api' };
  }
  const contenu = {
    sender: {
      email: expediteur.email,
      ...(expediteur.nom ? { name: expediteur.nom } : {})
    },
    to: destinataires.map(email => ({ email })),
    subject,
    ...(html ? { htmlContent: html } : {}),
    ...(text ? { textContent: text } : {})
  };
  if (replyTo) {
    const adresseReplyTo = String(replyTo).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresseReplyTo)) {
      return { envoye: false, erreur: 'Adresse reply-to invalide.', mode: 'api' };
    }
    contenu.replyTo = { email: adresseReplyTo };
  }

  // Delai maximal : evite de faire patienter l'utilisateur indefiniment.
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 15000);

  try {
    const reponse = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify(contenu),
      signal: controleur.signal
    });

    const corps = await reponse.text().catch(() => '');

    if (!reponseBrevoAcceptee(reponse)) {
      let message = `HTTP ${reponse.status}`;
      try {
          const json = JSON.parse(corps);
          // Le fournisseur peut inclure des détails sensibles dans ses messages :
          // ne les retransmet pas aux logs/API publiques, conserve le statut seulement.
          if (json && json.code) message += ` — ${String(json.code).slice(0, 80)}`;
        } catch (_) {
          // Ne pas exposer le corps brut d'une erreur distante.
        }
      return { envoye: false, erreur: message, mode: 'api' };
    }

    let id = reponse.headers?.get?.('x-message-id') || null;
    try {
      const json = JSON.parse(corps);
      id = json && (json.messageId || json.id) ? (json.messageId || json.id) : id;
    } catch (_) {
      // Le corps peut être vide selon la réponse du fournisseur.
    }
    return {
      envoye: true,
      mode: 'api',
      id,
      statutHttp: reponse.status,
      recipients: destinataires,
      expediteur: expediteur.email
    };
  } catch (err) {
    const message = err.name === 'AbortError'
      ? "Delai depasse (15 s) lors de l'appel a l'API Brevo."
      : 'API Brevo inaccessible.';
    return { envoye: false, erreur: message, mode: 'api' };
  } finally {
    clearTimeout(minuteur);
  }
};

/* ------------------------------------------------------------------ */
/* Mode 2 : SMTP classique (developpement local)                       */
/* ------------------------------------------------------------------ */

const creerTransportSmtp = () => {
  if (transportSmtpPourTests) {
    return {
      mode: 'smtp',
      async sendMail(options) {
        return transportSmtpPourTests.sendMail(options);
      }
    };
  }
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;

  const port = Number(process.env.SMTP_PORT || process.env.PORT_USER || 587);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD.replace(/\s+/g, '') },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000
  });

  return {
    mode: 'smtp',
    async sendMail(options) {
      const info = await transport.sendMail(options);
      if (!info || !Array.isArray(info.accepted) || info.accepted.length === 0) {
        throw new Error('Le serveur SMTP n’a accepté aucun destinataire.');
      }
      return {
        envoye: true,
        mode: 'smtp',
        id: info.messageId || null,
        accepted: info.accepted,
        rejected: Array.isArray(info.rejected) ? info.rejected : [],
        response: info.response || null,
        envelope: info.envelope || null
      };
    }
  };
};

/**
 * Fabrique un transport utilisable partout, sans se soucier du mode.
 * Renvoie null si rien n'est configure (ni cle API, ni SMTP).
 */
const creerTransport = () => {
  if (process.env.BREVO_API_KEY) {
    const expediteur = analyserExpediteur(
      process.env.SMTP_FROM,
      process.env.SMTP_USER
    );
    return {
      mode: 'api',
      async sendMail(options) {
        const resultat = await envoyerViaApi({
          ...options,
          from: options.from || expediteur.email
        });
        if (!resultat.envoye) {
          const erreur = new Error(resultat.erreur || 'Echec envoi API');
          erreur.mode = 'api';
          erreur.code = resultat.code || 'BREVO_API';
          throw erreur;
        }
        return resultat;
      }
    };
  }
  return creerTransportSmtp();
};

/**
 * Raccourci haut niveau : envoie un e-mail en choisissant le bon canal.
 * Ne leve jamais : renvoie toujours { envoye, erreur?, mode? }.
 */
const envoyerEmail = async ({ from, to, subject, text, html, replyTo }) => {
  const expediteur = from || process.env.SMTP_FROM || process.env.SMTP_USER;

  if (process.env.BREVO_API_KEY) {
    try {
      return await envoyerViaApi({ from: expediteur, to, subject, text, html, replyTo });
    } catch (err) {
      return { envoye: false, erreur: err.message, mode: 'api' };
    }
  }

  if (smtpBloqueSurRenderGratuit()) {
    return {
      envoye: false,
      mode: 'smtp',
      code: 'SMTP_EGRESS_BLOCKED',
      erreur: 'Les connexions SMTP sortantes sont indisponibles sur ce service Render gratuit. Configurez BREVO_API_KEY pour utiliser HTTPS.'
    };
  }

  const transport = creerTransportSmtp();
  if (!transport) {
    return { envoye: false, erreur: 'Aucun canal email configure (ni BREVO_API_KEY ni SMTP).' };
  }

  try {
    validerExpediteur(analyserExpediteur(expediteur, process.env.SMTP_USER));
    const destinataires = (Array.isArray(to) ? to : [to]).map(validerDestinataire);
    if (!destinataires.length) return { envoye: false, erreur: 'Aucun destinataire fourni.', mode: 'smtp' };
    if (!subject || (!text && !html)) return { envoye: false, erreur: 'Sujet et contenu du courriel obligatoires.', mode: 'smtp' };
    if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(replyTo).trim())) {
      return { envoye: false, erreur: 'Adresse reply-to invalide.', mode: 'smtp' };
    }
    const info = await transport.sendMail({
      from: expediteur, to: destinataires.join(', '), subject, text, html,
      ...(replyTo ? { replyTo } : {})
    });
    if (!info || !Array.isArray(info.accepted) || info.accepted.length === 0) {
      return { envoye: false, erreur: 'Le serveur SMTP n’a accepté aucun destinataire.', mode: 'smtp' };
    }
    return {
      envoye: true,
      mode: 'smtp',
      id: info.messageId || null,
      accepted: info.accepted,
      rejected: Array.isArray(info.rejected) ? info.rejected : [],
      response: info.response || null,
      envelope: info.envelope || null
    };
  } catch (err) {
    return { envoye: false, erreur: err.message, mode: 'smtp' };
  }
};

module.exports = {
  creerTransport,
  creerTransportSmtp,
  envoyerEmail,
  modeEnvoi,
  analyserExpediteur,
  _definirTransportSmtpPourTests(transport) {
    transportSmtpPourTests = transport || null;
  }
};
