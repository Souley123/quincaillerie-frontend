const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Client = require('../models/Client');
const Entreprise = require('../models/Entreprise');
const { hacherMotDePasse, verifierMotDePasse, verifierFactice, signer } = require('../services/authService');

const hashJeton = jeton => crypto.createHash('sha256').update(jeton).digest('hex');
const tentativesReinitialisation = new Map();
const messageReinitialisation = 'Si un compte client actif correspond à ces informations, un lien de réinitialisation sera envoyé.';

const construireLienReinitialisation = (slug, email, jeton) => {
  const { APP_URL } = process.env;
  if (!APP_URL) throw new Error('APP_URL absent.');
  const base = new URL(APP_URL);
  if (base.protocol !== 'https:' || base.username || base.password) {
    throw new Error('APP_URL doit être une URL HTTPS valide sans identifiants.');
  }
  const basePath = base.pathname.replace(/\/$/, '');
  const lien = new URL(`${basePath}/client/mot-de-passe/reinitialiser`, base.origin);
  lien.searchParams.set('slug', slug);
  lien.searchParams.set('email', email);
  lien.searchParams.set('jeton', jeton);
  return lien;
};

const envoyerLienReinitialisation = async (client, slug, jeton) => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !process.env.APP_URL) {
    throw new Error('Configuration SMTP ou APP_URL absente.');
  }
  const lien = construireLienReinitialisation(slug, client.email, jeton);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || SMTP_USER,
    to: client.email,
    subject: 'Réinitialisation de votre mot de passe client',
    text: `Bonjour ${client.nom},\n\nPour définir un nouveau mot de passe, ouvrez ce lien valable 30 minutes : ${lien}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.`
  });
};

const validerCoordonnees = ({ email, telephone }) => {
  const emailValide = typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const telephoneValide = typeof telephone === 'string' && telephone.replace(/\D/g, '').length >= 8;
  return emailValide || telephoneValide;
};

const creerJetonClient = client => signer({
  type: 'client',
  companyId: client.companyId,
  id: String(client._id),
  email: client.email || '',
  role: 'Client'
});

const inscrire = async (req, res) => {
  try {
    const { slug, nom, email = '', telephone = '', motDePasse } = req.body || {};
    const slugNormalise = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
    const emailNormalise = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const telephoneNormalise = typeof telephone === 'string' ? telephone.trim() : '';
    const emailInvalide = email !== '' && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalise));
    const telephoneInvalide = telephone !== '' && (typeof telephone !== 'string' || telephoneNormalise.replace(/\D/g, '').length < 8);

    if (!/^[a-z0-9](?:[a-z0-9-]{1,30})?$/.test(slugNormalise)) {
      return res.status(400).json({ error: 'Le sous-domaine de l’entreprise est invalide.' });
    }
    if (typeof nom !== 'string' || !nom.trim() || nom.trim().length > 120 || emailInvalide || telephoneInvalide ||
        !validerCoordonnees({ email: emailNormalise, telephone: telephoneNormalise })) {
      return res.status(400).json({ error: 'Indiquez votre nom et une adresse email ou un téléphone valide.' });
    }
    if (typeof motDePasse !== 'string' || motDePasse.length < 12 || motDePasse.length > 256) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir entre 12 et 256 caractères.' });
    }

    const entreprise = await Entreprise.findOne({ slug: slugNormalise, actif: true }).select('companyId slug raisonSociale');
    if (!entreprise) return res.status(404).json({ error: 'Entreprise introuvable.' });

    const identifiantsExistants = [];
    if (emailNormalise) identifiantsExistants.push({ email: emailNormalise });
    if (telephoneNormalise) identifiantsExistants.push({ telephone: telephoneNormalise });
    if (identifiantsExistants.length) {
      const clientExistant = await Client.findOne({
        companyId: entreprise.companyId,
        $or: identifiantsExistants
      }).select('_id');
      if (clientExistant) {
        return res.status(409).json({ error: 'Un compte client utilise déjà cet email ou ce téléphone.' });
      }
    }

    const client = await Client.create({
      companyId: entreprise.companyId,
      nom: nom.trim(),
      email: emailNormalise,
      telephone: telephoneNormalise,
      motDePassePortailHash: hacherMotDePasse(motDePasse),
      comptePortailActif: true
    });
    return res.status(201).json({
      jeton: creerJetonClient(client),
      client: { id: client._id, nom: client.nom, email: client.email, telephone: client.telephone },
      entreprise: { slug: entreprise.slug, raisonSociale: entreprise.raisonSociale }
    });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    if (err.code === 11000) return res.status(409).json({ error: 'Un compte client utilise déjà cet email ou ce téléphone.' });
    return res.status(500).json({ error: 'Inscription client impossible.' });
  }
};

