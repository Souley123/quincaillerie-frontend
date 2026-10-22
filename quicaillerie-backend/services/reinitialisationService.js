const crypto = require('crypto');
const { envoyerEmail } = require('./envoiEmail');
const Utilisateur = require('../models/Utilisateur');
const Entreprise = require('../models/Entreprise');
const { notifierAdmin } = require('./notifierAdmin');

const hashJeton = jeton => crypto.createHash('sha256').update(jeton).digest('hex');
const normaliserEmail = email => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const limiterReinitialisation = new Map();
const messageGenerique = 'Si ce compte existe, un lien de réinitialisation lui sera envoyé.';

/* Au-delà de ce nombre de réinitialisations, le compte est bloqué et seul un
   administrateur peut le débloquer. */
const SEUIL_REINITIALISATIONS = 3;
const limiterReinitialisationParCompte = new Map();
const FENETRE_REINITIALISATION_MS = 24 * 60 * 60 * 1000;
const MAX_DEMANDES_PAR_COMPTE = 5;

const construireLienReinitialisation = (email, jeton, slug = '', appUrl = process.env.APP_URL) => {
  const urlBase = appUrl || 'https://souley123.github.io/quincaillerie-frontend';
  const base = new URL(urlBase);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('APP_URL doit être une URL HTTPS valide sans paramètres ni identifiants.');
  }
  const basePath = base.pathname.replace(/\/$/, '');
  const lien = new URL(`${basePath}/mot-de-passe/reinitialiser`, base.origin);
  if (slug) lien.searchParams.set('slug', slug);
  lien.searchParams.set('jeton', jeton);
  lien.searchParams.set('email', email);
  return lien;
};

