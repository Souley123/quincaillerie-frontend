const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();

/* Documentation OpenAPI / Swagger : désactivée défaut en production,
   activation explicite via SWAGGER_ACTIF=true uniquement si nécessaire. */
const swaggerUi = require('swagger-ui-express');
const { specificationSwagger, optionsUi } = require('./swagger');
const swaggerActif = process.env.NODE_ENV === 'production'
  ? process.env.SWAGGER_ACTIF === 'true'
  : process.env.SWAGGER_ACTIF !== 'false';

const PORT = process.env.PORT || 5001;
const { ObjectIdValide } = require('./middleware/tenant');

const production = process.env.NODE_ENV === 'production';
const originesAutorisees = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origine => origine.trim())
  .filter(Boolean);

/* Origines de DÉVELOPPEMENT local (ordinateur, émulateur Android, simulateur
   iOS). Jamais acceptées en production : une page servie depuis
   http://localhost:4173 pourrait sinon piloter l'API d'un vrai client. */
const ORIGINES_DEV = [
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173'
];

// Origines des applications natives Capacitor (Android et iOS).
// Capacitor sert le WebView depuis ces origines ; elles ne sont pas
// configurales dans CORS_ORIGINS car elles sont fixes et internes.
const ORIGINES_NATIVES = [
  'https://localhost',   // Android (androidScheme: https) et iOS
  'capacitor://localhost', // iOS (iosScheme: capacitor)
  'http://localhost'     // Android en mode non sécurisé (développement)
];

if (production && originesAutorisees.length === 0) {
  throw new Error('CORS_ORIGINS doit contenir au moins une origine frontend en production.');
}
if (production && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET est obligatoire en production.');
}
const APP_URL_DEFAUT = 'https://souley123.github.io/quincaillerie-frontend';
try {
  const appUrlConfiguree = new URL(process.env.APP_URL || APP_URL_DEFAUT);
  if (production && (
    appUrlConfiguree.protocol !== 'https:' || appUrlConfiguree.username ||
    appUrlConfiguree.password || appUrlConfiguree.search || appUrlConfiguree.hash
  )) {
    throw new Error();
  }
} catch {
  if (production) {
    throw new Error('APP_URL doit être une URL HTTPS absolue, sans paramètres ni identifiants.');
  }
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET doit contenir au moins 32 caractères.');
}

// Middlewares
app.disable('x-powered-by');
/* Le domaine est expose via Cloudflare devant le proxy Render : la chaine
   X-Forwarded-For contient donc 2 hops, pas 1. Avec « trust proxy = 1 »,
   Express remonte jusqu'a l'IP du proxy Render, PARTAGEE par tous les
   visiteurs, ce qui fait du rate limit un quota global et non par client.
   La valeur 2 aligne req.ip sur l'IP reelle du client ; comportement verifie
   par scripts/verifier-trust-proxy.mjs. */
app.set('trust proxy', 2);
// Compression HTTP réelle pour réduire le volume transféré sur réseaux lents.
app.use(compression({ threshold: 1024 }));
/* Socle d'en-têtes standards (helmet) : X-Content-Type-Options,
   X-Frame-Options, Referrer-Policy, HSTS, X-DNS-Prefetch-Control,
   X-Download-Options, X-Permitted-Cross-Domain-Policies.
   La CSP est désactivée ICI car le pare-feu n°1 la pose de façon plus
   précise (elle autorise le widget Kkiapay). Répartition des rôles :
   helmet = standards ; pare-feu n°1 = CSP, Permissions-Policy, COOP/CORP. */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Par défaut helmet pose « no-referrer » ; on applique la valeur stricte
  // sans casser les appels d'API légitimes.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: false,
  /* IMPORTANT : sans cette option, helmet pose « SAMEORIGIN », ce qui
     laisse un site du même domaine encadrer l'API (clickjacking).
     On impose DENY : aucun cadrage, quel que soit le domaine. */
  frameguard: { action: 'deny' },
  // HSTS géré par helmet ; le pare-feu n°1 ne le duplique pas.
  hsts: production
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false
}));
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb', strict: true }));

