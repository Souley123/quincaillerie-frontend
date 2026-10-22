/**
 * TUNNEL DE TRANSPORT — étapes, validation et calculs
 * ------------------------------------------------------------
 * Une livraison se déroule en 4 étapes, dans un ordre imposé :
 *
 *   1. DÉPART      — qui conduit, quel véhicule, depuis quel dépôt, quand ;
 *   2. CHARGEMENT  — quels articles, en quelles quantités (stock réel vérifié) ;
 *   3. LIVRAISON   — destination, client, frais convenus ;
 *   4. CONFIRMATION— récapitulatif contrôlé avant l'écriture en base.
 *
 * Aucune étape ne peut être sautée : `etapesValides()` est la seule façon
 * d'ouvrir la dernière étape, et elle est rejouée au moment de l'envoi. Les
 * règles métier vivent ICI (pas dans le JSX), pour rester testables et pour
 * être appliquées à l'identique par l'interface et par l'enregistrement.
 */

/* Ordre canonique des étapes du tunnel. */
export const ETAPES_TRANSPORT = [
  { cle: 'depart', numero: 1, titre: 'Départ', description: 'Véhicule, chauffeur et dépôt de chargement' },
  { cle: 'chargement', numero: 2, titre: 'Chargement', description: 'Articles et quantités réellement embarqués' },
  { cle: 'livraison', numero: 3, titre: 'Livraison', description: 'Client, destination et frais convenus' },
  { cle: 'confirmation', numero: 4, titre: 'Confirmation', description: 'Contrôle final et enregistrement' }
];

/* Types de véhicules proposés au départ (liste libre en plus). */
export const TYPES_VEHICULES = [
  'Camion 10T',
  'Camion 3,5T',
  'Camion 20T',
  'Pick-up',
  'Fourgon',
  'Semi-remorque',
  'Tricycle',
  'Moto',
  'Voiture'
];

/* Valeur du champ « Dépôt de chargement » quand le camion ne part d'aucun
   dépôt interne (carrière, chantier, fournisseur externe). Elle est TREMPÉE
   par la validation : c'est un choix légitime, pas un champ oublié. */
export const AUCUN_DEPOT = 'Aucun';

/* Ligne de chargement vide. `ref` désigne l'article, `quantite` le nombre
   d'unités montées à bord. Le prix est FIXÉ au départ (prix catalogue) pour
   que le récapitulatif reste stable même si le catalogue change ensuite. */
export const LIGNE_CHARGEMENT_VIDE = { ref: '', nom: '', quantite: '', prixUnitaire: 0 };

/* Formulaire initial du tunnel. */
export const FORMULAIRE_TRANSPORT_INITIAL = {
  /* Étape 1 — départ */
  date: new Date().toISOString().split('T')[0],
  nomResponsable: '',
  prenomsResponsable: '',
  vehicule: '',
  immatriculation: '',
  depotSource: AUCUN_DEPOT,
  /* Étape 2 — chargement */
  lignes: [],
  nombreVoyage: 1,
  /* Étape 3 — livraison */
  client: '',
  destination: '',
  frais: '',
  commentaires: ''
};

const nombrePositif = valeur => {
  const nombre = Number(valeur);
  return Number.isFinite(nombre) && nombre > 0 ? nombre : 0;
};

const nombreEntierPositif = valeur => {
  const nombre = Number(valeur);
  return Number.isInteger(nombre) && nombre > 0 ? nombre : 0;
};

/**
 * Quantité disponible d'un article dans un dépôt.
 * `stockParDepot` peut être absent (mode serveur) : on retombe alors sur
 * `quantiteStock`, la seule vérité disponible côté client.
 */
export const stockDisponible = (produit, depot, stockParDepot) => {
  if (!produit) return 0;
  /* Chargement hors dépôt : aucune répartition multi-dépôts à interroger,
     on lit le stock global de l'article. */
  if (!depot || depot === AUCUN_DEPOT) return Number(produit.quantiteStock) || 0;
  const parDepot = stockParDepot?.[produit.ref]?.[depot];
  if (parDepot === undefined || parDepot === null) return Number(produit.quantiteStock) || 0;
  return Number(parDepot) || 0;
};

/** Lignes de chargement réellement renseignées (article + quantité > 0). */
export const lignesUtiles = lignes =>
  (Array.isArray(lignes) ? lignes : []).filter(ligne => ligne?.ref && nombreEntierPositif(ligne.quantite) > 0);

/** Somme des quantités chargées (unités, tous articles confondus). */
export const totalUnitesChargees = lignes =>
  lignesUtiles(lignes).reduce((total, ligne) => total + nombreEntierPositif(ligne.quantite), 0);

/** Valeur marchande du chargement (prix catalogue × quantités). */
export const valeurChargement = lignes =>
  lignesUtiles(lignes).reduce(
    (total, ligne) => total + nombreEntierPositif(ligne.quantite) * (Number(ligne.prixUnitaire) || 0),
    0
  );

/**
 * Bilan du chargement : pour chaque ligne, la quantité demandée comparée au
 * stock disponible. Renvoie les dépassements pour bloquer l'étape 3 tant
 * qu'un article est embarqué au-delà du stock réel.
 */