const connexion = async (req, res) => {
  const { slug, identifiant, motDePasse } = req.body || {};
  const slugNormalise = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
  const saisie = typeof identifiant === 'string' ? identifiant.trim() : '';
  if (!slugNormalise || !saisie || typeof motDePasse !== 'string' || motDePasse.length > 256) {
    return res.status(400).json({ error: 'Entreprise, email/téléphone et mot de passe sont obligatoires.' });
  }

  try {
    const entreprise = await Entreprise.findOne({ slug: slugNormalise, actif: true }).select('companyId slug raisonSociale');
    if (!entreprise) return res.status(401).json({ error: 'Identifiants client incorrects.' });
    const filtreIdentifiant = saisie.includes('@')
      ? { email: saisie.toLowerCase() }
      : { telephone: saisie };
    const client = await Client.findOne({
      companyId: entreprise.companyId,
      actif: true,
      comptePortailActif: true,
      ...filtreIdentifiant
    }).select('+motDePassePortailHash');

    const hash = client?.motDePassePortailHash || verifierFactice();
    const motDePasseValide = verifierMotDePasse(motDePasse, hash);
    if (!client || !client.motDePassePortailHash || !motDePasseValide) {
      return res.status(401).json({ error: 'Identifiants client incorrects.' });
    }

    return res.json({
      jeton: creerJetonClient(client),
      client: { id: client._id, nom: client.nom, email: client.email, telephone: client.telephone },
      entreprise: { slug: entreprise.slug, raisonSociale: entreprise.raisonSociale }
    });
  } catch {
    return res.status(500).json({ error: 'Connexion client impossible.' });
  }
};

const demanderReinitialisation = async (req, res) => {
  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim().toLowerCase() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[a-z0-9](?:[a-z0-9-]{1,30})?$/.test(slug) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Entreprise et adresse email valides obligatoires.' });
  }

  const ip = String(req.ip || req.socket?.remoteAddress || 'inconnu').slice(0, 80);
  const cle = hashJeton(`${ip}|${slug}|${email}`);
  const maintenant = Date.now();
  let limite = tentativesReinitialisation.get(cle);
  if (!limite || maintenant - limite.debut >= 60 * 60 * 1000) {
    limite = { debut: maintenant, count: 0 };
    tentativesReinitialisation.set(cle, limite);
  }
  if (limite.count >= 3) return res.json({ message: messageReinitialisation });
  limite.count += 1;
  if (tentativesReinitialisation.size > 10000) {
    for (const [key, value] of tentativesReinitialisation) {
      if (maintenant - value.debut >= 60 * 60 * 1000) tentativesReinitialisation.delete(key);
    }
  }

  try {
    const entreprise = await Entreprise.findOne({ slug, actif: true }).select('companyId slug');
    const client = entreprise ? await Client.findOne({
      companyId: entreprise.companyId,
      email,
      actif: true,
      comptePortailActif: true
    }).select('+reinitialisationPortailHash +reinitialisationPortailExpire email nom') : null;

    if (client) {
      const jeton = crypto.randomBytes(32).toString('hex');
      const ancienHash = client.reinitialisationPortailHash;
      const ancienneExpiration = client.reinitialisationPortailExpire;
      client.reinitialisationPortailHash = hashJeton(jeton);
      client.reinitialisationPortailExpire = new Date(Date.now() + 30 * 60 * 1000);
      await client.save();
      try {
        await envoyerLienReinitialisation(client, entreprise.slug, jeton);
      } catch (erreurEnvoi) {
        client.reinitialisationPortailHash = ancienHash;
        client.reinitialisationPortailExpire = ancienneExpiration;
        await client.save();
        throw erreurEnvoi;
      }
    }
    return res.json({ message: messageReinitialisation });
  } catch (err) {
    console.error('Réinitialisation du portail client impossible :', err.message);
    return res.status(503).json({ error: 'Envoi du courriel impossible. Vérifiez la configuration SMTP et APP_URL.' });
  }
};

const confirmerReinitialisation = async (req, res) => {
  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim().toLowerCase() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { jeton, motDePasse } = req.body || {};
  if (!/^[a-z0-9](?:[a-z0-9-]{1,30})?$/.test(slug) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof jeton !== 'string' || !/^[a-f0-9]{64}$/.test(jeton) ||
      typeof motDePasse !== 'string' || motDePasse.length < 12 || motDePasse.length > 256) {
    return res.status(400).json({ error: 'Lien invalide ou mot de passe trop court (12 caractères minimum).' });
  }

  try {
    const entreprise = await Entreprise.findOne({ slug, actif: true }).select('companyId');
    if (!entreprise) return res.status(400).json({ error: 'Lien invalide ou expiré.' });
    const client = await Client.findOne({
      companyId: entreprise.companyId,
      email,
      actif: true,
      comptePortailActif: true,
      reinitialisationPortailHash: hashJeton(jeton),
      reinitialisationPortailExpire: { $gt: new Date() }
    }).select('+reinitialisationPortailHash +reinitialisationPortailExpire');
    if (!client) return res.status(400).json({ error: 'Lien invalide ou expiré.' });

    client.motDePassePortailHash = hacherMotDePasse(motDePasse);
    client.reinitialisationPortailHash = null;
    client.reinitialisationPortailExpire = null;
    await client.save();
    return res.json({ message: 'Mot de passe client modifié. Vous pouvez vous connecter.' });
  } catch {
    return res.status(500).json({ error: 'Réinitialisation du mot de passe client impossible.' });
  }
};

module.exports = { inscrire, connexion, demanderReinitialisation, confirmerReinitialisation };
