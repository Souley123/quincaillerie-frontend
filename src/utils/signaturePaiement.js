/**
 * Signature des liens de paiement
 *
 * But : empecher la modification du montant / de la reference dans l'URL
 * du lien de paiement partage au client (QR code, SMS, WhatsApp).
 *
 * IMPORTANT : ce hachage est une protection de cohérence cote client, pas une
 * garantie de securite. N'importe qui peut lire le code source et rejouer
 * l'algorithme. La verification de paiement REAL doit rester cote serveur
 * (webhook de l'operateur / API Kkiapay) avant de debiter le stock.
 */

const SECRET_LIEN = 'skys-erp-lien-paiement-v1';

/* FNV-1a 32 bits : rapide, deterministe, suffisant contre l'edition manuelle
   d'une URL par un utilisateur non averti. */
const hacher = (texte) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    hash ^= texte.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const DUREE_LIEN_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Construit le contenu signe d'un lien de paiement.
 * @returns {{ payload: string, expire: number, signature: string }}
 */
export const signerLienPaiement = ({ operateur, reference, montant }) => {
  const expire = Date.now() + DUREE_LIEN_MS;
  const payload = `${operateur}|${reference}|${montant}|${expire}`;
  return { payload, expire, signature: hacher(`${payload}|${SECRET_LIEN}`) };
};

/**
 * Verifie un lien de paiement.
 * @returns {{ valide: boolean, raison?: string, expire?: number }}
 */
export const verifierLienPaiement = ({ operateur, reference, montant, expire, signature }) => {
  if (!operateur || !reference || !montant || !expire || !signature) {
    return { valide: false, raison: 'incomplet' };
  }

  if (!Number.isFinite(Number(montant)) || Number(montant) <= 0) {
    return { valide: false, raison: 'montant' };
  }

  if (Number(expire) < Date.now()) {
    return { valide: false, raison: 'expire' };
  }

  const attendu = hacher(`${operateur}|${reference}|${montant}|${expire}|${SECRET_LIEN}`);

  // Comparaison a temps constant : evite de fuiter la signature par le timing
  if (attendu.length !== signature.length) {
    return { valide: false, raison: 'signature' };
  }

  let diff = 0;
  for (let i = 0; i < attendu.length; i += 1) {
    diff |= attendu.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  if (diff !== 0) {
    return { valide: false, raison: 'signature' };
  }

  return { valide: true, expire: Number(expire) };
};