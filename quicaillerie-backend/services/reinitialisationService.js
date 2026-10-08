const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Utilisateur = require('../models/Utilisateur');
const { notifierAdmin } = require('./notifierAdmin');

const hashJeton = jeton => crypto.createHash('sha256').update(jeton).digest('hex');
const limiterReinitialisation = new Map();
const messageGenerique = 'Si ce compte existe, un lien de réinitialisation lui sera envoyé.';

/* Au-delà de ce nombre de réinitialisations, le compte est bloqué et seul un
   administrateur peut le débloquer. */
const SEUIL_REINITIALISATIONS = 3;

const demander = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  const ip = String(req.ip || req.socket?.remoteAddress || 'inconnu').slice(0, 80);
  const cleLimite = hashJeton(`${ip}|${email}`);
  const maintenant = Date.now();
  const limite = limiterReinitialisation.get(cleLimite) || { debut: maintenant, count: 0 };
  if (maintenant - limite.debut >= 60 * 60 * 1000) {
    limite.debut = maintenant;
    limite.count = 0;
  }
  if (limite.count >= 3) {
    return res.json({ message: messageGenerique });
  }
  limite.count += 1;
  limiterReinitialisation.set(cleLimite, limite);
  if (limiterReinitialisation.size > 10000) {
    for (const [key, entry] of limiterReinitialisation) {
      if (maintenant - entry.debut >= 60 * 60 * 1000) limiterReinitialisation.delete(key);
    }
  }

  try {
    const utilisateur = await Utilisateur.findOne({ email, actif: true });
    if (utilisateur) {
      // Compte bloqué à cause de trop de réinitialisations : on refuse
      // silencieusement (message générique) et on prévient l'administrateur.
      if (utilisateur.bloqueReinitialisation) {
        console.warn(`Réinitialisation refusée : compte « ${email} » bloqué (seuil dépassé).`);
        return res.json({ message: messageGenerique });
      }

      const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, APP_URL } = process.env;
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !APP_URL) {
        console.error('Réinitialisation indisponible : SMTP ou APP_URL non configuré.');
        return res.json({ message: messageGenerique });
      }

      const urlApp = new URL(APP_URL);
      if (urlApp.protocol !== 'https:' || urlApp.username || urlApp.password) {
        throw new Error('APP_URL doit être une URL HTTPS valide sans identifiants.');
      }
      const jeton = crypto.randomBytes(32).toString('hex');
      const lien = new URL('/mot-de-passe/reinitialiser', APP_URL);
      // Ne jamais exposer le jeton à des tiers via Referer ou le cache partagé.
      res.set('Cache-Control', 'no-store');
      res.set('Referrer-Policy', 'no-referrer');
      lien.searchParams.set('jeton', jeton);
      lien.searchParams.set('email', email);
      // La version hébergée sous /quincaillerie-frontend/ conserve ce préfixe.
      const basePath = urlApp.pathname.replace(/\/$/, '');
      lien.pathname = `${basePath}/mot-de-passe/reinitialiser`;
      const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000
      });
      const ancienHash = utilisateur.reinitialisationHash;
      const ancienneExpiration = utilisateur.reinitialisationExpire;
      utilisateur.reinitialisationHash = hashJeton(jeton);
      utilisateur.reinitialisationExpire = new Date(Date.now() + 30 * 60 * 1000);
      await utilisateur.save();
      try {
        await transport.sendMail({
          from: process.env.SMTP_FROM || SMTP_USER,
          to: email,
          subject: 'Réinitialisation de votre mot de passe SKYS ERP',
          text: `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) : ${lien}`
        });
      } catch (erreurEnvoi) {
        utilisateur.reinitialisationHash = ancienHash;
        utilisateur.reinitialisationExpire = ancienneExpiration;
        await utilisateur.save();
        throw erreurEnvoi;
      }
    }
    return res.json({ message: messageGenerique });
  } catch (err) {
    console.error('Réinitialisation indisponible :', err.message);
    return res.status(503).json({ error: 'Service de réinitialisation indisponible.' });
  }
};

const confirmer = async (req, res) => {
  const { email, jeton, motDePasse } = req.body || {};
  if (typeof jeton !== 'string' || !/^[a-f0-9]{64}$/.test(jeton) || typeof motDePasse !== 'string' || motDePasse.length < 12) {
    return res.status(400).json({ error: 'Lien invalide ou mot de passe trop court (12 caractères minimum).' });
  }
  try {
    const utilisateur = await Utilisateur.findOne({
      email: String(email || '').trim().toLowerCase(), actif: true,
      reinitialisationHash: hashJeton(jeton), reinitialisationExpire: { $gt: new Date() }
    }).select('+reinitialisationHash +reinitialisationExpire');
    if (!utilisateur) return res.status(400).json({ error: 'Lien invalide ou expiré.' });

    const { hacherMotDePasse } = require('./authService');
    utilisateur.motDePasseHash = hacherMotDePasse(motDePasse);
    utilisateur.reinitialisationHash = null;
    utilisateur.reinitialisationExpire = null;
    utilisateur.bloque = false;
    utilisateur.bloqueJusqua = null;
    utilisateur.tentativesEchouees = 0;
    utilisateur.verrouillageVersion = (utilisateur.verrouillageVersion || 0) + 1;

    // Compteur de réinitialisations : au-delà du seuil, le compte est bloqué
    // et seul un administrateur pourra le débloquer.
    utilisateur.reinitialisations = (utilisateur.reinitialisations || 0) + 1;

    if (utilisateur.reinitialisations >= SEUIL_REINITIALISATIONS) {
      utilisateur.bloqueReinitialisation = true;
      await utilisateur.save();

      await notifierAdmin({
        sujet: `Compte bloqué — ${utilisateur.email}`,
        texte: [
          `Le compte « ${utilisateur.email} » a été réinitialisé ${utilisateur.reinitialisations} fois.`,
          'Conformément à la politique de sécurité, il a été BLOQUÉ.'
        ].join('\n')
      });

      return res.json({
        message:
          'Mot de passe modifié. Ce compte a atteint la limite de réinitialisations : un administrateur doit désormais le débloquer.'
      });
    }

    await utilisateur.save();
    return res.json({
      message: `Mot de passe modifié. Réinitialisations utilisées : ${utilisateur.reinitialisations}/${SEUIL_REINITIALISATIONS}.`
    });
  } catch (err) {
    console.error('Confirmation de réinitialisation :', err);
    return res.status(500).json({ error: 'Impossible de modifier le mot de passe.' });
  }
};

module.exports = { demander, confirmer };
