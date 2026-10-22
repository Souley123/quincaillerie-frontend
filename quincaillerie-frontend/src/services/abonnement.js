/* =========================================================
   ABONNEMENT — Référentiel unique des paliers et de l'essai
   ------------------------------------------------------------
   Centralise :
   - les paliers commerciaux et leurs avantages (source UNIQUE) ;
   - la durée d'essai et le calcul des jours restants ;
   - les messages d'incitation au paiement.

   Objectif : que l'écran de blocage, les relances et le module
   Abonnements s'appuient tous sur la MÊME source, pour rester
   cohérents. Aucun de ces chiffres n'est une décision d'accès :
   l'autorité finale reste le SERVEUR (HTTP 402).
   ========================================================= */

/* Durée du nouvel essai gratuit, alignée sur la règle serveur. */
export const DUREE_ESSAI_JOURS = 5;

/* Seuil (en jours restants) à partir duquel on relance le client. */
export const SEUIL_RELANCE_JOURS = 1;

/* Palette et textes des paliers, avec leurs AVANTAGES mis en avant
   pour inciter au paiement (chaque palier répond à un besoin concret). */
export const PALIERS = [
  {
    code: 'Standard',
    libelle: 'Standard / Boutique',
    prix: 10000,
    prixTexte: '10 000 FCFA / mois',
    comptes: 3,
    comptesTexte: 'Jusqu’à 3 comptes',
    couleur: '#0284c7',
    avantages: [
      'Catalogue illimité (articles, familles, sous-catégories)',
      'Caisse, ventes et encaissements',
      'Clients, devis et suivi des crédits',
      'Alertes de stock et réapprovisionnement'
    ]
  },
  {
    code: 'Pro',
    libelle: 'Professionnel / ERP',
    prix: 25000,
    prixTexte: '25 000 FCFA / mois',
    comptes: 10,
    comptesTexte: 'Jusqu’à 10 comptes',
    couleur: '#7c3aed',
    recommande: true,
    avantages: [
      'Tout le palier Standard',
      'Comptabilité automatique',
      'Rapports & indicateurs KPI',
      'Stock multi-dépôts',
      'Sécurité & incidents'
    ]
  },
  {
    code: 'Enterprise',
    libelle: 'Enterprise / Master',
    prix: 45000,
    prixTexte: '45 000 FCFA / mois',
    comptes: Infinity,
    comptesTexte: 'Comptes illimités',
    couleur: '#db2777',
    avantages: [
      'Tout le palier Professionnel',
      'Trésorerie & épargne',
      'Surveillance caméra (anti-vol)',
      'Support prioritaire'
    ]
  },
  {
    code: 'Transport',
    libelle: 'Transporteur',
    prix: 5000,
    prixTexte: '5 000 FCFA / mois',
    comptes: 3,
    comptesTexte: 'Jusqu’à 3 comptes',
    couleur: '#0d9488',
    avantages: [
      'Gestion des expéditions et livraisons',
      'Suivi de la flotte et des véhicules',
      'Frais de transport et destinations',
      'Idéal pour les transporteurs indépendants'
    ]
  }
];

/* Échéance d'essai calculée à partir de la date de création renvoyée par le backend. */
export const echeanceEssaiDepuisEntreprise = entreprise => {
  if (!entreprise) return null;
  const statut = String(entreprise.abonnementActuel || '').toLowerCase();
  const palier = String(entreprise.palier || '').toLowerCase();
  if (statut === 'expire' || (!statut && palier === 'expire')) return 0;
  const essai = statut === 'essai' || (!statut && palier === 'essai');
  const dateCreation = entreprise.dateCreation || entreprise.createdAt;
  const echeanceHistorique = !statut && essai ? entreprise.abonnementEcheance : null;
  const source = echeanceHistorique || (essai ? dateCreation : entreprise.abonnementEcheance);
  if (!source) return null;
  const echeance = new Date(source).getTime()
    + (essai && !echeanceHistorique ? DUREE_ESSAI_JOURS * 24 * 60 * 60 * 1000 : 0);
  return Number.isFinite(echeance) ? echeance : null;
};

/* Libellé court lisible pour un code de palier. */
export const libellePalier = code =>
  PALIERS.find(p => p.code === code)?.libelle || 'Essai gratuit';

/* Jours restants (>= 0) avant une échéance donnée. */
export const joursRestants = echeance => {
  if (!echeance) return 0;
  const ms = new Date(echeance).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

/* L'abonnement/essai est-il expiré pour une échéance donnée ? */
export const estExpire = echeance =>
  Boolean(echeance) && new Date(echeance).getTime() < Date.now();

/* Faut-il afficher une relance de paiement ? Renvoie un objet
   { afficher, jours, message } pour piloter le bandeau d'alerte. */
export const relancePaiement = (echeance, estDejaAbonne) => {
  if (estDejaAbonne) return { afficher: false, jours: 0, message: '' };
  const jours = joursRestants(echeance);
  if (jours > SEUIL_RELANCE_JOURS) return { afficher: false, jours, message: '' };
  const message = jours <= 0
    ? 'Votre période d’essai est terminée. Activez un abonnement pour continuer.'
    : `Votre période d’essai se termine dans ${jours} jour${jours > 1 ? 's' : ''}. Activez un abonnement pour ne pas perdre l’accès.`;
  return { afficher: true, jours, message };
};

/* Construit le lien WhatsApp de contact commercial (pré-rempli). */
export const lienContactCommercial = (numero, raisonSociale = '') => {
  const texte = encodeURIComponent(
    `Bonjour, je souhaite activer mon abonnement SKYS ERP Solution${raisonSociale ? ` pour ${raisonSociale}` : ''}.`
  );
  const propre = String(numero || '').replace(/[^0-9]/g, '');
  return propre ? `https://wa.me/${propre}?text=${texte}` : `https://wa.me/?text=${texte}`;
};
