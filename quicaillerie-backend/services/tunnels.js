const crypto = require('crypto');

/**
 * COUCHE DE TUNNELS — RÉSEAUX NATIONAUX ET INTERNATIONAUX
 * ============================================================
 * Problème réel : un serveur hébergé en Europe (Render/Francfort) est
 * pénalisé par la latence depuis la Côte d'Ivoire (~150-250 ms par
 * aller-retour). Sur une connexion mobile instable (2G/3G, coupures),
 * une requête peut échouer avant même d'atteindre l'API.
 *
 * Ce module met en place des « tunnels » applicatifs :
 *
 *   TUNNEL NATIONAL (Côte d'Ivoire et sous-région UEMOA)
 *     - tolérance maximale aux coupures (retry agressif) ;
 *     - délais courts + mise en attente locale ;
 *     - compression systématique pour économiser la bande passante ;
 *     - détection de réseau lent → réponses allégées.
 *
 *   TUNNEL INTERNATIONAL (reste du monde)
 *     - délais plus longs acceptés (latence océanique) ;
 *     - retry mesuré, backoff exponentiel ;
 *     - connexions persistantes (keep-alive).
 *
 *   TUNNEL DIRECT (LAN / même réseau)
 *     - aucune réécriture, latence minimale.
 *
 * Aucune donnée sensible n'est modifiée : les tunnels agissent sur le
 * transport, l'en-tête de traçabilité et la politique de reprise.
 */

/* ------------------------------------------------------------------
   DÉFINITION DES TUNNELS
   ------------------------------------------------------------------ */
const TUNNELS = {
  national: {
    nom: 'national',
    description: 'Côte d\u2019Ivoire et UEMOA — réseau mobile instable',
    // Pays/régions rattachés au tunnel national (code ISO 3166-1 alpha-2).
    pays: ['CI', 'SN', 'BF', 'ML', 'NE', 'TG', 'BJ', 'GN', 'GW', 'LR', 'GH', 'NG'],
    // Tolérance aux erreurs transitoires.
    tentativesMax: 5,
    delaiInitialMs: 250,
    delaiMaxMs: 2000,
    toleranceCoupureMs: 30000,   // accepte une reprise après 30 s hors ligne
    compression: true,
    keepAlive: true,
    tailleChunk: 'reduite'
  },
  international: {
    nom: 'international',
    description: 'Reste du monde — latence océanique',
    pays: [],
    tentativesMax: 3,
    delaiInitialMs: 500,
    delaiMaxMs: 4000,
    toleranceCoupureMs: 15000,
    compression: true,
    keepAlive: true,
    tailleChunk: 'standard'
  },
  direct: {
    nom: 'direct',
    description: 'Réseau local / même région',
    pays: [],
    tentativesMax: 2,
    delaiInitialMs: 100,
    delaiMaxMs: 800,
    toleranceCoupureMs: 5000,
    compression: false,
    keepAlive: true,
    tailleChunk: 'standard'
  }
};

/* ------------------------------------------------------------------
   DÉTECTION DU TUNNEL ADAPTÉ
   ------------------------------------------------------------------ */

/**
 * Détermine le tunnel à utiliser selon l'origine de la requête.
 * L'ordre de priorité est : en-tête explicite > pays déclaré > région.
 */
const choisirTunnel = (req) => {
  // 1. L'application native ou le frontend peut déclarer son tunnel.
  const declare = String(req.headers['x-tunnel'] || '').toLowerCase();
  if (TUNNELS[declare]) return TUNNELS[declare];

  // 2. Pays fourni par le proxy/CDN (Render transmet le pays via en-tête).
  const pays = String(
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-country'] ||
    ''
  ).toUpperCase();
  if (pays && TUNNELS.national.pays.includes(pays)) return TUNNELS.national;

  // 3. Repli : l'application cliente indique un réseau lent (2G/3G).
  const reseau = String(req.headers['x-network-type'] || '').toLowerCase();
  if (['slow-2g', '2g', '3g'].includes(reseau)) return TUNNELS.national;

  // 4. Par défaut : tunnel international (le plus prudent hors zone connue).
  return TUNNELS.international;
};