/* CORS strict enregistré avant les routeurs et les limiteurs. */
app.use(cors({
  origin: (origine, callback) => {
    const autorisee = !origine
      || ORIGINES_NATIVES.includes(origine)
      || originesAutorisees.includes(origine)
      || (!production && ORIGINES_DEV.includes(origine));
    if (autorisee) {
      return callback(null, true);
    }
    return callback(new Error('Origine non autorisée par CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'X-Request-Id'],
  maxAge: 600
}));

/* Protections HTTP : corrélation, en-têtes, contrôles des entrées, origine,
   anti-rejeu et débit. */
const pareFeu = require('./middleware/pareFeu');
app.use(pareFeu.pareFeuCorrelation);
app.use(pareFeu.enTetesSecurite);

/* Défense en profondeur : ces pare-feux étaient définis mais jamais branchés,
   ce qui laissait passer les injections et les outils offensifs. Ordre :
   signature du client → taille/profondeur de charge → assainissement des
   entrées → origine des mutations → débit. */
app.use(pareFeu.pareFeuBots);
app.use(pareFeu.pareFeuCharge);
app.use(pareFeu.pareFeuEntrees);
app.use(pareFeu.pareFeuOrigine);
app.use(pareFeu.pareFeuDebit);

/* Documentation Swagger : montée APRÈS les pare-feux de sécurité (elle en
   bénéficie) mais AVANT le limiteur global « /api/ » et l'authentification,
   afin que /api-docs reste accessible aux développeurs. */
if (swaggerActif) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specificationSwagger, optionsUi));
}

// CORS preflight is terminated by the cors middleware above; do not pass OPTIONS
// through mutation checks or token buckets.
app.use((req, res, next) => req.method === 'OPTIONS' ? res.sendStatus(204) : next());

// Rate limiter supplémentaire par compte/email pour freiner le password spraying.
const limiterCompte = new Map();
app.use('/api/auth/login', (req, res, next) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
  if (!email) return next();
  const cle = require('crypto').createHash('sha256').update(email).digest('hex');
  const maintenant = Date.now();
  let entree = limiterCompte.get(cle);
  if (!entree || maintenant - entree.debut >= 15 * 60 * 1000) {
    entree = { debut: maintenant, count: 0 };
    limiterCompte.set(cle, entree);
  }
  if (entree.count >= 8) {
    res.setHeader('Retry-After', String(Math.ceil((15 * 60 * 1000 - (maintenant - entree.debut)) / 1000)));
    return res.status(429).json({ error: 'Trop de tentatives pour ce compte. Réessayez plus tard.' });
  }
  entree.count += 1;
  if (limiterCompte.size > 10000) {
    for (const [id, valeur] of limiterCompte) if (maintenant - valeur.debut >= 15 * 60 * 1000) limiterCompte.delete(id);
  }
  next();
});

const { ipKeyGenerator } = rateLimit;
const keyGeneratorIp = req => {
  const ip = req.ip || req.socket?.remoteAddress;
  if (!ip) {
    console.error('Warning: request.ip is missing!');
    return 'ip:unknown';
  }
  const ipSansPort = ip.includes('.') ? ip.replace(/:\d+$/, '') : ip;
  return ipKeyGenerator(ipSansPort);
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
    limit: 100,
    keyGenerator: keyGeneratorIp,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    /* Toutes les validations internes désactivées : leur nom change selon
       la version d'express-rate-limit (v6/v7/v8). « trust proxy » est réglé
       sur 2 (Cloudflare + Render), donc req.ip = IP réelle du client.
       validate:false évite l'erreur ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. */
    validate: false,
    message: { error: 'Trop de requêtes. Réessayez...' }
});
app.use('/api/', limiter);
// La documentation Swagger ne doit pas consommer le quota du limiteur API.
app.use('/api-docs', (req, res, next) => next());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: keyGeneratorIp,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/client-portal/connexion', authLimiter);
app.use('/api/client-portal/inscription', authLimiter);
app.use('/api/client-portal/mot-de-passe', authLimiter);
app.use('/api/auth/inscription', authLimiter);
app.use('/api/auth/mot-de-passe', authLimiter);

const securityAlertLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  keyGenerator: keyGeneratorIp,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: false,
  message: { error: 'Trop d’alertes envoyées. Réessayez plus tard.' }
});
app.use('/api/security/alert', securityAlertLimiter);

// Un identifiant de route malformé (ex. « abc ») ferait échouer le
// transtypage Mongo et renverrait un 500. app.param s'exécute une fois
// le paramètre résolu, contrairement à un middleware app.use classique.
app.param('id', (req, res, next, id) => {
  if (!ObjectIdValide(id)) {
    return res.status(404).json({ error: 'Ressource introuvable.' });
  }
  next();
});

// Connexion MongoDB Atlas
const uri = process.env.MONGODB_URI;

/* Résultat de la connexion initiale. Le serveur HTTP n'écoute qu'une fois
   cette promesse résolue : sinon Express répondrait « démarré » alors que
   toutes les routes dépendant de la base échoueraient, et le frontend
   afficherait un échec de connexion trompeur (cf. apiUrl.js qui route
   localhost → http://localhost:5001).

   Le pool Mongo ne vaut que si le DNS SRV/TXT est joignable : sur un réseau
   dont le résolveur les filtre, l'erreur `queryTxt ETIMEOUT` doit être
   explicitement signalée au démarrage. */
