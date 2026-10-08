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
const ITERATIONS_PBKDF2 = 310000;
const MIN_LONGUEUR_MDP = 12;
const MAX_LONGUEUR_MDP = 256;

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

/** Hash versionné : les anciens hash sel:empreinte restent vérifiables et migrent au login. */
const hacherMotDePasse = (motDePasse, sel = crypto.randomBytes(16).toString('hex')) => {
  const clair = String(motDePasse);
  if (clair.length < MIN_LONGUEUR_MDP || clair.length > MAX_LONGUEUR_MDP) {
    throw new Error(`Le mot de passe doit contenir entre ${MIN_LONGUEUR_MDP} et ${MAX_LONGUEUR_MDP} caractères.`);
  }
  const empreinte = crypto.pbkdf2Sync(clair, sel, ITERATIONS_PBKDF2, 64, 'sha512').toString('hex');
  return `pbkdf2$${ITERATIONS_PBKDF2}$${sel}$${empreinte}`;
};

const besoinRehachage = hash => !String(hash || '').startsWith(`pbkdf2$${ITERATIONS_PBKDF2}$`);

const derive = (secret, sel, iterations) => crypto.pbkdf2Sync(secret, sel, iterations, 64, 'sha512').toString('hex');
const compareHex = (a, b) => {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  return bufferA.length === bufferB.length && bufferA.length > 0 && crypto.timingSafeEqual(bufferA, bufferB);
};

const verifierFactice = () => `pbkdf2$${ITERATIONS_PBKDF2}$${'0'.repeat(32)}$${'0'.repeat(128)}`;

/** Vérifie un mot de passe face à une empreinte stockée. */
const verifierMotDePasse = (motDePasse, stocke) => {
  if (typeof motDePasse !== 'string' || motDePasse.length > MAX_LONGUEUR_MDP || typeof stocke !== 'string') return false;
  let sel; let empreinte; let iterations;
  const parties = stocke.split('$');
  if (parties.length === 4 && parties[0] === 'pbkdf2') {
    iterations = Number(parties[1]);
    [, , sel, empreinte] = parties;
    if (iterations !== ITERATIONS_PBKDF2) return false;
  } else {
    const ancien = stocke.split(':');
    if (ancien.length !== 2) return false;
    [sel, empreinte] = ancien;
    iterations = 120000; // ancien format de hash, rehash au prochain login réussi
  }
  if (!/^[a-f0-9]{32}$/.test(sel) || !/^[a-f0-9]{128}$/i.test(empreinte)) return false;
  return compareHex(derive(motDePasse, sel, iterations), empreinte);
};

/* ------------------------------------------------------------------
 * Jeton signé (JWT HS256)
 * ---------------------------------------------------------------- */

/** Convertit '12h' / '30d' / '3600' en millisecondes. */
const dureeEnMs = valeur => {
  const correspondances = { m: 60e3, h: 3600e3, j: 86400e3, d: 86400e3 };
  const texte = String(valeur).trim();
  const unite = texte.slice(-1).toLowerCase();
  const nombre = Number(texte.slice(0, -1));
  const duree = correspondances[unite] && Number.isFinite(nombre)
    ? nombre * correspondances[unite]
    : /^\d+$/.test(texte) ? Number(texte) * 1000 : NaN;
  if (!Number.isSafeInteger(duree) || duree < 60e3 || duree > 365 * 86400e3) {
    throw new Error('JWT_DUREE doit être comprise entre 1 minute et 365 jours.');
  }
  return duree;
};

// Valide la durée dès le chargement, pour éviter d'émettre des sessions non expirantes.
dureeEnMs(DUREE_JETON);

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
  if (!/^[A-Za-z0-9_-]+$/.test(entete) || !/^[A-Za-z0-9_-]+$/.test(chargeSignee) ||
      !/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;

  // Signature attendue recalculée à partir du secret serveur.
  const attendue = base64url(
    crypto.createHmac('sha256', JWT_SECRET).update(`${entete}.${chargeSignee}`).digest()
  );

  const a = Buffer.from(signature);
  const b = Buffer.from(attendue);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let enteteDecodage;
  let charge;
  try {
    enteteDecodage = JSON.parse(fromBase64url(entete));
    charge = JSON.parse(fromBase64url(chargeSignee));
  } catch {
    return null;
  }
  if (enteteDecodage?.alg !== 'HS256' || enteteDecodage?.typ !== 'JWT') return null;
  if (charge.exp && Math.floor(Date.now() / 1000) >= charge.exp) return null;

  if (!charge || typeof charge !== 'object' || typeof charge.companyId !== 'string' ||
      typeof charge.email !== 'string' || typeof charge.id !== 'string' ||
      !Number.isInteger(charge.exp) || charge.exp <= 0 ||
      (charge.forcePasswordChange !== undefined && typeof charge.forcePasswordChange !== 'boolean')) return null;

  return charge;
};

module.exports = { hacherMotDePasse, verifierMotDePasse, besoinRehachage, verifierFactice, signer, verifier, dureeEnMs };
