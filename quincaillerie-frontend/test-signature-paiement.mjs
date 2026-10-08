import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* On teste la VRAIE source (quincaillerie-frontend), pas l'ancienne copie
   obsolete qui traine encore a la racine du depot. */
const racine = path.dirname(fileURLToPath(import.meta.url));
const cheminSource = path.join(
  racine,
  'quincaillerie-frontend',
  'src',
  'utils',
  'signaturePaiement.js'
);

if (!fs.existsSync(cheminSource)) {
  console.error('Source introuvable : ' + cheminSource);
  process.exit(1);
}

/* Le fichier source est un module ES (export const ...). Node le chargerait
   comme CommonJS a cause du package.json CRA ; on l'evalue donc directement
   via new Function pour rester independant du systeme de modules. */
const { signerLienPaiement, verifierLienPaiement } = (() => {
  const code = fs.readFileSync(cheminSource, 'utf8').replace(/export\s+const/g, 'const');
  const module = { exports: {} };
  const fn = new Function(
    'module',
    'exports',
    code + '\nmodule.exports={signerLienPaiement, verifierLienPaiement};'
  );
  fn(module, module.exports);
  return module.exports;
})();

const a = signerLienPaiement({ operateur: 'wave', reference: 'QR-1', montant: 25000 });
console.log('signature generee : ' + a.signature);
console.log('');

const cas = [
  ['lien intact       ', { operateur: 'wave', reference: 'QR-1', montant: 25000, expire: a.expire, signature: a.signature }, true],
  ['montant falsifie  ', { operateur: 'wave', reference: 'QR-1', montant: 1, expire: a.expire, signature: a.signature }, false],
  ['operateur falsifie', { operateur: 'mtn', reference: 'QR-1', montant: 25000, expire: a.expire, signature: a.signature }, false],
  ['reference falsifie', { operateur: 'wave', reference: 'QR-999', montant: 25000, expire: a.expire, signature: a.signature }, false],
  ['signature vide    ', { operateur: 'wave', reference: 'QR-1', montant: 25000, expire: a.expire, signature: '' }, false],
  ['lien expire       ', { operateur: 'wave', reference: 'QR-1', montant: 25000, expire: 1, signature: a.signature }, false],
  ['params vides      ', {}, false],
  ['montant negatif   ', { operateur: 'wave', reference: 'QR-1', montant: -500, expire: a.expire, signature: a.signature }, false]
];

let ok = 0;

cas.forEach(entry => {
  const nom = entry[0];
  const params = entry[1];
  const attendu = entry[2];

  const r = verifierLienPaiement(params);
  const reussi = r.valide === attendu;
  if (reussi) ok += 1;

  const verdict = r.valide ? 'ACCEPTE' : 'REJETE (' + r.raison + ')';
  console.log((reussi ? 'PASS' : 'FAIL') + ' | ' + nom + ' => ' + verdict);
});

console.log('');
console.log(ok + '/' + cas.length + ' tests reussis');