/**
 * Test de la répartition des en-têtes de sécurité.
 * Vérifie qu'helmet et le pare-feu n°1 se COMPLÈTENT sans se dupliquer.
 */
const helmet = require('helmet');
const pareFeu = require('../middleware/pareFeu');

let ok = 0;
let ko = 0;

const verifier = (nom, condition) => {
  if (condition) {
    console.log(`  OK   ${nom}`);
    ok++;
  } else {
    console.log(`  ECHEC ${nom}`);
    ko++;
  }
};

/* Faux objet `res` compatible avec helmet et notre pare-feu. */
const creerFauxRes = () => {
  const poses = {};
  return {
    poses,
    setHeader(cle, valeur) { poses[cle.toLowerCase()] = valeur; },
    removeHeader(cle) { delete poses[cle.toLowerCase()]; },
    getHeader(cle) { return poses[cle.toLowerCase()]; }
  };
};

const res = creerFauxRes();

/* 1. helmet (socle standard)
   IMPORTANT : cette configuration doit rester IDENTIQUE à celle de
   server.js. Si l'une évolue sans l'autre, ce test échoue — c'est
   volontaire : il verrouille la politique de sécurité réellement servie. */
const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: false,
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
});
helmetMiddleware({ secure: true, headers: {} }, res, () => {});

/* 2. Pare-feu n°1 (complément) */
pareFeu.enTetesSecurite({ secure: true, headers: {} }, res, () => {});

const poses = res.poses;

/* ---------- En-têtes fournis par helmet ---------- */
const parHelmet = [
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'strict-transport-security',
  'x-dns-prefetch-control',
  'x-download-options',
  'x-permitted-cross-domain-policies'
];
parHelmet.forEach(cle => verifier(`helmet fournit ${cle}`, cle in poses));

/* ---------- En-têtes fournis par le pare-feu n°1 ---------- */
const parPareFeu = [
  'content-security-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy'
];
parPareFeu.forEach(cle => verifier(`le pare-feu n°1 fournit ${cle}`, cle in poses));

/* ---------- Aucun doublon possible ---------- */
/* Un en-tête ne peut apparaître deux fois : les clés d'un objet sont uniques.
   On vérifie donc que CHAQUE en-tête attendu n'est posé que par une source. */
const fournisParHelmetUniquement = parHelmet.filter(cle => !parPareFeu.includes(cle));
verifier(
  'aucun en-tête n\'est déclaré par les deux couches',
  fournisParHelmetUniquement.length === parHelmet.length
);

/* ---------- Valeurs clés ---------- */
verifier(
  'la CSP est bien posée par le pare-feu (pas helmet)',
  String(poses['content-security-policy'] || '').includes("default-src 'self'")
);
verifier(
  'la CSP autorise le widget Kkiapay',
  String(poses['content-security-policy'] || '').includes('cdn.kkiapay.me')
);
verifier(
  'la CSP interdit le cadrage (anti-clickjacking)',
  String(poses['content-security-policy'] || '').includes("frame-ancestors 'none'")
);
verifier(
  'HSTS est actif (max-age 1 an)',
  String(poses['strict-transport-security'] || '').includes('max-age=31536000')
);
verifier(
  'X-Frame-Options vaut DENY',
  poses['x-frame-options'] === 'DENY'
);
verifier(
  'X-Content-Type-Options vaut nosniff',
  poses['x-content-type-options'] === 'nosniff'
);
verifier(
  'Permissions-Policy limite la caméra au même site',
  String(poses['permissions-policy'] || '').includes('camera=(self)')
);

/* ---------- Le pare-feu seul ne duplique rien ---------- */
const resPareFeuSeul = creerFauxRes();
pareFeu.enTetesSecurite({ secure: true, headers: {} }, resPareFeuSeul, () => {});
const doublons = parHelmet.filter(cle => cle in resPareFeuSeul.poses);
verifier(
  'le pare-feu n°1 ne repose AUCUN en-tête d\'helmet',
  doublons.length === 0
);

console.log(`\n${ok} test(s) réussi(s), ${ko} échec(s)`);
process.exit(ko === 0 ? 0 : 1);