const connexionMongo = uri
  ? mongoose.connect(uri)
      .then(async () => {
        console.log("Connecté à MongoDB Atlas pour SKYS ERP Solution !");
        // Provisionne le compte de démonstration/test si DEMO_COMPTE=actif.
        // Jamais bloquant : une erreur ici ne doit pas empêcher l'API de servir.
        try {
          const compteDemo = require('./services/compteDemoService');
          await compteDemo.provisionnerCompteDemo();
        } catch (err) {
          console.error('[DÉMO] Provisionnement impossible :', err.message);
        }
        return true;
      })
      .catch(err => {
        console.error('Erreur MongoDB :', err.message);
        if (/bad auth|authentication failed/i.test(err.message)) {
          console.error(
            "Authentification refusee par Atlas :\n" +
            "  - verifier le mot de passe de l'utilisateur 'devuser' (Database Access)\n" +
            "  - verifier que l'utilisateur a le role readWrite sur la base cible\n" +
            "  - dans l'URI, encoder le mot de passe (< et @ deviennent %3C et %40)"
          );
        }
        if (/queryTxt|querySrv|ETIMEOUT|ENOTFOUND/i.test(err.message)) {
          console.error(
            "Resolution DNS de l'URI mongodb+srv impossible :\n" +
            "  - le resolver reseau ne relaie pas les requetes SRV/TXT\n" +
            "  - essayer un DNS public (8.8.8.8 / 1.1.1.1) puis ipconfig /flushdns\n" +
            "  - ou remplacer l'URI par la version standard (mongodb:// avec les 3 hotes)"
          );
        }
        return false;
      })
  : Promise.resolve(
      console.error(
        'MONGODB_URI absent du fichier .env : copiez .env.example vers .env puis completez la valeur.'
      ) && false
    );

// Le modèle Product est défini dans models/Product.js : on ne le
// redéfinit PAS ici, sinon mongoose lèverait une erreur de surcharge
// et le catalogue multi-tenant serait ignoré.
const Product = require('./models/Product');

const securityAlertSchema = new mongoose.Schema({
  userEmail: { type: String, trim: true },
  detail: { type: String, required: true, trim: true },
  level: { type: String, default: 'Moyen' },
  imageData: { type: String, default: null },
  channels: { type: Object, default: {} }
}, { timestamps: true });

const SecurityAlert = mongoose.model('SecurityAlert', securityAlertSchema);

/* Envoi d'e-mail : delegue au module unifie.
   Sur Render, tout le SMTP sortant est bloque (ETIMEDOUT sur 465/587/2525) ;
   envoiEmail.js bascule alors automatiquement sur l'API HTTPS Brevo (port 443).
   En local, le SMTP classique reste utilise. */
const createMailTransporter = () => creerTransport();


// Endpoint de diagnostic IP retiré : les adresses réseau ne sont pas nécessaires
// au fonctionnement de l'API et leur divulgation publique facilite la reconnaissance.

// Health check dédié : réponse minimale et rapide, sans exposer de secret.
app.get('/health', (req, res) => {
  const pret = mongoose.connection.readyState === 1;
  res.status(pret ? 200 : 503).json({
    statut: pret ? 'ok' : 'degraded',
    base: pret ? 'connectee' : 'deconnectee',
    horodatage: new Date().toISOString()
  });
});

/* Diagnostic privé des canaux e-mail et de l'URL publique. Ne renvoie jamais
   de clé ni de mot de passe. Protégé par en-tête dédié (pas dans l'URL, donc
   absent des journaux d'accès et des en-têtes Referer). */
