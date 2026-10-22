/**
 * MATRICE D'ACCÈS — COPIE FRONTEND DE quicaillerie-backend/config/acces.js
 * ========================================================================
 * Les deux fichiers doivent rester IDENTIQUES (un test automatisé
 * `acces.matrice.test.js` le vérifie). Toute modification se fait ici ET dans
 * le backend.
 *
 * Le frontend l'utilise pour :
 *   - construire le menu latéral (aucun module payant ou non autorisé) ;
 *   - bloquer un écran ouvert par URL / raccourci ;
 *   - afficher la cause d'un refus (rôle ou abonnement).
 */

/* ============================ RÔLES ============================ */

export const ROLES = {
  ADMIN: 'Administrateur',
  GESTIONNAIRE: 'Gestionnaire',
  VENDEUR: 'Caissier',
  LIVREUR: 'Livreur'
};

/** Ancien nom du rôle « Vendeur/Caissier » conservé pour la base existante. */
export const ALIAS_ROLES = {
  Magasinier: ROLES.GESTIONNAIRE,
  Caissier: ROLES.VENDEUR
};

export const LIBELLES_ROLES = {
  [ROLES.ADMIN]: 'Admin (Gérant / Propriétaire)',
  [ROLES.GESTIONNAIRE]: 'Gestionnaire (Chef de stock / Superviseur)',
  [ROLES.VENDEUR]: 'Vendeur / Caissier',
  [ROLES.LIVREUR]: 'Livreur / Logistique'
};

export const ROLES_VALIDES = Object.values(ROLES);

export const normaliserRole = role => {
  const valeur = String(role || '').trim();
  return ALIAS_ROLES[valeur] || (ROLES_VALIDES.includes(valeur) ? valeur : null);
};

/* ======================= MODULES ============================== */

export const MODULES = [
  // ---------- STANDARD ----------
  { id: 'dashboard', libelle: 'Tableau de bord', niveau: 'STANDARD', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE, ROLES.VENDEUR, ROLES.LIVREUR] },
  { id: 'quincaillerie', libelle: 'Gestion de stock', niveau: 'STANDARD', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE] },
  { id: 'transaction', libelle: 'Caisse & transactions', niveau: 'STANDARD', roles: [ROLES.ADMIN, ROLES.VENDEUR] },
  { id: 'gaz', libelle: 'Vente de gaz', niveau: 'STANDARD', roles: [ROLES.ADMIN, ROLES.VENDEUR] },
  { id: 'recherche', libelle: 'Recherche rapide', niveau: 'STANDARD', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE, ROLES.VENDEUR] },
  { id: 'clients', libelle: 'Clients & contacts', niveau: 'STANDARD', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE, ROLES.VENDEUR] },
  { id: 'aide', libelle: 'Aide & guide', niveau: 'STANDARD', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE, ROLES.VENDEUR, ROLES.LIVREUR] },

  // ---------- PRO ----------
  { id: 'mouvements', libelle: 'Mouvements de stock', niveau: 'PRO', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE, ROLES.LIVREUR] },
  { id: 'reappro', libelle: 'Réapprovisionnement auto', niveau: 'PRO', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE] },
  { id: 'achats', libelle: 'Achats & fournisseurs', niveau: 'PRO', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE] },
  { id: 'devis', libelle: 'Devis & proforma', niveau: 'PRO', roles: [ROLES.ADMIN, ROLES.VENDEUR] },
  { id: 'inventaire', libelle: 'Inventaire physique', niveau: 'PRO', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE] },
  { id: 'transport', libelle: 'Transport & logistique', niveau: 'PRO', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE, ROLES.LIVREUR] },
  { id: 'credits', libelle: 'Crédits & dettes', niveau: 'PRO', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE] },
  { id: 'notes', libelle: 'Cahier de notes', niveau: 'PRO', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE, ROLES.VENDEUR] },
  { id: 'multiDepots', libelle: 'Stock multi-dépôts', niveau: 'PRO', roles: [ROLES.ADMIN, ROLES.GESTIONNAIRE] },

  // ---------- ENTERPRISE / MASTER ----------
  { id: 'depenses', libelle: 'Dépenses & charges', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] },
  { id: 'dossiers', libelle: 'Justificatifs & pièces', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] },
  { id: 'paiements', libelle: 'Moyens de paiement', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] },
  { id: 'abonnements', libelle: 'Abonnements', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] },
  { id: 'comptabilite', libelle: 'Comptabilité automatique', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] },
  { id: 'reports', libelle: 'Rapports & KPI', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] },
  { id: 'securite', libelle: 'Sécurité & incidents', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] },
  { id: 'tresorerie', libelle: 'Trésorerie & épargne', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] },
  { id: 'versions', libelle: 'Versions & modules', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] },
  { id: 'parametresGeneraux', libelle: 'Paramètres généraux', niveau: 'ENTERPRISE', roles: [ROLES.ADMIN] }
];

