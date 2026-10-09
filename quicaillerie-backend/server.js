const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
app.set('trust proxy',1);

const PORT = process.env.PORT || 5001;
const { ObjectIdValide } = require('./middleware/tenant');

const production = process.env.NODE_ENV === 'production';
const originesAutorisees = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origine => origine.trim())
  .filter(Boolean);

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
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET doit contenir au moins 32 caractères.');
}

// Middlewares
app.disable('x-powered-by');
// Trust only the proxy hop directly in front of Express; configure this to the
// actual Render proxy topology and verify the resulting req.ip at /ip.
app.set('trust proxy', 1);
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
    if (!origine || ORIGINES_NATIVES.includes(origine) || originesAutorisees.includes(origine)) {
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
  message: { error: 'Trop de requêtes. Réessayez plus tard.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: keyGeneratorIp,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
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

if (uri) {
  mongoose.connect(uri)
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
      process.exitCode = 1;
    });
} else {
  console.error('MONGODB_URI absent du fichier .env : copiez .env.example vers .env puis completez la valeur.');
  process.exitCode = 1;
}

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

const createMailTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
};


// Diagnostic temporaire pour vérifier l'IP calculée par Express derrière le proxy.
app.get('/ip', (req, res) => res.send(req.ip || req.socket?.remoteAddress || 'unknown'));