app.get('/diagnostic-email', async (req, res) => {
  const attendu = process.env.DIAG_TOKEN;
  const fourni = req.get('x-diagnostic-token');
  if (!attendu || typeof fourni !== 'string' || fourni.length !== attendu.length ||
      !require('crypto').timingSafeEqual(Buffer.from(fourni), Buffer.from(attendu))) {
    return res.status(404).json({ error: 'Not Found' });
  }
  const nodemailer = require('nodemailer');
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, APP_URL, BREVO_API_KEY, SMTP_FROM } = process.env;
  const rapport = {
    configuration: {
      appUrlConfiguree: Boolean(APP_URL),
      appUrlValide: false,
      canalActif: BREVO_API_KEY
        ? 'brevo-api'
        : SMTP_HOST && SMTP_USER && SMTP_PASSWORD
          ? (process.env.RENDER && process.env.RENDER_SERVICE_TYPE === 'web' && process.env.RENDER_INSTANCE_TYPE === 'free'
            ? 'smtp-bloque-sur-render-gratuit'
            : 'smtp')
          : null,
      brevoConfigure: Boolean(BREVO_API_KEY),
      smtpConfigure: Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD),
      expediteurConfigure: Boolean(SMTP_FROM || SMTP_USER)
    },
    testCanal: null
  };
  try {
    const url = new URL(APP_URL || 'https://souley123.github.io/quincaillerie-frontend');
    rapport.configuration.appUrlValide = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch (_) {
    rapport.configuration.appUrlValide = false;
  }

  if (BREVO_API_KEY) {
    const debut = Date.now();
    try {
      const reponse = await fetch('https://api.brevo.com/v3/account', {
        headers: { accept: 'application/json', 'api-key': BREVO_API_KEY },
        signal: AbortSignal.timeout(10000)
      });
      const corps = await reponse.text().catch(() => '');
      let codeFournisseur = null;
      try {
        codeFournisseur = JSON.parse(corps)?.code || null;
      } catch (_) {
        // Ne jamais inclure la réponse brute du fournisseur dans le diagnostic.
      }
      rapport.testCanal = {
        ok: reponse.ok,
        authentificationOk: reponse.ok,
        mode: 'brevo-api',
        statutHttp: reponse.status,
        code: typeof codeFournisseur === 'string' ? codeFournisseur.slice(0, 80) : null,
        diagnostic: reponse.ok
          ? 'Clé API authentifiée. Aucun e-mail de test n’a été envoyé par ce diagnostic; lancer un test réel depuis la route de réinitialisation et consulter l’activité Brevo.'
          : 'Échec de l’authentification de la clé API.',
        dureeMs: Date.now() - debut
      };
    } catch (err) {
      rapport.testCanal = {
        ok: false,
        mode: 'brevo-api',
        erreur: err.name === 'AbortError' ? 'timeout' : 'API Brevo inaccessible.',
        dureeMs: Date.now() - debut
      };
    }
  } else if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000
    });
    const debut = Date.now();
    try {
      await transport.verify();
      rapport.testCanal = { ok: true, mode: 'smtp', dureeMs: Date.now() - debut };
    } catch (err) {
      rapport.testCanal = {
        ok: false,
        mode: 'smtp',
        code: err.code || null,
        erreur: String(err.message || 'Erreur SMTP inconnue').slice(0, 240),
        dureeMs: Date.now() - debut
      };
    } finally {
      transport.close();
    }
  } else {
    rapport.testCanal = { ok: false, erreur: 'Aucun canal e-mail configuré.' };
  }

  return res.status(rapport.configuration.appUrlValide && rapport.testCanal.ok ? 200 : 503).json(rapport);
});

/* Envoi de test réel, protégé par le même jeton privé. Le destinataire doit être
   fourni explicitement pour éviter l’envoi vers une adresse codée en dur. */
app.post('/diagnostic-email/test', async (req, res) => {
  const attendu = process.env.DIAG_TOKEN;
  const fourni = req.get('x-diagnostic-token');
  if (!attendu || typeof fourni !== 'string' || fourni.length !== attendu.length ||
      !require('crypto').timingSafeEqual(Buffer.from(fourni), Buffer.from(attendu))) {
    return res.status(404).json({ error: 'Not Found' });
  }
  const destinataire = typeof req.body?.to === 'string' ? req.body.to.trim().toLowerCase() : '';
  if (destinataire.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
    return res.status(400).json({ error: 'Adresse destinataire invalide.' });
  }
  try {
    const { envoyerEmail } = require('./services/envoiEmail');
    const resultat = await envoyerEmail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: destinataire,
      subject: 'Test réel du service e-mail SKYS ERP',
      text: 'Ce message vérifie la configuration réelle du fournisseur e-mail de SKYS ERP.'
    });
    if (!resultat?.envoye) {
      console.error('Échec de l’envoi de test e-mail.', {
        mode: resultat?.mode || null,
        code: resultat?.code || null,
        erreur: String(resultat?.erreur || 'Erreur inconnue').slice(0, 240)
      });
      return res.status(502).json({
        envoye: false,
        mode: resultat?.mode || null,
        code: resultat?.code || null,
        erreur: resultat?.erreur || 'Le fournisseur e-mail a refusé le message.'
      });
    }
    console.info('Envoi de test e-mail accepté par le fournisseur.', {
      mode: resultat.mode,
      statutHttp: resultat.statutHttp || null,
      id: resultat.id || null,
      destinataire: destinataire
    });
    return res.json({
      envoye: true,
      mode: resultat.mode,
      statutHttp: resultat.statutHttp || null,
      id: resultat.id || null,
      message: 'Le fournisseur a accepté le message; vérifier aussi le dossier spam et le journal de livraison du fournisseur.'
    });
  } catch (err) {
    console.error('Erreur de route de test e-mail.', String(err.message || err).slice(0, 240));
    return res.status(500).json({ envoye: false, erreur: 'Erreur interne pendant le test e-mail.' });
  }
});

