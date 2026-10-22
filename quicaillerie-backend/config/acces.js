/**
 * MATRICE D'ACCÈS SKYS ERP SOLUTION — SOURCE DE VÉRITÉ UNIQUE
 * ============================================================
 * Ce fichier est la seule définition des droits. Le backend (Node/Express)
 * ET le frontend (menu, écrans) s'y réfèrent : impossible qu'un module soit
 * autorisé côté interface mais refusé côté serveur, ou l'inverse.
 *
 * Il n'importe RIEN (ni mongoose, ni React) : il est copiable tel quel dans
 * quincaillerie-frontend/src/access/ (voir la copie jumelle).
 *
 * Principes :
 *   1. MOINDRE PRIVILÈGE  — un rôle ne reçoit que ce dont il a besoin.
 *   2. DEUX VERROUS      — un module est accessible si le RÔLE y a droit ET
 *                          si l'ABONNEMENT de l'entreprise le couvre.
 *   3. DÉFAUT FERMÉ      — un module inconnu ou un palier inconnu = refus.
 */

/* ============================ RÔLES ============================ */

/** Codes techniques des rôles (valeurs stockées en base). */
const ROLES = {
  ADMIN: 'Administrateur',
  GESTIONNAIRE: 'Gestionnaire',
  VENDEUR: 'Caissier',
  LIVREUR: 'Livreur'
};

/** Ancien nom du rôle « Vendeur/Caissier » conservé pour la base existante. */
const ALIAS_ROLES = {
  Magasinier: ROLES.GESTIONNAIRE,
  Caissier: ROLES.VENDEUR
};

/** Libellés affichés (interface, e-mails, documents). */
const LIBELLES_ROLES = {
  [ROLES.ADMIN]: 'Admin (Gérant / Propriétaire)',
  [ROLES.GESTIONNAIRE]: 'Gestionnaire (Chef de stock / Superviseur)',
  [ROLES.VENDEUR]: 'Vendeur / Caissier',
  [ROLES.LIVREUR]: 'Livreur / Logistique'
};

const ROLES_VALIDES = Object.values(ROLES);

/** Ramène un rôle historique vers son équivalent actuel. */
const normaliserRole = role => {
  const valeur = String(role || '').trim();
  return ALIAS_ROLES[valeur] || (ROLES_VALIDES.includes(valeur) ? valeur : null);
};

/* ======================= MODULES ============================== */

/**
 * Chaque module porte :
 *   id       identifiant du module (onglet du front)
 *   libelle  nom lisible
 *   niveau   palier MINIMUM requis
 *   roles    rôles autorisés (RBAC)
 */
const MODULES = [
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

/**
 * Rang de chaque palier. « Supervisor » / « Master » sont acceptés comme
 * synonymes d'Enterprise (appellations commerciales possibles).
 * « Transport » est une offre dédiée : elle donne le niveau Standard et
 * ouvre le module de transport, même si celui-ci appartient au niveau Pro.
 */
const PALIERS = {
  ESSAI: { code: 'Essai', libelle: 'Essai gratuit', rang: 1 },
  STANDARD: { code: 'Standard', libelle: 'Standard (Essentiel)', rang: 2 },
  PRO: { code: 'Pro', libelle: 'Pro (Avancé)', rang: 3 },
  ENTERPRISE: { code: 'Enterprise', libelle: 'Enterprise / Master', rang: 4 },
  TRANSPORT: { code: 'Transport', libelle: 'Transporteur', rang: 2 }
};

/** Niveau requis pour chaque module, exprimé en rang. */
const RANG_NIVEAU = { STANDARD: 2, PRO: 3, ENTERPRISE: 4 };

/** Paliers alternatifs acceptés pour un même niveau requis. */
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

/** Ramène n'importe quelle écriture de palier vers son code officiel. */
const normaliserPalier = palier => {
  const brut = String(palier || '').trim();
  if (!brut) return 'Essai';
  if (PALIERS[brut.toUpperCase()]) return PALIERS[brut.toUpperCase()].code;
  return ALIAS_PALIERS[brut] || 'Essai';
};

/** Rang effectif d'un palier ; 0 si inconnu (donc rien n'est ouvert). */
const rangPalier = palier => {
  const code = normaliserPalier(palier);
  const entree = Object.values(PALIERS).find(p => p.code === code);
  return entree ? entree.rang : 0;
};

/* ==================== FONCTIONS D'ACCÈS ======================= */

const moduleParId = id => MODULES.find(m => m.id === id) || null;

/**
 * Le rôle a-t-il droit à ce module ? (RBAC seul)
 * L'ADMIN a accès à tout ce qui est défini, y compris les modules ajoutés
 * plus tard, MAIS reste borné par son abonnement (voir autoriserModule).
 */
const roleAutorise = (role, moduleId) => {
  const module = moduleParId(moduleId);
  if (!module) return false;
  const roleNormalise = normaliserRole(role);
  if (!roleNormalise) return false;
  return module.roles.includes(roleNormalise);
};

/**
 * Le palier couvre-t-il ce niveau ? (abonnement seul)
 * Transporteur : Standard + le module transport uniquement.
 */
const palierCouvre = (palier, moduleId) => {
  const module = moduleParId(moduleId);
  if (!module) return false;

  const code = normaliserPalier(palier);

  if (code === 'Transport') {
    return moduleId === 'transport' || module.niveau === 'STANDARD';
  }

  return rangPalier(code) >= RANG_NIVEAU[module.niveau];
};

/**
 * Décision COMPLÈTE (rôle + abonnement). Renvoie { autorise, raison, module }
 *  - raison 'module'        : module inexistant
 *  - raison 'role'          : rôle sans droit
 *  - raison 'abonnement'    : palier insuffisant
 */
const deciderAcces = ({ role, palier, moduleId }) => {
  const module = moduleParId(moduleId);
  if (!module) return { autorise: false, raison: 'module', module: null };
  if (!roleAutorise(role, moduleId)) return { autorise: false, raison: 'role', module };
  if (!palierCouvre(palier, moduleId)) return { autorise: false, raison: 'abonnement', module };
  return { autorise: true, raison: null, module };
};

const autoriserModule = ({ role, palier, moduleId }) => deciderAcces({ role, palier, moduleId }).autorise;

/** Liste des modules réellement accessibles (menu, interfaces). */
const modulesAutorises = ({ role, palier }) =>
  MODULES.filter(m => autoriserModule({ role, palier, moduleId: m.id })).map(m => m.id);

/**
 * Accès minimal sans lequel l'application serait inutilisable : une
 * entreprise dont l'abonnement est expiré garde uniquement le tableau de
 * bord, les paramètres (pour payer) et l'aide.
 */
const MODULES_TOUJOURS_OUVERTS = ['dashboard', 'parametresGeneraux', 'abonnements', 'aide'];

/** Vrai si le module est un module « métier » (soumis à l'abonnement). */
const estModuleMetier = moduleId => MODULES.some(m => m.id === moduleId);

module.exports = {
  ROLES,
  ROLES_VALIDES,
  LIBELLES_ROLES,
  normaliserRole,
  MODULES,
  PALIERS,
  normaliserPalier,
  rangPalier,
  moduleParId,
  roleAutorise,
  palierCouvre,
  deciderAcces,
  autoriserModule,
  modulesAutorises,
  MODULES_TOUJOURS_OUVERTS,
  estModuleMetier
};
