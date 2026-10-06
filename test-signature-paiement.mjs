import { signerLienPaiement, verifierLienPaiement } from './src/utils/signaturePaiement.js';

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