/* ======================= PALIERS ============================== */

export const PALIERS = {
  ESSAI: { code: 'Essai', libelle: 'Essai gratuit', rang: 1 },
  STANDARD: { code: 'Standard', libelle: 'Standard (Essentiel)', rang: 2 },
  PRO: { code: 'Pro', libelle: 'Pro (Avancé)', rang: 3 },
  ENTERPRISE: { code: 'Enterprise', libelle: 'Enterprise / Master', rang: 4 },
  TRANSPORT: { code: 'Transport', libelle: 'Transporteur', rang: 2 }
};

const RANG_NIVEAU = { STANDARD: 2, PRO: 3, ENTERPRISE: 4 };

const ALIAS_PALIERS = {
  Standard: 'Standard',
  'Standard / Boutique': 'Standard',
  Pro: 'Pro',
  Professionnel: 'Pro',
  'Professionnel / ERP': 'Pro',
  Enterprise: 'Enterprise',
  Master: 'Enterprise',
  'Enterprise / Master': 'Enterprise',
  Entreprise: 'Enterprise',
  Transport: 'Transport',
  Transporteur: 'Transport',
  Essai: 'Essai'
};

export const normaliserPalier = palier => {
  const brut = String(palier || '').trim();
  if (!brut) return 'Essai';
  if (PALIERS[brut.toUpperCase()]) return PALIERS[brut.toUpperCase()].code;
  return ALIAS_PALIERS[brut] || 'Essai';
};

export const rangPalier = palier => {
  const code = normaliserPalier(palier);
  const entree = Object.values(PALIERS).find(p => p.code === code);
  return entree ? entree.rang : 0;
};

/* ==================== FONCTIONS D'ACCÈS ======================= */

export const moduleParId = id => MODULES.find(m => m.id === id) || null;

export const roleAutorise = (role, moduleId) => {
  const module = moduleParId(moduleId);
  if (!module) return false;
  const roleNormalise = normaliserRole(role);
  if (!roleNormalise) return false;
  return module.roles.includes(roleNormalise);
};

export const palierCouvre = (palier, moduleId) => {
  const module = moduleParId(moduleId);
  if (!module) return false;

  const code = normaliserPalier(palier);

  if (code === 'Transport') {
    return moduleId === 'transport' || module.niveau === 'STANDARD';
  }

  return rangPalier(code) >= RANG_NIVEAU[module.niveau];
};

export const deciderAcces = ({ role, palier, moduleId }) => {
  const module = moduleParId(moduleId);
  if (!module) return { autorise: false, raison: 'module', module: null };
  if (!roleAutorise(role, moduleId)) return { autorise: false, raison: 'role', module };
  if (!palierCouvre(palier, moduleId)) return { autorise: false, raison: 'abonnement', module };
  return { autorise: true, raison: null, module };
};

export const autoriserModule = ({ role, palier, moduleId }) =>
  deciderAcces({ role, palier, moduleId }).autorise;

export const modulesAutorises = ({ role, palier }) =>
  MODULES.filter(m => autoriserModule({ role, palier, moduleId: m.id })).map(m => m.id);

export const MODULES_TOUJOURS_OUVERTS = ['dashboard', 'parametresGeneraux', 'abonnements', 'aide'];

export const estModuleMetier = moduleId => MODULES.some(m => m.id === moduleId);