// Health check dédié : réponse minimale et rapide, sans exposer de secret.
app.get('/health', (req, res) => {
  const pret = mongoose.connection.readyState === 1;
  res.status(pret ? 200 : 503).json({
    statut: pret ? 'ok' : 'degraded',
    base: pret ? 'connectee' : 'deconnectee',
    horodatage: new Date().toISOString()
  });
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
const { authentifier, autoriserRoles } = require('./middleware/tenant');
const authController = require('./controllers/authController');
const clientPortalController = require('./controllers/clientPortalController');
const produitController = require('./controllers/produitController');
const clientController = require('./controllers/clientController');
const venteController = require('./controllers/venteController');
const fournisseurController = require('./controllers/fournisseurController');
const mouvementController = require('./controllers/mouvementController');
const transportController = require('./controllers/transportController');
const depenseController = require('./controllers/depenseController');
const abonnementController = require('./controllers/abonnementController');
const paiementController = require('./controllers/paiementController');
const reinitialisationService = require('./services/reinitialisationService');

/* ---------- AUTHENTIFICATION (routes publiques) ---------- */

// POST /api/auth/inscription → onboarding d'un nouvel acheteur
app.post('/api/auth/inscription', pareFeu.pareFeuEnumeration, authController.inscription);

// POST /api/auth/login → renvoie un jeton signé
app.post('/api/auth/login', pareFeu.pareFeuEnumeration, authController.login);
app.post('/api/auth/mot-de-passe/oublie', pareFeu.pareFeuEnumeration, reinitialisationService.demander);
app.post('/api/auth/mot-de-passe/reinitialiser', reinitialisationService.confirmer);

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

// GET /api/auth/utilisateurs → comptes de mon entreprise
app.get('/api/auth/utilisateurs', authentifier, authController.listerUtilisateurs);

// POST /api/auth/utilisateurs → créer un compte (Administrateur de l'entreprise)
app.post(
  '/api/auth/utilisateurs',
  authentifier,
  autoriserRoles('Administrateur'),
  authController.creerUtilisateur
);

// DELETE /api/auth/utilisateurs/:id → désactiver un compte
app.delete(
  '/api/auth/utilisateurs/:id',
  authentifier,
  autoriserRoles('Administrateur'),
  authController.supprimerUtilisateur
);

// POST /api/auth/utilisateurs/:id/debloquer → débloquer un compte bloqué
// après trop de réinitialisations (ou maintenir le blocage selon la décision).
app.post(
  '/api/auth/utilisateurs/:id/debloquer',
  authentifier,
  autoriserRoles('Administrateur'),
  authController.debloquerUtilisateur
);

/* ---------- CATALOGUE (produits) ---------- */

// GET /api/products/code/:code → recherche scanner (avant /:id)
app.get('/api/products/code/:code', authentifier, produitController.rechercherParCode);

app.get('/api/products', authentifier, produitController.lister);
app.get('/api/products/:id', authentifier, produitController.afficher);
app.post('/api/products', authentifier, produitController.creer);
app.put('/api/products/:id', authentifier, produitController.modifier);
app.delete('/api/products/:id', authentifier, produitController.supprimer);
app.post('/api/products/:id/stock', authentifier, produitController.bougerLeStock);
app.post('/api/products/:id/inventaire', authentifier, produitController.inventorier);

/* ---------- CLIENTS ---------- */

app.get('/api/clients', authentifier, clientController.lister);
app.get('/api/clients/:id', authentifier, clientController.afficher);
app.post('/api/clients', authentifier, clientController.creer);
app.put('/api/clients/:id', authentifier, clientController.modifier);
app.delete('/api/clients/:id', authentifier, clientController.supprimer);

/* ---------- VENTES / CAISSE ---------- */

// GET /api/ventes/stats/:periode (avant /:id)
app.get('/api/ventes/stats/:periode', authentifier, venteController.statistiques);

app.get('/api/ventes', authentifier, venteController.lister);
app.get('/api/ventes/:id', authentifier, venteController.afficher);
app.post('/api/ventes', authentifier, venteController.creer);
app.post('/api/ventes/:id/annuler', authentifier, venteController.annuler);

/* ---------- MOUVEMENTS DE STOCK ---------- */

app.get('/api/mouvements', authentifier, mouvementController.lister);
app.get('/api/mouvements/:id', authentifier, mouvementController.afficher);

/* ---------- FOURNISSEURS & ACHATS ---------- */

// GET /api/fournisseurs/alertes/reappro (avant /:id)
app.get(
  '/api/fournisseurs/alertes/reappro',
  authentifier,
  fournisseurController.alertesReappro
);

app.get('/api/fournisseurs', authentifier, fournisseurController.lister);
app.get('/api/fournisseurs/:id', authentifier, fournisseurController.afficher);
app.post('/api/fournisseurs', authentifier, fournisseurController.creer);
app.put('/api/fournisseurs/:id', authentifier, fournisseurController.modifier);
app.delete('/api/fournisseurs/:id', authentifier, fournisseurController.supprimer);
app.post(
  '/api/fournisseurs/:id/commander',
  authentifier,
  autoriserRoles('Administrateur', 'Magasinier'),
  fournisseurController.creerCommande
);

/* ---------- TRANSPORT & LOGISTIQUE ---------- */

app.get('/api/transports', authentifier, transportController.lister);
app.get('/api/transports/:id', authentifier, transportController.afficher);
app.post('/api/transports', authentifier, transportController.creer);
app.put('/api/transports/:id', authentifier, transportController.modifier);
app.delete('/api/transports/:id', authentifier, transportController.supprimer);

/* ---------- DÉPENSES & CHARGES ---------- */

// Les dépenses touchent directement la trésorerie : seuls les rôles
// habilités peuvent les lire ou les modifier. Un Caissier/Magasinier
// reçoit un 403, même s'il possède un jeton valide.
app.get('/api/depenses', authentifier, autoriserRoles('Administrateur'), depenseController.lister);
app.get('/api/depenses/:id', authentifier, autoriserRoles('Administrateur'), depenseController.afficher);
app.post('/api/depenses', authentifier, autoriserRoles('Administrateur'), depenseController.creer);
app.put('/api/depenses/:id', authentifier, autoriserRoles('Administrateur'), depenseController.modifier);
app.delete('/api/depenses/:id', authentifier, autoriserRoles('Administrateur'), depenseController.supprimer);

/* ---------- ABONNEMENTS ---------- */

// GET /api/abonnements/actif (avant /:id)
app.get('/api/abonnements/actif', authentifier, abonnementController.actif);
app.get('/api/abonnements', authentifier, abonnementController.lister);
app.post('/api/abonnements', authentifier, abonnementController.souscrire);

/* ---------- PAIEMENTS EN LIGNE (KKIAPAY) ---------- */

// GET /api/paiements/config → clés publiques utilisables côté client
app.get('/api/paiements/config', authentifier, paiementController.configPaiement);

// GET /api/paiements → historique des paiements de l'entreprise
app.get('/api/paiements', authentifier, paiementController.listerPaiements);

// POST /api/paiements/verifier → vérification serveur d'une transaction
// C'est le SEUL chemin par lequel un paiement devient « payé ».
app.post(
  '/api/paiements/verifier',
  authentifier,
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

// Démarrage du serveur après l'enregistrement des routes et erreurs.
const serveur = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

/* Arrêt propre : libère la connexion MongoDB (utile sur Render). */
const arreterProprement = signal => {
  console.log(`Signal ${signal} reçu : fermeture du serveur…`);
  serveur.close(() => {
    mongoose.disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGTERM', () => arreterProprement('SIGTERM'));
process.on('SIGINT', () => arreterProprement('SIGINT'));