const demander = async (req, res) => {
  const email = normaliserEmail(req.body?.email);
  /* L'e-mail est unique par entreprise. Le slug permet de sélectionner le
     compte attendu ; on le normalise au même format que le modèle Entreprise. */
  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }
  if (slug && !/^[a-z0-9](?:[a-z0-9-]{1,30})?$/.test(slug)) {
    return res.status(400).json({ error: 'Entreprise invalide.' });
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
    /* Resolution de l'entreprise a partir du slug quand il est fourni, afin
       d'envoyer le lien au compte de la BONNE entreprise. */
    let companyId = null;
    if (slug) {
      const entreprise = await Entreprise.findOne({ slug, actif: true }).select('companyId');
      if (!entreprise) {
        // Slug inconnu : on ne revele rien et on ne cherche pas d'utilisateur.
        return res.json({ message: messageGenerique });
      }
      companyId = entreprise.companyId;
    }

    const utilisateurs = await Utilisateur.find(
      companyId
        ? { email, actif: { $ne: false }, companyId }
        : { email, actif: { $ne: false } }
    ).select('+reinitialisationHash +reinitialisationExpire');
    const appUrl = process.env.APP_URL || 'https://souley123.github.io/quincaillerie-frontend';
    if (utilisateurs.length) {
      const cleCompte = hashJeton(`${email}|${companyId || 'toutes-entreprises'}`);
      const maintenantLimite = Date.now();
      let limiteCompte = limiterReinitialisationParCompte.get(cleCompte);
      if (!limiteCompte || maintenantLimite - limiteCompte.debut >= FENETRE_REINITIALISATION_MS) {
        limiteCompte = { debut: maintenantLimite, count: 0 };
      }
      if (limiteCompte.count >= MAX_DEMANDES_PAR_COMPTE) {
        limiterReinitialisationParCompte.set(cleCompte, limiteCompte);
        return res.json({ message: messageGenerique });
      }

      // Sans identifiant d'entreprise, le même email peut correspondre à
      // plusieurs tenants : créer un lien distinct pour chaque compte.
      const comptesActifs = utilisateurs.filter(utilisateur => !utilisateur.bloqueReinitialisation);
      if (!comptesActifs.length) return res.json({ message: messageGenerique });

      /* SMTP_FROM DOIT figurer dans cette déstructuration : il était utilisé
         à la ligne suivante sans être déclaré, d'où « SMTP_FROM is not
         defined ». Le défaut ne se voyait que si SMTP_FROM est défini ET
         SMTP_USER vide (configuration Brevo seule) : la route répondait
         alors 503 « service indisponible » à chaque demande. */
      const {
        SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM,
        BREVO_API_KEY, RENDER, RENDER_SERVICE_TYPE, RENDER_INSTANCE_TYPE
      } = process.env;
      const canalEmail = BREVO_API_KEY || (SMTP_HOST && SMTP_USER && SMTP_PASSWORD);
      const smtpBloqueSurRenderGratuit = Boolean(
        RENDER &&
        RENDER_SERVICE_TYPE === 'web' &&
        RENDER_INSTANCE_TYPE === 'free'
      );
      const modeCanal = BREVO_API_KEY ? 'api' : smtpBloqueSurRenderGratuit ? 'smtp-bloque' : 'smtp';
      if (!BREVO_API_KEY && smtpBloqueSurRenderGratuit) {
        console.error('SMTP sortant indisponible sur ce service Render gratuit. Configurez BREVO_API_KEY avec une clé API HTTP.');
        return res.status(503).json({ error: 'Service e-mail indisponible. Configurez le fournisseur e-mail HTTPS.' });
      }
      if (!canalEmail) {
        console.error('Réinitialisation indisponible : canal e-mail (Brevo ou SMTP) non configuré.');
        return res.status(503).json({ error: 'Service de réinitialisation indisponible.' });
      }
      if (BREVO_API_KEY && !SMTP_FROM && !SMTP_USER) {
        console.error('Réinitialisation indisponible : SMTP_FROM ou SMTP_USER doit définir l’expéditeur autorisé chez Brevo.');
        return res.status(503).json({ error: 'Service de réinitialisation indisponible.' });
      }

      for (const utilisateur of comptesActifs) {
        const entrepriseUtilisateur = slug ? null : await Entreprise.findOne({ companyId: utilisateur.companyId, actif: true }).select('slug');
        const slugLien = slug || entrepriseUtilisateur?.slug || '';
        const jeton = crypto.randomBytes(32).toString('hex');
        const lien = construireLienReinitialisation(email, jeton, slugLien, appUrl);
        // Ne jamais exposer le jeton à des tiers via Referer ou le cache partagé.
        res.set('Cache-Control', 'no-store');
        res.set('Referrer-Policy', 'no-referrer');
        const ancienHash = utilisateur.reinitialisationHash;
        const ancienneExpiration = utilisateur.reinitialisationExpire;
        utilisateur.reinitialisationHash = hashJeton(jeton);
        utilisateur.reinitialisationExpire = new Date(Date.now() + 30 * 60 * 1000);
        await utilisateur.save();
        try {
          const resultat = await envoyerEmail({
            from: process.env.SMTP_FROM || SMTP_USER,
            to: email,
            subject: 'Réinitialisation de votre mot de passe SKYS ERP',
            text: `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) : ${lien}`
          });
          if (!resultat || resultat.envoye !== true || !['api', 'smtp'].includes(resultat.mode)) {
            const erreur = new Error(resultat?.erreur || 'Le fournisseur e-mail n’a pas confirmé la prise en charge du message.');
            erreur.mode = resultat?.mode || modeCanal;
            erreur.code = resultat?.code || null;
            throw erreur;
          }
          if (resultat.mode === 'api' && !resultat.statutHttp) {
            throw new Error('Réponse de la passerelle e-mail invalide.');
          }
          console.info('Fournisseur e-mail : demande de réinitialisation acceptée.', {
            mode: resultat.mode || 'inconnu',
            statutHttp: resultat.statutHttp || null,
            id: resultat.id || null,
            modeCanalConfigure: modeCanal,
            destinataire: email,
            serveurAccepteur: resultat.mode === 'smtp' ? resultat.response || null : 'API Brevo',
            destinatairesAcceptes: resultat.mode === 'smtp' ? resultat.accepted || [] : resultat.recipients || [],
            destinatairesRejetes: resultat.mode === 'smtp' ? resultat.rejected || [] : [],
            livreeBoite: 'non vérifiable par le serveur'
          });
        } catch (erreurEnvoi) {
          console.error('Échec du fournisseur e-mail pour la réinitialisation.', {
            mode: erreurEnvoi.mode || (BREVO_API_KEY ? 'api' : 'smtp'),
            code: erreurEnvoi.code || null,
            destinataire: email,
            message: String(erreurEnvoi.message || 'Erreur inconnue').slice(0, 240)
          });
          utilisateur.reinitialisationHash = ancienHash;
          utilisateur.reinitialisationExpire = ancienneExpiration;
          await utilisateur.save();
          throw erreurEnvoi;
        }
      }
      limiteCompte.count += 1;
      limiterReinitialisationParCompte.set(cleCompte, limiteCompte);
      if (limiterReinitialisationParCompte.size > 10000) {
        for (const [key, entry] of limiterReinitialisationParCompte) {
          if (maintenantLimite - entry.debut >= FENETRE_REINITIALISATION_MS) limiterReinitialisationParCompte.delete(key);
        }
      }
    } else {
      // L'URL doit être valide même si l'adresse n'existe pas, pour garder des
      // erreurs de configuration cohérentes sans divulguer l'existence du compte.
      construireLienReinitialisation(email, '0'.repeat(64), '', appUrl);
    }
    return res.json({ message: messageGenerique });
  } catch (err) {
    /* Le journal garde la cause technique ; l'utilisateur reçoit une consigne
       exploitable au lieu d'un « indisponible » qui laisse tout le monde
       bloqué sans piste (expéditeur refusé, IP Brevo, SMTP bloqué…). */
    console.error('Réinitialisation indisponible :', err.message);
    return res.status(503).json({
      error: 'Envoi de l’e-mail de réinitialisation impossible pour le moment. '
        + 'Réessayez dans quelques minutes ; si le problème persiste, contactez l’administrateur '
        + '(service e-mail à configurer côté serveur).',
      code: err.code || 'REINITIALISATION_INDISPONIBLE'
    });
  }
};