/* ------------------------------------------------------------------
   EN-TÊTES DE TUNNEL
   ------------------------------------------------------------------ */

/**
 * Ajoute les en-têtes qui indiquent au client quel tunnel suivre et
 * comment reprendre en cas de coupure.
 */
const appliquerEnTetesTunnel = (req, res, tunnel) => {
  res.setHeader('X-Tunnel', tunnel.nom);
  res.setHeader('X-Tunnel-Region', tunnel.description);
  res.setHeader('X-Tunnel-Retry-Max', String(tunnel.tentativesMax));
  res.setHeader('X-Tunnel-Retry-Delay', String(tunnel.delaiInitialMs));
  res.setHeader('X-Tunnel-Resume-Window', String(tunnel.toleranceCoupureMs));
  // Les connexions peuvent être gardées ouvertes entre requêtes.
  res.setHeader('Connection', tunnel.keepAlive ? 'keep-alive' : 'close');
  res.setHeader('Keep-Alive', `timeout=${Math.round(tunnel.toleranceCoupureMs / 1000)}, max=100`);
  // Identifiant de tunnel : permet au client de reprendre au bon endroit.
  res.setHeader('X-Tunnel-Id', crypto
    .createHash('sha256')
    .update(`${tunnel.nom}|${req.headers['user-agent'] || ''}`)
    .digest('hex')
    .slice(0, 12));
};

/* ------------------------------------------------------------------
   MIDDLEWARE
   ------------------------------------------------------------------ */

/**
 * Middleware principal : choisit le tunnel, applique les en-têtes et
 * expose le tunnel courant sur `req.tunnel` pour les autres middlewares.
 */
const middlewareTunnel = (req, res, next) => {
  try {
    const tunnel = choisirTunnel(req);
    req.tunnel = tunnel;
    appliquerEnTetesTunnel(req, res, tunnel);
    next();
  } catch {
    // En cas d'imprévu, on laisse passer sans tunnel (jamais bloquant).
    next();
  }
};

/* ------------------------------------------------------------------
   STRATÉGIE DE REPRISE (utilisée par le client)
   ------------------------------------------------------------------ */

/**
 * Calcule le délai avant nouvelle tentative (backoff exponentiel borné).
 * @param {string} nomTunnel
 * @param {number} tentative  numéro de la tentative (1, 2, 3…)
 * @param {boolean} enLigne   le client a-t-il du réseau ?
 */
const calculerReprise = (nomTunnel, tentative, enLigne = true) => {
  const tunnel = TUNNELS[nomTunnel] || TUNNELS.international;

  // Hors ligne : on attend plus longtemps, sans consommer de tentatives.
  if (!enLigne) {
    return { attendre: 3000, consommeTentative: false, abandonner: false };
  }

  if (tentative > tunnel.tentativesMax) {
    return { attendre: 0, consommeTentative: false, abandonner: true };
  }

  // Backoff exponentiel avec jitter (évite l'effet de troupeau).
  const base = Math.min(tunnel.delaiMaxMs, tunnel.delaiInitialMs * 2 ** (tentative - 1));
  const jitter = Math.round(base * 0.2 * Math.random());

  return { attendre: base + jitter, consommeTentative: true, abandonner: false };
};

/** Réponse décrivant la politique de reprise d'un tunnel (endpoint public). */
const decrireTunnel = (req) => {
  const tunnel = choisirTunnel(req);
  return {
    tunnel: tunnel.nom,
    description: tunnel.description,
    reprise: {
      tentativesMax: tunnel.tentativesMax,
      delaiInitialMs: tunnel.delaiInitialMs,
      delaiMaxMs: tunnel.delaiMaxMs
    },
    coupure: { toleranceMs: tunnel.toleranceCoupureMs },
    compression: tunnel.compression,
    tailles: tunnel.tailleChunk
  };
};

module.exports = {
  TUNNELS,
  choisirTunnel,
  middlewareTunnel,
  calculerReprise,
  decrireTunnel,
  appliquerEnTetesTunnel
};
