const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Utilisateur = require('../models/Utilisateur');

const hashJeton = jeton => crypto.createHash('sha256').update(jeton).digest('hex');
const messageGenerique = 'Si ce compte existe, un lien de réinitialisation lui sera envoyé.';

const demander = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  try {
    const utilisateur = await Utilisateur.findOne({ email, actif: true });
    if (utilisateur) {
      const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, APP_URL } = process.env;
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !APP_URL) {
        console.error('Réinitialisation indisponible : SMTP ou APP_URL non configuré.');
        return res.json({ message: messageGenerique });
      }

      const jeton = crypto.randomBytes(32).toString('hex');
      const lien = new URL('/mot-de-passe/reinitialiser', APP_URL);
      lien.searchParams.set('jeton', jeton);
      lien.searchParams.set('email', email);
      // La version hébergée sous /quincaillerie-frontend/ conserve ce préfixe.
      const basePath = new URL(APP_URL).pathname.replace(/\/$/, '');
      lien.pathname = `${basePath}/mot-de-passe/reinitialiser`;
      const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
      });
      utilisateur.reinitialisationHash = hashJeton(jeton);
      utilisateur.reinitialisationExpire = new Date(Date.now() + 30 * 60 * 1000);
      await utilisateur.save();
      await transport.sendMail({
        from: process.env.SMTP_FROM || SMTP_USER,
        to: email,
        subject: 'Réinitialisation de votre mot de passe SKYS ERP',
        text: `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) : ${lien}`
      });
    }
    return res.json({ message: messageGenerique });
  } catch (err) {
    console.error('Réinitialisation :', err);
    return res.status(503).json({ error: 'Service de réinitialisation indisponible.' });
  }
};

const confirmer = async (req, res) => {
  const { email, jeton, motDePasse } = req.body || {};
  if (typeof jeton !== 'string' || !/^[a-f0-9]{64}$/.test(jeton) || typeof motDePasse !== 'string' || motDePasse.length < 8) {
    return res.status(400).json({ error: 'Lien invalide ou mot de passe trop court (8 caractères minimum).' });
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
    await utilisateur.save();
    return res.json({ message: 'Mot de passe modifié. Vous pouvez vous connecter.' });
  } catch (err) {
    console.error('Confirmation de réinitialisation :', err);
    return res.status(500).json({ error: 'Impossible de modifier le mot de passe.' });
  }
};

module.exports = { demander, confirmer };
