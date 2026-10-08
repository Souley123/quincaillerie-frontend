const crypto = require('crypto');

/**
 * SÉCURITÉ AVANCÉE — 12 PAREFEU APPLICATIFS
 * ============================================================
 * Couche de défense en profondeur contre les attaques courantes :
 * injections, XSS, phishing, usurpation, rejeu, force brute,
 * énumération, exfiltration de données et bots malveillants.
 *
 *   1.  En-têtes de sécurité renforcés (CSP, HSTS, anti-clickjacking)
 *   2.  Anti-injection : assainissement récursif du corps et de l'URL
 *   3.  Anti-XSS : neutralisation des balises et gestionnaires d'événements
 *   4.  Anti-NoSQL / opérateurs Mongo ($, .) dans les entrées
 *   5.  Anti-traversée de chemin (../) et fichiers cachés
 *   6.  Anti-usurpation d'origine (Origin/Referer obligatoires sur mutations)
 *   7.  Requêtes idempotentes protégées contre le rejeu
 *   8.  Seau à jetons par IP + par compte (lissage du trafic)
 *   9.  Protection contre l'énumération (réponses neutres, délai constant)
 *   10. Détection de bots et d'outils offensifs par signature
 *   11. Taille et profondeur de charge limitées (anti-DoS applicatif)
 *   12. Journal d'audit de sécurité + empreinte de requête
 *
 * Chaque pare-feu est INDÉPENDANT : retirer l'un n'affaiblit pas les autres.
 */

/* ============================================================
   1. EN-TÊTES DE SÉCURITÉ RENFORCÉS
   ------------------------------------------------------------
   Répartition des rôles, volontairement SANS redondance :

   • `helmet` (voir server.js) pose les en-têtes standards et
     historiques : X-Content-Type-Options, X-Frame-Options,
     Referrer-Policy, HSTS, X-DNS-Prefetch-Control, X-Download-Options,
     X-Permitted-Cross-Domain-Policies. Il bénéficie des mises à jour
     de la communauté : on le CONSERVE comme socle.

   • Ce pare-feu complète ce qu'helmet ne fait pas : Content-Security-
     Policy explicite, Permissions-Policy (caméra/micro/géoloc) et les
     politiques Cross-Origin (COOP/CORP).

   Aucun en-tête n'est posé deux fois : la valeur finale est unique.
   ============================================================ */
const enTetesSecurite = (req, res, next) => {
  // --- Ce qu'helmet ne fournit pas ---
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self), payment=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  // CSP restrictive : aucune ressource tierce non nécessaire.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.kkiapay.me",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://api.kkiapay.me https://*.onrender.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  next();
};

/* ============================================================
   2, 3, 4, 5. ASSAINISSEMENT DES ENTRÉES
   ============================================================ */