// Route d'accueil + état détaillé de la plateforme.
app.get('/', (req, res) => {
  const kkiapay = require('./services/kkiapayService');
  res.json({
    message: "Bienvenue sur l'API SKYS ERP Solution !",
    statut: 'ok',
    version: process.env.APP_VERSION || 'dev',
    environnement: production ? 'production' : 'developpement',
    securite: {
      pareFeux: 12,
      corsRestreint: production ? originesAutorisees.length > 0 : true,
      verificationPaiement: kkiapay.estConfigure()
    },
    horodatage: new Date().toISOString()
  });
});

// Alerte de sécurité : les secrets restent uniquement côté serveur.
app.post('/api/security/alert', async (req, res) => {
  const { userEmail, detail, level = 'Moyen', imageData = null } = req.body || {};

  if (!detail || typeof detail !== 'string') {
    return res.status(400).json({ error: 'Le détail de l’incident est obligatoire.' });
  }

  if (imageData && (typeof imageData !== 'string' || imageData.length > 5 * 1024 * 1024)) {
    return res.status(413).json({ error: 'La preuve image est trop volumineuse.' });
  }

  const channels = { email: false, whatsapp: false };
  const alert = {
    userEmail: userEmail || 'Utilisateur inconnu',
    detail,
    level,
    imageData,
    channels
  };

  try {
    if (mongoose.connection.readyState === 1) {
      await SecurityAlert.create(alert);
    }

    const transporter = createMailTransporter();
    if (transporter && process.env.ADMIN_EMAIL) {
      const attachments = [];
      const imageMatch = imageData && imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (imageMatch) {
        attachments.push({ filename: 'preuve-securite.jpg', content: imageMatch[2], encoding: 'base64' });
      }

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: process.env.ADMIN_EMAIL,
        subject: `[ERP] Alerte sécurité - ${level}`,
        text: `Incident détecté pour ${userEmail || 'Utilisateur inconnu'} : ${detail}`,
        attachments
      });
      channels.email = true;
    }

    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.ADMIN_WHATSAPP) {
      const response = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: process.env.ADMIN_WHATSAPP,
          type: 'text',
          text: { body: `[ERP] Alerte sécurité (${level})\nUtilisateur : ${userEmail || 'Inconnu'}\n${detail}` }
        })
      });
      channels.whatsapp = response.ok;
    }

    res.status(201).json({ message: 'Alerte de sécurité enregistrée.', channels });
  } catch (err) {
    console.error('Erreur lors de l’envoi de l’alerte de sécurité :', err.message);
    res.status(500).json({ error: 'Impossible de traiter l’alerte de sécurité.' });
  }
});

// ==========================================
// ROUTES API — TOUTES PASSEES PAR LE MULTI-TENANT
// ==========================================
// Aucun endpoint métier n'est accessible sans jeton valide : chaque
// requête est ensuite filtrée par companyId (cf. middleware/tenant.js).
const { authentifier, autoriserRoles, verifierAccesModule } = require('./middleware/tenant');
const acces = require('./config/acces');

/* ==========================================================================
   SÉCURITÉ DES ROUTES : RÔLE + ABONNEMENT
   --------------------------------------------------------------------------
   `verifierAccesModule('quincaillerie')` vérifie, pour chaque route métier :
     1. le RÔLE de l'utilisateur  (RBAC — moindre privilège) ;
     2. le PALIER de son entreprise (Standard / Pro / Enterprise).
   Les deux contrôles viennent de config/acces.js — la MÊME matrice que
   celle utilisée par le menu du frontend. Un module masqué à l'écran est
   donc aussi refusé par le serveur, et inversement.

   Conventions :
     ACCES(module)    lecture ET écriture d'un module
     LECTURE(module)  lecture d'un module (consultation)
     dit aussi : une route sans module précis (utilitaires) garde
     `authentifier` seul.
   ========================================================================== */
const ACCES = module => verifierAccesModule(module);

/* Exports pour les tests automatisés de la matrice d'accès. */
if (process.env.NODE_ENV === 'test') {
  app.locals.acces = acces;
}
const authController = require('./controllers/authController');
const clientPortalController = require('./controllers/clientPortalController');
const produitController = require('./controllers/produitController');
const categorieController = require('./controllers/categorieController');
const clientController = require('./controllers/clientController');
const venteController = require('./controllers/venteController');
const fournisseurController = require('./controllers/fournisseurController');
const commandeController = require('./controllers/commandeController');
const mouvementController = require('./controllers/mouvementController');
const transportController = require('./controllers/transportController');
const depenseController = require('./controllers/depenseController');
const abonnementController = require('./controllers/abonnementController');
const paiementController = require('./controllers/paiementController');
const emailController = require('./controllers/emailController');
const reinitialisationService = require('./services/reinitialisationService');

/* ---------- AUTHENTIFICATION (routes publiques) ---------- */

// POST /api/auth/inscription → onboarding d'un nouvel acheteur
app.post('/api/auth/inscription', pareFeu.pareFeuEnumeration, authController.inscription);