const confirmer = async (req, res) => {
  const { email, jeton, motDePasse } = req.body || {};
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof jeton !== 'string' || !/^[a-f0-9]{64}$/.test(jeton) ||
      typeof motDePasse !== 'string' || motDePasse.length < 12 || motDePasse.length > 256) {
    return res.status(400).json({ error: 'Lien invalide ou mot de passe trop court (12 caractères minimum).' });
  }
  try {
    const criteres = {
      email: normaliserEmail(email),
      actif: { $ne: false },
      reinitialisationHash: hashJeton(jeton),
      reinitialisationExpire: { $gt: new Date() }
    };
    const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim().toLowerCase() : '';
    if (slug) {
      if (!/^[a-z0-9](?:[a-z0-9-]{1,30})?$/.test(slug)) {
        return res.status(400).json({ error: 'Lien invalide ou expiré.' });
      }
      const entreprise = await Entreprise.findOne({ slug, actif: true }).select('companyId');
      if (!entreprise) return res.status(400).json({ error: 'Lien invalide ou expiré.' });
      criteres.companyId = entreprise.companyId;
    }
    const utilisateur = await Utilisateur.findOne(criteres).select('+reinitialisationHash +reinitialisationExpire');
    if (!utilisateur) return res.status(400).json({ error: 'Lien invalide ou expiré.' });

    const { hacherMotDePasse } = require('./authService');
    utilisateur.motDePasseHash = hacherMotDePasse(motDePasse);
    utilisateur.reinitialisationHash = null;
    utilisateur.reinitialisationExpire = null;
    utilisateur.forcePasswordChange = false;
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

module.exports = { demander, confirmer, construireLienReinitialisation };
