const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
/* Les routes publiques des tunnels sont déclarées après le middleware
   tunnels.middlewareTunnel, afin de renvoyer aussi les en-têtes X-Tunnel-*. */

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
app.set('trust proxy', production ? 1 : false);
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
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));

/* ---------- SÉCURITÉ AVANCÉE : 12 PAREFEU APPLICATIFS ----------
   Couche de défense en profondeur (injections, XSS, phishing,
   usurpation, rejeu, force brute, bots offensifs…). L'ordre compte :
   corrélation, en-têtes, bots, charge, puis assainissement. */
const pareFeu = require('./middleware/pareFeu');
app.use(pareFeu.pareFeuCorrelation);   // 12. identifiant de corrélation

/* ---------- TUNNELS NATIONAUX ET INTERNATIONAUX ----------
   Adapte le transport à la qualité du réseau du client : tolérance aux
   coupures, reprise et compression pour la Côte d'Ivoire et l'UEMOA ;
   politique classique pour le reste du monde. */
const tunnels = require('./services/tunnels');
app.use(tunnels.middlewareTunnel);
app.use(pareFeu.enTetesSecurite);      // 1.  en-têtes renforcés
app.use(pareFeu.pareFeuBots);          // 10. détection d'outils offensifs
app.use(pareFeu.pareFeuCharge);        // 11. limites de taille/profondeur
app.use(pareFeu.pareFeuEntrees);       // 2-5. anti-injection / XSS / NoSQL
app.use(pareFeu.pareFeuOrigine);       // 6.  anti-usurpation d'origine
app.use(pareFeu.pareFeuRejeu);         // 7.  anti-rejeu (Idempotency-Key)
app.use(pareFeu.pareFeuDebit);         // 8.  seau à jetons

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez plus tard.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/inscription', authLimiter);
app.use('/api/auth/mot-de-passe', authLimiter);

const securityAlertLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop d’alertes envoyées. Réessayez plus tard.' }
});
app.use('/api/security/alert', securityAlertLimiter);

app.use(cors({
  origin: (origine, callback) => {
    // Les outils serveur-à-serveur n’envoient souvent pas Origin.
    if (!origine) return callback(null, true);
    // Applications mobiles natives (Android / iOS via Capacitor).
    if (ORIGINES_NATIVES.includes(origine)) return callback(null, true);
    if (originesAutorisees.includes(origine)) return callback(null, true);
    // Les liens de paiement et les déploiements de prévisualisation
    // (*.onrender.com, *.vercel.app, github.io) restent restreints aux
    // domaines autorisés explicitement via CORS_ORIGINS.
    return callback(new Error('Origine non autorisée par CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    // Tunnels : le client annonce son type de réseau et son tunnel.
    'X-Tunnel',
    'X-Network-Type',
    // Anti-rejeu sur les paiements.
    'Idempotency-Key'
  ],
  exposedHeaders: [
    'RateLimit',
    'RateLimit-Policy',
    // Politique de reprise renvoyée par la couche de tunnels.
    'X-Tunnel',
    'X-Tunnel-Region',
    'X-Tunnel-Retry-Max',
    'X-Tunnel-Retry-Delay',
    'X-Tunnel-Resume-Window',
    'X-Tunnel-Id',
    'X-Request-Id'
  ],
  maxAge: 600
}));

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
    .then(() => console.log("Connecté à MongoDB Atlas pour SKYS ERP Solution !"))
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

// ------------------------------------------------------------------
// DIAGNOSTIC DES TUNNELS (routes publiques, sans données sensibles)
// ------------------------------------------------------------------
// Permettent de vérifier laquelle des trois politiques de transport
// (national / international / direct) s'applique à l'appelant, et ce
// que le serveur annonce comme stratégie de reprise.

// Liste exhaustive des tunnels disponibles et de leurs paramètres.
app.get('/api/tunnel', (req, res) => {
  res.json({
    tunnel: tunnels.decrireTunnel(req).tunnel,
    description: tunnels.decrireTunnel(req).description,
    reprise: tunnels.decrireTunnel(req).reprise,
    coupure: tunnels.decrireTunnel(req).coupure,
    compression: tunnels.decrireTunnel(req).compression,
    tailles: tunnels.decrireTunnel(req).tailles,
    actifs: true,
    disponibles: Object.values(tunnels.TUNNELS).map(t => ({
      nom: t.nom,
      description: t.description,
      tentativesMax: t.tentativesMax,
      delaiInitialMs: t.delaiInitialMs,
      delaiMaxMs: t.delaiMaxMs,
      toleranceCoupureMs: t.toleranceCoupureMs,
      compression: t.compression,
      keepAlive: t.keepAlive
    }))
  });
});

// Alias explicite (pratique pour un test rapide dans le navigateur).
app.get('/api/tunnel/courant', (req, res) => {
  const tunnels = require('./services/tunnels');
  res.json(tunnels.decrireTunnel(req));
});

// Simule la politique de reprise pour un tunnel donné et une tentative
// donnée : permet de comprendre le backoff sans client réel.
//   /api/tunnel/reprise?tunnel=national&tentative=2
app.get('/api/tunnel/reprise', (req, res) => {
  const tunnels = require('./services/tunnels');
  const nom = String(req.query.tunnel || 'international').toLowerCase();
  if (!tunnels.TUNNELS[nom]) {
    return res.status(400).json({
      error: 'Tunnel inconnu.',
      tunnelsValides: Object.keys(tunnels.TUNNELS)
    });
  }
  const tentative = Math.max(1, Number(req.query.tentative) || 1);
  const enLigne = String(req.query.enLigne ?? 'true') !== 'false';
  res.json({
    tunnel: nom,
    tentative,
    enLigne,
    politique: tunnels.calculerReprise(nom, tentative, enLigne)
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

/* Route inconnue : réponse JSON claire au lieu du HTML 404 par défaut
   d'Express. Sans cela, le frontend reçoit du HTML et échoue au JSON.parse. */
app.use((req, res) => {
  res.status(404).json({ error: 'Ressource introuvable.', chemin: req.originalUrl });
});

// Démarrage du serveur
const serveur = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

/* Erreur CORS : réponse claire au lieu d’un 500 générique. */
app.use((err, req, res, next) => {
  if (err && /CORS/i.test(err.message || '')) {
    return res.status(403).json({ error: 'Origine non autorisée : contactez l’administrateur.' });
  }
  console.error('Erreur non gérée :', err?.message || err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
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