// POST /api/auth/login → renvoie un jeton signé
app.post('/api/auth/login', pareFeu.pareFeuEnumeration, authController.login);
app.post('/api/auth/mot-de-passe/oublie', pareFeu.pareFeuEnumeration, reinitialisationService.demander);
app.post('/api/auth/mot-de-passe/reinitialiser', reinitialisationService.confirmer);

// Vérification de l'adresse email à l'inscription (anti essais multiples).
// Routes publiques : le lien peut être ouvert depuis la boîte mail.
// pareFeuEnumeration ajoute un délai constant + réponse neutre.
app.post('/api/auth/verifier-email', pareFeu.pareFeuEnumeration, authController.verifierEmail);
app.post('/api/auth/renvoyer-verification', pareFeu.pareFeuEnumeration, authController.renvoyerVerification);

// POST /api/client-portal/inscription et /connexion → accès client public par entreprise.
app.post('/api/client-portal/inscription', pareFeu.pareFeuEnumeration, clientPortalController.inscrire);
app.post('/api/client-portal/connexion', pareFeu.pareFeuEnumeration, clientPortalController.connexion);
app.post('/api/client-portal/mot-de-passe/oublie', pareFeu.pareFeuEnumeration, clientPortalController.demanderReinitialisation);
app.post('/api/client-portal/mot-de-passe/reinitialiser', pareFeu.pareFeuEnumeration, clientPortalController.confirmerReinitialisation);

/* ---------- AUTHENTIFICATION (routes privées) ---------- */

// GET /api/auth/moi → identité et entreprise courantes
app.get('/api/auth/moi', authentifier, authController.moi);

// POST /api/auth/mot-de-passe/changer → l'utilisateur connecté remplace son mot de passe
app.post('/api/auth/mot-de-passe/changer', authentifier, authController.changerMotDePasse);

// GET /api/auth/utilisateurs → comptes de mon entreprise (supervision)
app.get('/api/auth/utilisateurs', authentifier, autoriserRoles(acces.ROLES.ADMIN), authController.listerUtilisateurs);

// POST /api/auth/utilisateurs → créer un compte (Administrateur de l'entreprise)
app.post(
  '/api/auth/utilisateurs',
  authentifier,
  autoriserRoles(acces.ROLES.ADMIN),
  authController.creerUtilisateur
);

// DELETE /api/auth/utilisateurs/:id → désactiver un compte
app.delete(
  '/api/auth/utilisateurs/:id',
  authentifier,
  autoriserRoles(acces.ROLES.ADMIN),
  authController.supprimerUtilisateur
);

// POST /api/auth/utilisateurs/:id/debloquer → débloquer un compte bloqué
// après trop de réinitialisations (ou maintenir le blocage selon la décision).
app.post(
  '/api/auth/utilisateurs/:id/debloquer',
  authentifier,
  autoriserRoles(acces.ROLES.ADMIN),
  authController.debloquerUtilisateur
);

/* ---------- E-MAILS ---------- */

// POST /api/email/lien-connexion → envoie à un nouvel utilisateur le lien de
// connexion (accompagné de son rôle et de son code d'activation). Réservé à
// l'administrateur de l'entreprise : c'est lui qui crée les comptes.
app.post(
  '/api/email/lien-connexion',
  authentifier,
  autoriserRoles(acces.ROLES.ADMIN),
  emailController.envoyerLienConnexion
);

/* ---------- CATALOGUE (produits) ---------- */

// GET /api/products/code/:code → recherche scanner (avant /:id)
app.get('/api/products/code/:code', authentifier, ACCES('recherche'), produitController.rechercherParCode);

app.get('/api/products', authentifier, ACCES('quincaillerie'), produitController.lister);
app.get('/api/products/:id', authentifier, ACCES('quincaillerie'), produitController.afficher);
app.post('/api/products', authentifier, ACCES('quincaillerie'), produitController.creer);
app.put('/api/products/:id', authentifier, ACCES('quincaillerie'), produitController.modifier);
app.delete('/api/products/:id', authentifier, ACCES('quincaillerie'), produitController.supprimer);
/* Un mouvement de stock peut être saisi depuis la gestion de stock (entrée
   manuelle) ou les mouvements/livraisons (sortie assignée). */
app.post('/api/products/:id/stock', authentifier, ACCES('mouvements'), produitController.bougerLeStock);
app.post('/api/products/:id/inventaire', authentifier, ACCES('inventaire'), produitController.inventorier);

/* ---------- CATÉGORIES & SOUS-CATÉGORIES ----------
   Référentiel partagé par tous les postes de l'entreprise (auparavant stocké
   dans le localStorage de chaque navigateur). */