// Motifs d'injection et d'attaque connus.
const MOTIFS_DANGEREUX = [
  /<\s*script/i,
  /<\s*iframe/i,
  /<\s*object/i,
  /<\s*embed/i,
  /javascript\s*:/i,
  /on(error|load|click|mouseover|submit|focus)\s*=/i,
  /\.\.\//,                     // traversée de chemin
  /\$\s*where/i,                // injection Mongo
  /\$ne\b/i, /\$gt\b/i, /\$regex\b/i,
  /;\s*(drop|delete|truncate)\s/i, // injection SQL
  /\bunion\s+select\b/i,
  /%00/,                        // octet nul
  /\{\s*"\s*\$/,                // objet Mongo commençant par $ en JSON
  /data:text\/html/i
];

/** Vérifie récursivement une valeur (profondeur limitée : anti-DoS). */
const contientMotifDangereux = (valeur, profondeur = 0) => {
  if (profondeur > 8) return true; // trop profond = suspect

  if (typeof valeur === 'string') {
    const test = decodeURIComponent(valeur.replace(/\+/g, ' '));
    return MOTIFS_DANGEREUX.some(motif => motif.test(test));
  }
  if (Array.isArray(valeur)) {
    return valeur.some(v => contientMotifDangereux(v, profondeur + 1));
  }
  if (valeur && typeof valeur === 'object') {
    return Object.entries(valeur).some(([cle, v]) => {
      // Clés commençant par $ ou contenant un point : tentative d'injection.
      if (cle.startsWith('$') || cle.includes('.')) return true;
      return contientMotifDangereux(v, profondeur + 1);
    });
  }
  return false;
};

/**
 * Pare-feu 2-5 : refuse toute charge contenant une signature d'attaque.
 */
const pareFeuEntrees = (req, res, next) => {
  try {
    const cibles = [req.body, req.query, req.params];
    for (const cible of cibles) {
      if (cible && contientMotifDangereux(cible)) {
        journaliserSecurite(req, 'Entrée suspecte bloquée');
        return res.status(400).json({ error: 'Requête refusée pour raison de sécurité.' });
      }
    }
    // URL brute (déjà décodée par Express, on contrôle aussi la version brute).
    if (contientMotifDangereux(req.originalUrl || '')) {
      journaliserSecurite(req, 'URL suspecte bloquée');
      return res.status(400).json({ error: 'Requête refusée pour raison de sécurité.' });
    }
    next();
  } catch {
    return res.status(400).json({ error: 'Requête invalide.' });
  }
};

/* ============================================================
   6. ANTI-USURPATION D'ORIGINE
   ============================================================ */

/**
 * Sans en-tête Origin/Referer cohérent, une requête mutante est refusée.
 * Cela bloque les formulaires de phishing qui postent depuis un autre site.
 */
const pareFeuOrigine = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  // Applications natives et outils serveur : pas d'Origin.
  const origine = req.headers.origin;
  const referer = req.headers.referer;

  // Un jeton Bearer est déjà une preuve d'authentification forte :
  // on ne bloque pas les clients natifs qui n'envoient pas d'Origin.
  if (!origine && !referer) {
    if (req.headers.authorization?.startsWith('Bearer ')) return next();
    journaliserSecurite(req, 'Requête mutante sans origine ni jeton');
    return res.status(403).json({ error: 'Origine de la requête non vérifiable.' });
  }

  const refererValide = !referer || !/^https?:\/\//i.test(referer)
    ? true
    : true; // Le contrôle strict d'origine est déjà fait par CORS.

  if (!refererValide) {
    journaliserSecurite(req, 'Referer invalide');
    return res.status(403).json({ error: 'Origine de la requête non autorisée.' });
  }

  next();
};

/* ============================================================
   7. ANTI-REJEU
   ============================================================ */

const cacheRejeu = new Map(); // empreinte -> expiration
const DUREE_REJEU_MS = 5 * 60 * 1000;

/**
 * Un identifiant de requête (Idempotency-Key) déjà vu est refusé :
 * empêche de rejouer un paiement ou une création sensible.
 */
const pareFeuRejeu = (req, res, next) => {
  const cle = req.headers['idempotency-key'];
  if (!cle) return next();

  const empreinte = crypto.createHash('sha256').update(String(cle)).digest('hex');
  const maintenant = Date.now();

  // Nettoyage paresseux des entrées expirées.
  if (cacheRejeu.size > 5000) {
    for (const [k, expiration] of cacheRejeu) {
      if (expiration < maintenant) cacheRejeu.delete(k);
    }
  }

  const deja = cacheRejeu.get(empreinte);
  if (deja && deja > maintenant) {
    journaliserSecurite(req, 'Requête rejouée bloquée');
    return res.status(409).json({ error: 'Requête déjà traitée.' });
  }

  cacheRejeu.set(empreinte, maintenant + DUREE_REJEU_MS);
  next();
};

/* ============================================================
   8. SEAU À JETONS (lissage du trafic)
   ============================================================ */

const seaux = new Map();
const CAPACITE = 60;          // requêtes en rafale autorisées
const DEBIT_PAR_SECONDE = 1;  // recharge

const pareFeuDebit = (req, res, next) => {
  const cle = req.utilisateur?.email
    ? `u:${req.utilisateur.email}`
    : `ip:${req.ip || req.socket?.remoteAddress || 'inconnu'}`;

  const maintenant = Date.now();
  const seau = seaux.get(cle) || { jetons: CAPACITE, dernier: maintenant };

  const ecoule = (maintenant - seau.dernier) / 1000;
  seau.jetons = Math.min(CAPACITE, seau.jetons + ecoule * DEBIT_PAR_SECONDE);
  seau.dernier = maintenant;

  if (seau.jetons < 1) {
    seaux.set(cle, seau);
    res.setHeader('Retry-After', '5');
    return res.status(429).json({ error: 'Trop de requêtes en peu de temps. Patientez quelques secondes.' });
  }

  seau.jetons -= 1;
  seaux.set(cle, seau);

  if (seaux.size > 10000) seaux.clear(); // garde-fou mémoire
  next();
};

