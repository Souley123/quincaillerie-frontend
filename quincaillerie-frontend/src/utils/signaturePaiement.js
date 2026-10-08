/**
 * Liens de paiement : la SIGNATURE cryptographique et la validation du montant
 * sont faites côté serveur (un secret dans un bundle frontend est public).
 * Le frontend se contente d'un contrôle de FORME : les paramètres doivent être
 * présents et cohérents pour afficher la page. Toute confirmation réelle du
 * paiement passe obligatoirement par l'API (voir paiementController.verifierPaiement).
 */
export const DUREE_LIEN_MS = 30 * 60 * 1000;

export const signerLienPaiement = () => {
  throw new Error('La création des liens de paiement doit être faite côté serveur.');
};

const OPERATEURS_CONNUS = ['wave', 'orange', 'mtn', 'moov', 'carte'];

/**
 * Contrôle de forme d'un lien de paiement reçu par un client.
 * @returns {{valide:boolean, raison?:string, expire?:number}}
 */
export const verifierLienPaiement = (params = {}) => {
  const operateur = String(params.operateur || '').toLowerCase();
  const reference = String(params.reference || '').trim();
  const montant = Number(params.montant);
  const expire = Number(params.expire);

  if (!OPERATEURS_CONNUS.includes(operateur)) return { valide: false, raison: 'operateur-inconnu' };
  if (!reference || reference.length > 128) return { valide: false, raison: 'reference-manquante' };
  if (!Number.isFinite(montant) || montant <= 0) return { valide: false, raison: 'montant-invalide' };

  // Si une échéance est fournie, elle doit être future.
  if (Number.isFinite(expire) && expire > 0 && expire < Date.now()) {
    return { valide: false, raison: 'lien-expire' };
  }

  return { valide: true, expire: Number.isFinite(expire) && expire > 0 ? expire : Date.now() + DUREE_LIEN_MS };
};