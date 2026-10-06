const crypto = require('crypto');

/**
 * SERVICE AUTHENTIFICATION
 * ------------------------------------------------------------
 * Implémentation sans dépendance externe : HMAC-SHA256 pour les
 * empreintes de mot de passe et un jeton signé de type JWT
 * (RS256 est inutile ici : seule l'intégrité est vérifiée par
 * le serveur qui a lui-même émis le jeton).
 *
 * Le companyId figure dans la charge utile du jeton : il ne peut
 * pas être falsifié sans connaître le JWT_SECRET.
 */

const JWT_SECRET = process.env.JWT_SECRET;
const DUREE_JETON = process.env.JWT_DUREE || '12h';

if (!JWT_SECRET) {
  console.error(
    'JWT_SECRET absent du .env : génération de jetons impossible. ' +
    'Renseignez une valeur aléatoire longue avant de démarrer en production.'
  );
}

/* ------------------------------------------------------------------
 * Base64 URL-safe
 * ---------------------------------------------------------------- */
const base64url = buffer =>
  Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64url = texte =>
  Buffer.from(String(texte).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

/* ------------------------------------------------------------------
 * Mot de passe
 * ---------------------------------------------------------------- */

/** Hache un mot de passe avec son sel. Format stocké : sel:empreinte */
const hacherMotDePasse = (motDePasse, sel = crypto.randomBytes(16).toString('hex')) => {
  const empreinte = crypto
    .pbkdf2Sync(String(motDePasse), sel, 120000, 64, 'sha512')
    .toString('hex');
  return `${sel}:${empreinte}`;
};

/** Vérifie un mot de passe face à une empreinte stockée. */
const verifierMotDePasse = (motDePasse, stocke) => {
  if (typeof stocke !== 'string' || !stocke.includes(':')) return false;

  const [sel, empreinte] = stocke.split(':');
  const candidat = crypto
    .pbkdf2Sync(String(motDePasse), sel, 120000, 64, 'sha512')
    .toString('hex');

  // Comparaison à temps constant : évite de révéler le préfixe correct
  // par mesure du temps de réponse.
  const a = Buffer.from(candidat, 'hex');
  const b = Buffer.from(empreinte, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/* ------------------------------------------------------------------
 * Jeton signé (JWT HS256)
 * ---------------------------------------------------------------- */

/** Convertit '12h' / '30d' / '3600' en millisecondes. */
const dureeEnMs = valeur => {
  const correspondances = { m: 60e3, h: 3600e3, j: 86400e3, d: 86400e3 };
  const unite = String(valeur).slice(-1).toLowerCase();
  const nombre = Number(String(valeur).slice(0, -1));
  if (correspondances[unite] && Number.isFinite(nombre)) {
    return nombre * correspondances[unite];
  }
  return Number(valeur) * 1000;
};

const signer = charge => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET non configuré.');

  const entete = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const chargeSignee = base64url(JSON.stringify({
    ...charge,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + Math.floor(dureeEnMs(DUREE_JETON) / 1000)
  }));

  const signature = base64url(
    crypto.createHmac('sha256', JWT_SECRET).update(`${entete}.${chargeSignee}`).digest()
  );

  return `${entete}.${chargeSignee}.${signature}`;
};

const verifier = jeton => {
  if (!JWT_SECRET || typeof jeton !== 'string') return null;

  const parts = jeton.split('.');
  if (parts.length !== 3) return null;

  const [entete, chargeSignee, signature] = parts;

  // Signature attendue recalculée à partir du secret serveur.
  const attendue = base64url(
    crypto.createHmac('sha256', JWT_SECRET).update(`${entete}.${chargeSignee}`).digest()
  );

  const a = Buffer.from(signature);
  const b = Buffer.from(attendue);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let charge;
  try {
    charge = JSON.parse(fromBase64url(chargeSignee));
  } catch {
    return null;
  }

  if (charge.exp && Math.floor(Date.now() / 1000) >= charge.exp) return null;

  return charge;
};

module.exports = { hacherMotDePasse, verifierMotDePasse, signer, verifier, dureeEnMs };