app.get('/api/categories', authentifier, ACCES('quincaillerie'), categorieController.lister);
app.post('/api/categories', authentifier, ACCES('quincaillerie'), categorieController.creer);
app.put('/api/categories/:id', authentifier, ACCES('quincaillerie'), categorieController.modifier);
// ?reaffecter=<catégorie> pour déplacer les articles avant suppression.
app.delete('/api/categories/:id', authentifier, ACCES('quincaillerie'), categorieController.supprimer);

app.post('/api/categories/:id/sous-categories', authentifier, ACCES('quincaillerie'), categorieController.ajouterSousCategorie);
app.put('/api/categories/:id/sous-categories/:sousId', authentifier, ACCES('quincaillerie'), categorieController.modifierSousCategorie);
app.delete('/api/categories/:id/sous-categories/:sousId', authentifier, ACCES('quincaillerie'), categorieController.supprimerSousCategorie);

/* ---------- CLIENTS ---------- */

app.get('/api/clients', authentifier, ACCES('clients'), clientController.lister);
app.get('/api/clients/:id', authentifier, ACCES('clients'), clientController.afficher);
app.post('/api/clients', authentifier, ACCES('clients'), clientController.creer);
app.put('/api/clients/:id', authentifier, ACCES('clients'), clientController.modifier);
/* La suppression d'une fiche client est une opération de supervision :
   jamais confiée au vendeur, même s'il peut créer et consulter. */
app.delete('/api/clients/:id', authentifier, autoriserRoles(acces.ROLES.ADMIN, acces.ROLES.GESTIONNAIRE), ACCES('clients'), clientController.supprimer);

/* ---------- VENTES / CAISSE ---------- */

// GET /api/ventes/stats/:periode (avant /:id)
app.get('/api/ventes/stats/:periode', authentifier, ACCES('transaction'), venteController.statistiques);

app.get('/api/ventes', authentifier, ACCES('transaction'), venteController.lister);
app.get('/api/ventes/:id', authentifier, ACCES('transaction'), venteController.afficher);
app.post('/api/ventes', authentifier, ACCES('transaction'), venteController.creer);
/* Annuler une vente remet le stock en place et touche à la caisse :
   réservé au superviseur et au gérant. */
app.post('/api/ventes/:id/annuler', authentifier, autoriserRoles(acces.ROLES.ADMIN, acces.ROLES.GESTIONNAIRE), ACCES('transaction'), venteController.annuler);

/* ---------- MOUVEMENTS DE STOCK ---------- */

app.get('/api/mouvements', authentifier, ACCES('mouvements'), mouvementController.lister);
app.get('/api/mouvements/:id', authentifier, ACCES('mouvements'), mouvementController.afficher);

/* ---------- FOURNISSEURS & ACHATS ---------- */

// GET /api/fournisseurs/alertes/reappro (avant /:id)
app.get(
  '/api/fournisseurs/alertes/reappro',
  authentifier,
  ACCES('reappro'),
  fournisseurController.alertesReappro
);

/* La liste des fournisseurs sert AUSSI à l'autocomplétion du formulaire
d'article : un rôle qui gère le stock doit pouvoir la lire, mêe s'il ne
gère pas les achats. Les écritures, elles, restent réservées aux achats. */
app.get(
  '/api/fournisseurs',
  authentifier,
  verifierAccesModule(req => (acces.roleAutorise(req.utilisateur?.role, 'achats') ? 'achats' : 'quincaillerie')),
  fournisseurController.lister
);
app.get('/api/fournisseurs/:id', authentifier, ACCES('achats'), fournisseurController.afficher);
app.post('/api/fournisseurs', authentifier, ACCES('achats'), fournisseurController.creer);
app.put('/api/fournisseurs/:id', authentifier, ACCES('achats'), fournisseurController.modifier);
app.delete('/api/fournisseurs/:id', authentifier, ACCES('achats'), fournisseurController.supprimer);
app.post(
  '/api/fournisseurs/:id/commander',
  authentifier,
  autoriserRoles(acces.ROLES.ADMIN, acces.ROLES.GESTIONNAIRE),
  ACCES('achats'),
  fournisseurController.creerCommande
);

/* ---------- BONS DE COMMANDE (ACHATS) ---------- */

app.get('/api/commandes', authentifier, ACCES('achats'), commandeController.lister);
app.get('/api/commandes/:id', authentifier, ACCES('achats'), commandeController.afficher);
app.post(
  '/api/commandes',
  authentifier,
  autoriserRoles(acces.ROLES.ADMIN, acces.ROLES.GESTIONNAIRE),
  ACCES('achats'),
  commandeController.creer
);
app.put(
  '/api/commandes/:id',
  authentifier,
  autoriserRoles(acces.ROLES.ADMIN, acces.ROLES.GESTIONNAIRE),
  ACCES('achats'),
  commandeController.modifier
);
/* La réception d'une commande incrémente le stock : elle est aussi utilisée
   depuis les livraisons, d'où l'accès au module transport. */