export const controlerChargement = (lignes, produits, depot, stockParDepot) => {
  const catalogue = new Map((produits || []).map(p => [p.ref, p]));
  const regroupe = new Map();

  lignesUtiles(lignes).forEach(ligne => {
    regroupe.set(ligne.ref, (regroupe.get(ligne.ref) || 0) + nombreEntierPositif(ligne.quantite));
  });

  return [...regroupe.entries()].map(([ref, quantite]) => {
    const produit = catalogue.get(ref);
    const disponible = stockDisponible(produit, depot, stockParDepot);
    return {
      ref,
      nom: produit?.nom || ref,
      quantite,
      disponible,
      /* Une référence absente du catalogue ne peut pas être chargée : on
         n'a alors ni prix, ni stock à décrémenter. */
      introuvable: !produit,
      depassement: Boolean(produit) && quantite > disponible
    };
  });
};

/**
 * État de chaque étape : `true` = validée, l'utilisateur peut passer à la
 * suivante ; `false` = champs manquants ou incohérents.
 *
 * `contexte` : { produits, stockParDepot, depots }
 */
export const etapesValides = (form, contexte = {}) => {
  const { produits = [], stockParDepot = {}, depots = [] } = contexte;
  const f = form || {};

  /* Étape 1 — départ : chauffeur identifié (nom + prénoms), véhicule et
     immatriculation. Le dépôt de chargement est FACULTATIF :

       · vide ou « Aucun » → départ hors dépôt (carrière, chantier,
         fournisseur externe) : l'étape reste VALIDE ;
       · un nom de dépôt → il doit exister dans la liste connue.

     Bloquer sur ce champ empêchait les tournées de sable / gravier de
     démarrer, alors que le stock y est puisé hors entrepôt. */
  const depotSaisi = String(f.depotSource || '').trim();
  const depotValide = depotSaisi === '' ||
    depotSaisi === AUCUN_DEPOT ||
    depots.length === 0 ||
    depots.includes(depotSaisi);

  const depart = Boolean(
    String(f.date || '').trim() &&
    String(f.nomResponsable || '').trim() &&
    String(f.prenomsResponsable || '').trim() &&
    String(f.vehicule || '').trim() &&
    String(f.immatriculation || '').trim() &&
    depotValide
  );

  /* Étape 2 — chargement : au moins un article, quantités entières > 0,
     stock suffisant pour CHAQUE référence (y compris lignes en doublon). */
  const bilan = controlerChargement(f.lignes, produits, f.depotSource, stockParDepot);
  const chargement = Boolean(
    depart &&
    bilan.length > 0 &&
    !bilan.some(ligne => ligne.introuvable || ligne.depassement) &&
    nombreEntierPositif(f.nombreVoyage) > 0
  );

  /* Étape 3 — livraison : client, destination et frais numériques ≥ 0. */
  const frais = Number(f.frais);
  const livraison = Boolean(
    chargement &&
    String(f.client || '').trim() &&
    String(f.destination || '').trim() &&
    String(f.frais ?? '').trim() !== '' &&
    Number.isFinite(frais) && frais >= 0
  );

  return { depart, chargement, livraison, confirmation: livraison, bilan };
};

/**
 * Construit l'état du formulaire tel qu'il doit être envoyé au serveur.
 * Les lignes sont agrégées par référence : deux lignes du même article
 * comptent pour leur TOTAL (sinon seule la dernière était comptée).
 */
export const normaliserPourEnvoi = form => {
  const f = form || {};
  const regroupe = new Map();

  lignesUtiles(f.lignes).forEach(ligne => {
    const entree = regroupe.get(ligne.ref) || {
      ref: ligne.ref,
      nom: ligne.nom || '',
      quantite: 0,
      prixUnitaire: Number(ligne.prixUnitaire) || 0
    };
    entree.quantite += nombreEntierPositif(ligne.quantite);
    regroupe.set(ligne.ref, entree);
  });

  const lignes = [...regroupe.values()];

  return {
    date: f.date,
    nomResponsable: String(f.nomResponsable || '').trim(),
    prenomsResponsable: String(f.prenomsResponsable || '').trim(),
    vehicule: String(f.vehicule || '').trim(),
    immatriculation: String(f.immatriculation || '').trim().toUpperCase(),
    depotSource: String(f.depotSource || '').trim(),
    nombreVoyage: nombreEntierPositif(f.nombreVoyage) || 1,
    client: String(f.client || '').trim(),
    destination: String(f.destination || '').trim(),
    frais: nombrePositif(f.frais) || 0,
    commentaires: String(f.commentaires || '').trim(),
    lignes,
    /* Ce que l'expédition a embarqué, pour les récapitulatifs et la fiche
       véhicule (valeurs figées au moment du départ). */
    unitesChargees: lignes.reduce((total, ligne) => total + ligne.quantite, 0),
    valeurMarchandise: lignes.reduce((total, ligne) => total + ligne.quantite * ligne.prixUnitaire, 0)
  };
};