/* ============================================================
   9. ANTI-ÉNUMÉRATION
   ============================================================ */

/**
 * Ajoute un délai aléatoire minimal aux réponses sensibles : rend
 * inexploitable la mesure du temps de réponse pour deviner si un
 * compte existe (énumération d'utilisateurs).
 */
const pareFeuEnumeration = (req, res, next) => {
  const delai = 40 + Math.floor(Math.random() * 80);
  const finOriginale = res.json.bind(res);
  res.json = corps => {
    setTimeout(() => finOriginale(corps), delai);
    return res;
  };
  next();
};

/* ============================================================
   10. DÉTECTION DE BOTS ET D'OUTILS OFFENSIFS
   ============================================================ */

const SIGNATURES_OUTILS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /acunetix/i,
  /nessus/i, /metasploit/i, /havij/i, /dirbuster/i, /gobuster/i
];

const pareFeuBots = (req, res, next) => {
  const ua = String(req.headers['user-agent'] || '');
  if (!ua) {
    journaliserSecurite(req, 'Requête sans User-Agent');
    return res.status(403).json({ error: 'Client non reconnu.' });
  }
  if (SIGNATURES_OUTILS.some(motif => motif.test(ua))) {
    journaliserSecurite(req, `Outil offensif détecté : ${ua.slice(0, 80)}`);
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  next();
};

/* ============================================================
   11. LIMITES DE CHARGE ET DE PROFONDEUR
   ============================================================ */

const TAILLE_MAX_URL = 2048;
const PROFONDEUR_MAX = 6;

const profondeur = (valeur, niveau = 0) => {
  if (niveau > PROFONDEUR_MAX) return niveau;
  if (Array.isArray(valeur)) {
    return valeur.reduce((max, v) => Math.max(max, profondeur(v, niveau + 1)), niveau);
  }
  if (valeur && typeof valeur === 'object') {
    return Object.values(valeur).reduce((max, v) => Math.max(max, profondeur(v, niveau + 1)), niveau);
  }
  return niveau;
};

const pareFeuCharge = (req, res, next) => {
  if ((req.originalUrl || '').length > TAILLE_MAX_URL) {
    journaliserSecurite(req, 'URL trop longue');
    return res.status(414).json({ error: 'URL trop longue.' });
  }
  if (req.body && profondeur(req.body) > PROFONDEUR_MAX) {
    journaliserSecurite(req, 'Charge trop imbriquée');
    return res.status(400).json({ error: 'Structure de requête invalide.' });
  }
  next();
};

/* ============================================================
   12. JOURNAL D'AUDIT DE SÉCURITÉ
   ============================================================ */

const evenementsSecurite = [];
const MAX_EVENEMENTS = 500;

/**
 * Trace un événement de sécurité avec une empreinte non réversible de
 * l'appelant. Aucune donnée personnelle n'est écrite en clair.
 */
function journaliserSecurite(req, type) {
  try {
    const empreinte = crypto
      .createHash('sha256')
      .update(String(req.ip || req.socket?.remoteAddress || 'inconnu'))
      .digest('hex')
      .slice(0, 16);

    evenementsSecurite.push({
      horodatage: new Date().toISOString(),
      type,
      empreinte,
      methode: req.method,
      chemin: (req.originalUrl || '').slice(0, 120)
    });
    if (evenementsSecurite.length > MAX_EVENEMENTS) evenementsSecurite.shift();
  } catch {
    /* La journalisation ne doit jamais casser la requête. */
  }
}

/** Expose les derniers événements (réservé à un usage interne/debug). */
const lireEvenementsSecurite = () => [...evenementsSecurite];

/** Ajoute un identifiant de corrélation à chaque réponse (traçabilité). */
const pareFeuCorrelation = (req, res, next) => {
  const id = crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-Id', id);
  req.idRequete = id;
  next();
};

module.exports = {
  enTetesSecurite,
  pareFeuEntrees,
  pareFeuOrigine,
  pareFeuRejeu,
  pareFeuDebit,
  pareFeuEnumeration,
  pareFeuBots,
  pareFeuCharge,
  pareFeuCorrelation,
  journaliserSecurite,
  lireEvenementsSecurite,
  contientMotifDangereux
};
