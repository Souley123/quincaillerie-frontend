/**
 * ============================================================
 *  SKYS ERP Solution — RÉFÉRENTIEL DES PAYS AFRICAINS
 *  Organisé par région (Union africaine) :
 *    Afrique du Nord, Afrique de l'Ouest, Afrique Centrale,
 *    Afrique de l'Est, Afrique Australe.
 *  Chaque pays : code ISO 3166-1 alpha-2, nom, capitale,
 *  monnaie et région. Utilisé pour la géographie (dépôts,
 *  clients, livraisons, localisation GPS).
 * ============================================================
 */

export const REGIONS_AFRIQUE = [
  'Afrique du Nord',
  'Afrique de l\'Ouest',
  'Afrique Centrale',
  'Afrique de l\'Est',
  'Afrique Australe'
];

export const PAYS_AFRIQUE = [
  /* ---------- Afrique du Nord ---------- */
  { code: 'DZ', nom: 'Algérie', capitale: 'Alger', monnaie: 'DZD', region: 'Afrique du Nord' },
  { code: 'EG', nom: 'Égypte', capitale: 'Le Caire', monnaie: 'EGP', region: 'Afrique du Nord' },
  { code: 'LY', nom: 'Libye', capitale: 'Tripoli', monnaie: 'LYD', region: 'Afrique du Nord' },
  { code: 'MA', nom: 'Maroc', capitale: 'Rabat', monnaie: 'MAD', region: 'Afrique du Nord' },
  { code: 'SD', nom: 'Soudan', capitale: 'Khartoum', monnaie: 'SDG', region: 'Afrique du Nord' },
  { code: 'TN', nom: 'Tunisie', capitale: 'Tunis', monnaie: 'TND', region: 'Afrique du Nord' },

  /* ---------- Afrique de l'Ouest ---------- */
  { code: 'BJ', nom: 'Bénin', capitale: 'Porto-Novo', monnaie: 'XOF', region: 'Afrique de l\'Ouest' },
  { code: 'BF', nom: 'Burkina Faso', capitale: 'Ouagadougou', monnaie: 'XOF', region: 'Afrique de l\'Ouest' },
  { code: 'CV', nom: 'Cap-Vert', capitale: 'Praia', monnaie: 'CVE', region: 'Afrique de l\'Ouest' },
  { code: 'CI', nom: 'Côte d\'Ivoire', capitale: 'Yamoussoukro', monnaie: 'XOF', region: 'Afrique de l\'Ouest' },
  { code: 'GM', nom: 'Gambie', capitale: 'Banjul', monnaie: 'GMD', region: 'Afrique de l\'Ouest' },
  { code: 'GH', nom: 'Ghana', capitale: 'Accra', monnaie: 'GHS', region: 'Afrique de l\'Ouest' },
  { code: 'GN', nom: 'Guinée', capitale: 'Conakry', monnaie: 'GNF', region: 'Afrique de l\'Ouest' },
  { code: 'GW', nom: 'Guinée-Bissau', capitale: 'Bissau', monnaie: 'XOF', region: 'Afrique de l\'Ouest' },
  { code: 'LR', nom: 'Liberia', capitale: 'Monrovia', monnaie: 'LRD', region: 'Afrique de l\'Ouest' },
  { code: 'ML', nom: 'Mali', capitale: 'Bamako', monnaie: 'XOF', region: 'Afrique de l\'Ouest' },
  { code: 'MR', nom: 'Mauritanie', capitale: 'Nouakchott', monnaie: 'MRU', region: 'Afrique de l\'Ouest' },
  { code: 'NE', nom: 'Niger', capitale: 'Niamey', monnaie: 'XOF', region: 'Afrique de l\'Ouest' },
  { code: 'NG', nom: 'Nigeria', capitale: 'Abuja', monnaie: 'NGN', region: 'Afrique de l\'Ouest' },
  { code: 'SN', nom: 'Sénégal', capitale: 'Dakar', monnaie: 'XOF', region: 'Afrique de l\'Ouest' },
  { code: 'SL', nom: 'Sierra Leone', capitale: 'Freetown', monnaie: 'SLE', region: 'Afrique de l\'Ouest' },
  { code: 'TG', nom: 'Togo', capitale: 'Lomé', monnaie: 'XOF', region: 'Afrique de l\'Ouest' },

  /* ---------- Afrique Centrale ---------- */
  { code: 'AO', nom: 'Angola', capitale: 'Luanda', monnaie: 'AOA', region: 'Afrique Centrale' },
  { code: 'CM', nom: 'Cameroun', capitale: 'Yaoundé', monnaie: 'XAF', region: 'Afrique Centrale' },
  { code: 'CF', nom: 'République centrafricaine', capitale: 'Bangui', monnaie: 'XAF', region: 'Afrique Centrale' },
  { code: 'TD', nom: 'Tchad', capitale: 'N\'Djamena', monnaie: 'XAF', region: 'Afrique Centrale' },
  { code: 'CG', nom: 'Congo-Brazzaville', capitale: 'Brazzaville', monnaie: 'XAF', region: 'Afrique Centrale' },
  { code: 'CD', nom: 'Congo (RDC)', capitale: 'Kinshasa', monnaie: 'CDF', region: 'Afrique Centrale' },
  { code: 'GQ', nom: 'Guinée équatoriale', capitale: 'Malabo', monnaie: 'XAF', region: 'Afrique Centrale' },
  { code: 'GA', nom: 'Gabon', capitale: 'Libreville', monnaie: 'XAF', region: 'Afrique Centrale' },
  { code: 'ST', nom: 'Sao Tomé-et-Principe', capitale: 'São Tomé', monnaie: 'STN', region: 'Afrique Centrale' },

  /* ---------- Afrique de l'Est ---------- */
  { code: 'BI', nom: 'Burundi', capitale: 'Gitega', monnaie: 'BIF', region: 'Afrique de l\'Est' },
  { code: 'KM', nom: 'Comores', capitale: 'Moroni', monnaie: 'KMF', region: 'Afrique de l\'Est' },
  { code: 'DJ', nom: 'Djibouti', capitale: 'Djibouti', monnaie: 'DJF', region: 'Afrique de l\'Est' },
  { code: 'ER', nom: 'Érythrée', capitale: 'Asmara', monnaie: 'ERN', region: 'Afrique de l\'Est' },
  { code: 'ET', nom: 'Éthiopie', capitale: 'Addis-Abeba', monnaie: 'ETB', region: 'Afrique de l\'Est' },
  { code: 'KE', nom: 'Kenya', capitale: 'Nairobi', monnaie: 'KES', region: 'Afrique de l\'Est' },
  { code: 'MG', nom: 'Madagascar', capitale: 'Antananarivo', monnaie: 'MGA', region: 'Afrique de l\'Est' },
  { code: 'MW', nom: 'Malawi', capitale: 'Lilongwe', monnaie: 'MWK', region: 'Afrique de l\'Est' },
  { code: 'MU', nom: 'Maurice', capitale: 'Port-Louis', monnaie: 'MUR', region: 'Afrique de l\'Est' },
  { code: 'MZ', nom: 'Mozambique', capitale: 'Maputo', monnaie: 'MZN', region: 'Afrique de l\'Est' },
  { code: 'RW', nom: 'Rwanda', capitale: 'Kigali', monnaie: 'RWF', region: 'Afrique de l\'Est' },
  { code: 'SC', nom: 'Seychelles', capitale: 'Victoria', monnaie: 'SCR', region: 'Afrique de l\'Est' },
  { code: 'SO', nom: 'Somalie', capitale: 'Mogadiscio', monnaie: 'SOS', region: 'Afrique de l\'Est' },
  { code: 'SS', nom: 'Soudan du Sud', capitale: 'Djouba', monnaie: 'SSP', region: 'Afrique de l\'Est' },
  { code: 'TZ', nom: 'Tanzanie', capitale: 'Dodoma', monnaie: 'TZS', region: 'Afrique de l\'Est' },
  { code: 'UG', nom: 'Ouganda', capitale: 'Kampala', monnaie: 'UGX', region: 'Afrique de l\'Est' },
  { code: 'ZM', nom: 'Zambie', capitale: 'Lusaka', monnaie: 'ZMW', region: 'Afrique de l\'Est' },
  { code: 'ZW', nom: 'Zimbabwe', capitale: 'Harare', monnaie: 'ZWL', region: 'Afrique de l\'Est' },

  /* ---------- Afrique Australe ---------- */
  { code: 'BW', nom: 'Botswana', capitale: 'Gaborone', monnaie: 'BWP', region: 'Afrique Australe' },
  { code: 'SZ', nom: 'Eswatini', capitale: 'Mbabane', monnaie: 'SZL', region: 'Afrique Australe' },
  { code: 'LS', nom: 'Lesotho', capitale: 'Maseru', monnaie: 'LSL', region: 'Afrique Australe' },
  { code: 'NA', nom: 'Namibie', capitale: 'Windhoek', monnaie: 'NAD', region: 'Afrique Australe' },
  { code: 'ZA', nom: 'Afrique du Sud', capitale: 'Pretoria', monnaie: 'ZAR', region: 'Afrique Australe' }
];

/** Regroupe les pays par région, dans l'ordre officiel des régions. */
export const PAYS_AFRIQUE_PAR_REGION = REGIONS_AFRIQUE.map(region => ({
  region,
  pays: PAYS_AFRIQUE.filter(pays => pays.region === region)
}));

/** Recherche un pays par son nom (insensible à la casse et aux accents). */
export const trouverPaysAfrique = nom => {
  if (!nom) return null;
  const normaliser = valeur => valeur.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const cible = normaliser(nom);
  return PAYS_AFRIQUE.find(pays => normaliser(pays.nom) === cible) || null;
};

export default { REGIONS_AFRIQUE, PAYS_AFRIQUE, PAYS_AFRIQUE_PAR_REGION, trouverPaysAfrique };