app.patch(
  '/api/commandes/:id/statut',
  authentifier,
  autoriserRoles(acces.ROLES.ADMIN, acces.ROLES.GESTIONNAIRE, acces.ROLES.LIVREUR),
  ACCES(req => (acces.roleAutorise(req.utilisateur?.role, 'achats') ? 'achats' : 'transport')),
  commandeController.changerStatut
);
app.delete(
  '/api/commandes/:id',
  authentifier,
  autoriserRoles(acces.ROLES.ADMIN, acces.ROLES.GESTIONNAIRE),
  ACCES('achats'),
  commandeController.supprimer
);

/* ---------- TRANSPORT & LOGISTIQUE ---------- */

app.get('/api/transports', authentifier, ACCES('transport'), transportController.lister);
app.get('/api/transports/:id', authentifier, ACCES('transport'), transportController.afficher);
app.post('/api/transports', authentifier, ACCES('transport'), transportController.creer);
app.put('/api/transports/:id', authentifier, ACCES('transport'), transportController.modifier);
app.delete('/api/transports/:id', authentifier, ACCES('transport'), transportController.supprimer);

/* ---------- DÉPENSES & CHARGES ---------- */

// Les dépenses touchent directement la trésorerie : seuls les rôles
// habilités peuvent les lire ou les modifier. Un Vendeur/Gestionnaire
// reçoit un 403, même s'il possède un jeton valide.
app.get('/api/depenses', authentifier, ACCES('depenses'), depenseController.lister);
app.get('/api/depenses/:id', authentifier, ACCES('depenses'), depenseController.afficher);
app.post('/api/depenses', authentifier, ACCES('depenses'), depenseController.creer);
app.put('/api/depenses/:id', authentifier, ACCES('depenses'), depenseController.modifier);
app.delete('/api/depenses/:id', authentifier, ACCES('depenses'), depenseController.supprimer);

/* ---------- ABONNEMENTS ---------- */

// GET /api/abonnements/actif (avant /:id) — l'état de l'abonnement doit
// rester lisible par tout utilisateur connecté (bandeaux, relances).
app.get('/api/abonnements/actif', authentifier, abonnementController.actif);
app.get('/api/abonnements', authentifier, ACCES('abonnements'), abonnementController.lister);
app.post('/api/abonnements', authentifier, ACCES('abonnements'), abonnementController.souscrire);

/* ---------- PAIEMENTS EN LIGNE (KKIAPAY) ---------- */

// GET /api/paiements/config → clés publiques utilisables côté client
// (nécessaire à l'écran de paiement abonnement, ouvert à tous les rôles).
app.get('/api/paiements/config', authentifier, paiementController.configPaiement);

// GET /api/paiements → historique des paiements de l'entreprise
app.get('/api/paiements', authentifier, ACCES('paiements'), paiementController.listerPaiements);

// POST /api/paiements/verifier → vérification serveur d'une transaction
// C'est le SEUL chemin par lequel un paiement devient « payé ».
app.post(
  '/api/paiements/verifier',
  authentifier,
  ACCES('paiements'),
  pareFeu.pareFeuRejeu,
  paiementController.verifierPaiement
);

/* Route inconnue : réponse JSON claire au lieu du HTML 404 par défaut. */
app.use((req, res) => {
  res.status(404).json({ error: 'Ressource introuvable.', chemin: req.originalUrl });
});

/* Gestionnaires d'erreur Express, enregistrés avant d'accepter les requêtes. */
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corps de requête trop volumineux.' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON invalide.' });
  }
  if (err && /CORS/i.test(err.message || '')) {
    return res.status(403).json({ error: 'Origine non autorisée : contactez l’administrateur.' });
  }
  console.error('Erreur non gérée :', err?.message || err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// Démarrage du serveur après l'enregistrement des routes et erreurs,
// et SEULEMENT si la base est joignable : sans elle, aucune authentification
// ni aucune route métier ne pourrait répondre.
let serveur = null;

const demarrerServeur = () => {
  serveur = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
};

/* Arrêt propre : libère la connexion MongoDB (utile sur Render). */
const arreterProprement = signal => {
  console.log(`Signal ${signal} reçu : fermeture du serveur…`);
  const finir = () => mongoose.disconnect().finally(() => process.exit(0));
  if (serveur) serveur.close(finir);
  else finir();
};
process.on('SIGTERM', () => arreterProprement('SIGTERM'));
process.on('SIGINT', () => arreterProprement('SIGINT'));

connexionMongo.then(baseDisponible => {
  if (!baseDisponible) {
    console.error(
      `Démarrage annulé : aucune écoute sur le port ${PORT} tant que MongoDB n'est pas joignable.\n` +
      "Corrigez la connexion à la base (voir message ci-dessus) puis relancez `npm start`."
    );
    process.exit(1);
  }
  demarrerServeur();
});
