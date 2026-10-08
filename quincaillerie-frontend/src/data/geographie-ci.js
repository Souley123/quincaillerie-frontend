/**
 * ============================================================
 *  SKYS ERP Solution — RÉFÉRENTIEL GÉOGRAPHIQUE DE LA CÔTE D'IVOIRE
 *  District / Région → Préfecture → Sous-préfecture (département)
 *  Utilisé pour : dépôts, livraisons, clients, multi-sites.
 * ============================================================
 */

// 14 districts administratifs (2 autonomes + 12 régions)
export const DISTRICTS_CI = [
  {
    id: 'district-autonome-abidjan',
    nom: 'District Autonome d\'Abidjan',
    chefLieu: 'Abidjan',
    regions: [
      {
        nom: 'District Autonome d\'Abidjan',
        prefectures: [
          {
            nom: 'Département d\'Abidjan',
            chefLieu: 'Abidjan',
            sousPrefectures: [
              { nom: 'Abidjan-Plateau', chefLieu: 'Abidjan' },
              { nom: 'Treichville', chefLieu: 'Treichville' },
              { nom: 'Marcory', chefLieu: 'Marcory' },
              { nom: 'Cocody', chefLieu: 'Cocody' },
              { nom: 'Plateau', chefLieu: 'Plateau' },
              { nom: 'Yopougon', chefLieu: 'Yopougon' },
              { nom: 'Koumassi', chefLieu: 'Koumassi' },
              { nom: 'Port-Bouët', chefLieu: 'Port-Bouët' },
              { nom: 'Adjamé', chefLieu: 'Adjamé' }
            ]
          }
        ],
        communes: ['Abidjan', 'Anyama', 'Bingerville', 'Songon', 'Attécoubé', 'Port-Bouët']
      }
    ]
  },
  {
    id: 'district-autonome-yamoussoukro',
    nom: 'District Autonome de Yamoussoukro',
    chefLieu: 'Yamoussoukro',
    regions: [
      {
        nom: 'District Autonome de Yamoussoukro',
        prefectures: [
          {
            nom: 'Département de Yamoussoukro',
            chefLieu: 'Yamoussoukro',
            sousPrefectures: [
              { nom: 'Yamoussoukro', chefLieu: 'Yamoussoukro' }
            ]
          }
        ],
        communes: ['Yamoussoukro']
      }
    ]
  },
  {
    id: 'lacs',
    nom: 'Région des Lacs',
    chefLieu: 'Dimbokro',
    regions: [
      {
        nom: 'Lacs',
        prefectures: [
          { nom: 'N\'Zi', chefLieu: 'Dimbokro', sousPrefectures: [{ nom: 'Dimbokro', chefLieu: 'Dimbokro' }, { nom: 'M\'Bahiakro', chefLieu: 'M\'Bahiakro' }, { nom: 'Prikro', chefLieu: 'Prikro' }] },
          { nom: 'Lôh-Djiboua', chefLieu: 'Divo', sousPrefectures: [{ nom: 'Divo', chefLieu: 'Divo' }, { nom: 'Gagnoa', chefLieu: 'Gagnoa' }, { nom: 'Lakota', chefLieu: 'Lakota' }, { nom: 'Guibéroua', chefLieu: 'Guibéroua' }] }
        ]
      }
    ]
  },
  {
    id: 'vallee-du-bandama',
    nom: 'Vallée du Bandama',
    chefLieu: 'Bouaké',
    regions: [
      {
        nom: 'Vallée du Bandama',
        prefectures: [
          { nom: 'Gbêkê', chefLieu: 'Bouaké', sousPrefectures: [{ nom: 'Bouaké', chefLieu: 'Bouaké' }, { nom: 'Béoumi', chefLieu: 'Béoumi' }, { nom: 'Sakassou', chefLieu: 'Sakassou' }, { nom: 'Katiola', chefLieu: 'Katiola' }, { nom: 'Dabakala', chefLieu: 'Dabakala' }] },
          { nom: 'Hambol', chefLieu: 'Katiola', sousPrefectures: [{ nom: 'Katiola', chefLieu: 'Katiola' }, { nom: 'Dabakala', chefLieu: 'Dabakala' }, { nom: 'Tiébissou', chefLieu: 'Tiébissou' }, { nom: 'Djékanou', chefLieu: 'Djékanou' }] }
        ]
      }
    ]
  },
  {
    id: 'woroba',
    nom: 'Woroba',
    chefLieu: 'Korhogo',
    regions: [
      {
        nom: 'Woroba',
        prefectures: [
          { nom: 'Poro', chefLieu: 'Korhogo', sousPrefectures: [{ nom: 'Korhogo', chefLieu: 'Korhogo' }, { nom: 'Sinematiali', chefLieu: 'Sinematiali' }, { nom: 'Dikodougou', chefLieu: 'Dikodougou' }] },
          { nom: 'Tchologo', chefLieu: 'Ferkessédougou', sousPrefectures: [{ nom: 'Ferkessédougou', chefLieu: 'Ferkessédougou' }, { nom: 'Sinématiali', chefLieu: 'Sinématiali' }, { nom: 'Boundiali', chefLieu: 'Boundiali' }] },
          { nom: 'Bafing', chefLieu: 'Touba', sousPrefectures: [{ nom: 'Touba', chefLieu: 'Touba' }, { nom: 'Ouaninou', chefLieu: 'Ouaninou' }, { nom: 'Kani', chefLieu: 'Kani' }] },
          { nom: 'Kabadougou', chefLieu: 'Odienné', sousPrefectures: [{ nom: 'Odienné', chefLieu: 'Odienné' }, { nom: 'Madinani', chefLieu: 'Madinani' }, { nom: 'Tengréla', chefLieu: 'Tengréla' }] },
          { nom: 'Worodougou', chefLieu: 'Séguéla', sousPrefectures: [{ nom: 'Séguéla', chefLieu: 'Séguéla' }, { nom: 'Timbi', chefLieu: 'Timbi' }, { nom: 'Kani', chefLieu: 'Kani' }] }
        ]
      }
    ]
  },
  {
    id: 'bafing-savanes',
    nom: 'Bafing / Savanes',
    chefLieu: 'Boundiali',
    regions: [
      {
        nom: 'Bafing / Savanes',
        prefectures: [
          { nom: 'Savanes', chefLieu: 'Boundiali', sousPrefectures: [{ nom: 'Boundiali', chefLieu: 'Boundiali' }, { nom: 'Ferkessédougou', chefLieu: 'Ferkessédougou' }, { nom: 'Sinématiali', chefLieu: 'Sinématiali' }] },
          { nom: 'Tchologo', chefLieu: 'Ferkessédougou', sousPrefectures: [{ nom: 'Ferkessédougou', chefLieu: 'Ferkessédougou' }] }
        ]
      }
    ]
  },
  {
    id: 'zanzan',
    nom: 'Zanzan',
    chefLieu: 'Gagnoa',
    regions: [
      {
        nom: 'Gôh',
        prefectures: [
          { nom: 'Gôh', chefLieu: 'Gagnoa', sousPrefectures: [{ nom: 'Gagnoa', chefLieu: 'Gagnoa' }, { nom: 'Oumé', chefLieu: 'Oumé' }, { nom: 'Lakota', chefLieu: 'Lakota' }] }
        ]
      }
    ]
  },
  {
    id: 'montagnes',
    nom: 'Montagnes',
    chefLieu: 'Man',
    regions: [
      {
        nom: 'Montagnes',
        prefectures: [
          { nom: 'Tonkpi', chefLieu: 'Man', sousPrefectures: [{ nom: 'Man', chefLieu: 'Man' }, { nom: 'Danané', chefLieu: 'Danané' }, { nom: 'Guessh', chefLieu: 'Guessh' }, { nom: 'Bianouanou', chefLieu: 'Bianouanou' }] },
          { nom: 'Cavally', chefLieu: 'Guiglo', sousPrefectures: [{ nom: 'Guiglo', chefLieu: 'Guiglo' }, { nom: 'Tai', chefLieu: 'Tai' }, { nom: 'Duékoué', chefLieu: 'Duékoué' }, { nom: 'Bloléquin', chefLieu: 'Bloléquin' }] },
          { nom: 'Guémon', chefLieu: 'Duékoué', sousPrefectures: [{ nom: 'Duékoué', chefLieu: 'Duékoué' }, { nom: 'Guiglo', chefLieu: 'Guiglo' }, { nom: 'Bangolo', chefLieu: 'Bangolo' }, { nom: 'Danané', chefLieu: 'Danané' }] }
        ]
      }
    ]
  },
  {
    id: 'comoe',
    nom: 'Cavally / Comoé',
    chefLieu: 'Abengourou',
    regions: [
      {
        nom: 'Comoé',
        prefectures: [
          { nom: 'Sud-Comoé', chefLieu: 'Grand-Bassam', sousPrefectures: [{ nom: 'Grand-Bassam', chefLieu: 'Grand-Bassam' }, { nom: 'Aboisso', chefLieu: 'Aboisso' }, { nom: 'Tiassalé', chefLieu: 'Tiassalé' }, { nom: 'Adiaké', chefLieu: 'Adiaké' }] },
          { nom: 'Indénié-Djuablin', chefLieu: 'Abengourou', sousPrefectures: [{ nom: 'Abengourou', chefLieu: 'Abengourou' }, { nom: 'Aboisso', chefLieu: 'Aboisso' }, { nom: 'Adiaké', chefLieu: 'Adiaké' }] },
          { nom: 'Agnéby-Tiassa', chefLieu: 'Agboville', sousPrefectures: [{ nom: 'Agboville', chefLieu: 'Agboville' }, { nom: 'Tiassalé', chefLieu: 'Tiassalé' }, { nom: 'Sikensi', chefLieu: 'Sikensi' }, { nom: 'Taabo', chefLieu: 'Taabo' }] }
        ]
      }
    ]
  },
  {
    id: 'lagunes',
    nom: 'Lagunes',
    chefLieu: 'Dabou',
    regions: [
      {
        nom: 'Agnéby-Tiassa',
        prefectures: [
          { nom: 'Agnéby-Tiassa', chefLieu: 'Agboville', sousPrefectures: [{ nom: 'Agboville', chefLieu: 'Agboville' }, { nom: 'Dabou', chefLieu: 'Dabou' }, { nom: 'Sikensi', chefLieu: 'Sikensi' }, { nom: 'Tiassalé', chefLieu: 'Tiassalé' }, { nom: 'Taabo', chefLieu: 'Taabo' }] },
          { nom: 'Grands-Ponts', chefLieu: 'Dabou', sousPrefectures: [{ nom: 'Dabou', chefLieu: 'Dabou' }, { nom: 'Sikensi', chefLieu: 'Sikensi' }, { nom: 'Grand-Lahou', chefLieu: 'Grand-Lahou' }] }
        ]
      }
    ]
  },
  {
    id: 'haut-sassandra',
    nom: 'Haut-Sassandra',
    chefLieu: 'Daloa',
    regions: [
      {
        nom: 'Haut-Sassandra',
        prefectures: [
          { nom: 'Haut-Sassandra', chefLieu: 'Daloa', sousPrefectures: [{ nom: 'Daloa', chefLieu: 'Daloa' }, { nom: 'Issia', chefLieu: 'Issia' }, { nom: 'Vavoua', chefLieu: 'Vavoua' }, { nom: 'Saïoua', chefLieu: 'Saïoua' }] }
        ]
      }
    ]
  },
  {
    id: 'marahoue',
    nom: 'Marahoué',
    chefLieu: 'Bouaflé',
    regions: [
      {
        nom: 'Marahoué',
        prefectures: [
          { nom: 'Marahoué', chefLieu: 'Bouaflé', sousPrefectures: [{ nom: 'Bouaflé', chefLieu: 'Bouaflé' }, { nom: 'Sinfra', chefLieu: 'Sinfra' }] }
        ]
      }
    ]
  },
  {
    id: 'gontougo',
    nom: 'Gontougo',
    chefLieu: 'Bondoukou',
    regions: [
      {
        nom: 'Gontougo',
        prefectures: [
          { nom: 'Gontougo', chefLieu: 'Bondoukou', sousPrefectures: [{ nom: 'Bondoukou', chefLieu: 'Bondoukou' }, { nom: 'Tanda', chefLieu: 'Tanda' }, { nom: 'Bouna', chefLieu: 'Bouna' }, { nom: 'Doropo', chefLieu: 'Doropo' }, { nom: 'Transua', chefLieu: 'Transua' }] },
          { nom: 'Bounkani', chefLieu: 'Bouna', sousPrefectures: [{ nom: 'Bouna', chefLieu: 'Bouna' }, { nom: 'Doropo', chefLieu: 'Doropo' }, { nom: 'Saraboukou', chefLieu: 'Saraboukou' }] }
        ]
      }
    ]
  },
  {
    id: 'bas-sassandra-nawa',
    nom: 'Bas-Sassandra / Nawa',
    chefLieu: 'San-Pédro',
    regions: [
      {
        nom: 'Bas-Sassandra',
        prefectures: [
          { nom: 'Bas-Sassandra', chefLieu: 'San-Pédro', sousPrefectures: [{ nom: 'San-Pédro', chefLieu: 'San-Pédro' }, { nom: 'Tabou', chefLieu: 'Tabou' }, { nom: 'Sassandra', chefLieu: 'Sassandra' }, { nom: 'Méagui', chefLieu: 'Méagui' }] },
          { nom: 'Nawa', chefLieu: 'Soubré', sousPrefectures: [{ nom: 'Soubré', chefLieu: 'Soubré' }, { nom: 'Buyo', chefLieu: 'Buyo' }, { nom: 'Guéyo', chefLieu: 'Guéyo' }] },
          { nom: 'Grand-Popo', chefLieu: 'Grand-Popo', sousPrefectures: [{ nom: 'Grand-Popo', chefLieu: 'Grand-Popo' }, { nom: 'Loh-Djiboua', chefLieu: 'Loh-Djiboua' }] }
        ]
      }
    ]
  },
  {
    id: 'bafing-bere',
    nom: 'Bafing / Béré',
    chefLieu: 'Mankono',
    regions: [
      {
        nom: 'Bafing / Béré',
        prefectures: [
          { nom: 'Béré', chefLieu: 'Mankono', sousPrefectures: [{ nom: 'Mankono', chefLieu: 'Mankono' }, { nom: 'Kounahiri', chefLieu: 'Kounahiri' }, { nom: 'Katiola', chefLieu: 'Katiola' }, { nom: 'Tondikrou', chefLieu: 'Tondikrou' }] },
          { nom: 'Hambol', chefLieu: 'Katiola', sousPrefectures: [{ nom: 'Kani', chefLieu: 'Kani' }, { nom: 'Ouoloffoumana', chefLieu: 'Ouoloffoumana' }] }
        ]
      }
    ]
  },
  {
    id: 'indenie-djuablin',
    nom: 'Indénié-Djuablin',
    chefLieu: 'Abengourou',
    regions: [
      {
        nom: 'Indénié-Djuablin',
        prefectures: [
          { nom: 'Indénié-Djuablin', chefLieu: 'Abengourou', sousPrefectures: [{ nom: 'Abengourou', chefLieu: 'Abengourou' }, { nom: 'Adiaké', chefLieu: 'Adiaké' }, { nom: 'Bettié', chefLieu: 'Bettié' }, { nom: 'Aboisso', chefLieu: 'Aboisso' }] }
        ]
      }
    ]
  }
];

/** Liste à plat des 31 zones / principales villes (ordre d'affichage). */
export const VILLES_CI = [
  { ville: 'Abidjan', zone: 'District Autonome d\'Abidjan' },
  { ville: 'Yamoussoukro', zone: 'District Autonome de Yamoussoukro' },
  { ville: 'Bouaké', zone: 'Vallée du Bandama' },
  { ville: 'Daloa', zone: 'Haut-Sassandra' },
  { ville: 'San-Pédro', zone: 'Bas-Sassandra' },
  { ville: 'Korhogo', zone: 'Poro' },
  { ville: 'Man', zone: 'Tonkpi' },
  { ville: 'Gagnoa', zone: 'Gôh' },
  { ville: 'Abengourou', zone: 'Indénié-Djuablin' },
  { ville: 'Dimbokro', zone: 'N\'Zi' },
  { ville: 'Divo', zone: 'Lôh-Djiboua' },
  { ville: 'Anyama', zone: 'Abidjan et périphéries' },
  { ville: 'Bingerville', zone: 'Abidjan et périphéries' },
  { ville: 'Songon', zone: 'Abidjan et périphéries' },
  { ville: 'Grand-Bassam', zone: 'Sud-Comoé' },
  { ville: 'Bonoua', zone: 'Sud-Comoé' },
  { ville: 'Aboisso', zone: 'Sud-Comoé' },
  { ville: 'Agboville', zone: 'Agnéby-Tiassa' },
  { ville: 'Sikensi', zone: 'Agnéby-Tiassa' },
  { ville: 'Tiassalé', zone: 'Agnéby-Tiassa' },
  { ville: 'Séguéla', zone: 'Worodougou' },
  { ville: 'Timbi', zone: 'Worodougou' },
  { ville: 'Odienné', zone: 'Kabadougou' },
  { ville: 'Madinani', zone: 'Kabadougou' },
  { ville: 'Ferkessédougou', zone: 'Tchologo' },
  { ville: 'Bondoukou', zone: 'Gontougo' },
  { ville: 'Tanda', zone: 'Gontougo' },
  { ville: 'Bouna', zone: 'Bounkani' },
  { ville: 'Doropo', zone: 'Bounkani' },
  { ville: 'Guiglo', zone: 'Cavally' },
  { ville: 'Tai', zone: 'Cavally' },
  { ville: 'Duékoué', zone: 'Guémon' },
  { ville: 'Bloléquin', zone: 'Guémon' },
  { ville: 'Sassandra', zone: 'Bas-Sassandra' },
  { ville: 'Tabou', zone: 'Bas-Sassandra' },
  { ville: 'Katiola', zone: 'Hambol' },
  { ville: 'Dabakala', zone: 'Hambol' },
  { ville: 'Touba', zone: 'Bafing' },
  { ville: 'Ouaninou', zone: 'Bafing' },
  { ville: 'Mankono', zone: 'Béré' },
  { ville: 'Kounahiri', zone: 'Béré' },
  { ville: 'Bouaflé', zone: 'Marahoué' },
  { ville: 'Sinfra', zone: 'Marahoué' },
  { ville: 'Oumé', zone: 'Gôh' },
  { ville: 'Issia', zone: 'Haut-Sassandra' },
  { ville: 'Saïoua', zone: 'Haut-Sassandra' },
  { ville: 'Lakota', zone: 'Gôh' },
  { ville: 'Guitry', zone: 'Lôh-Djiboua' },
  { ville: 'Tiébissou', zone: 'Hambol' },
  { ville: 'Djékanou', zone: 'Hambol' },
  { ville: 'M\'Bahiakro', zone: 'N\'Zi' },
  { ville: 'Prikro', zone: 'N\'Zi' },
  { ville: 'Kouassi-Datekro', zone: 'Gbêkê' },
  { ville: 'Transua', zone: 'Gontougo' }
];

/** Régions uniques, triées. */
export const REGIONS_CI = [...new Set(VILLES_CI.map(v => v.zone))].sort((a, b) => a.localeCompare(b, 'fr'));

/** Villes d'une région donnée. */
export const villesDeRegion = region => VILLES_CI.filter(v => v.zone === region).map(v => v.ville);

/** Recherche une ville (insensible à la casse et aux accents). */
export const normaliser = valeur =>
  String(valeur || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export const trouverVille = nom => {
  const cible = normaliser(nom);
  return VILLES_CI.find(v => normaliser(v.ville) === cible) || null;
};

/** Statistiques du référentiel. */
export const STATS_GEO = {
  zones: REGIONS_CI.length,
  villes: VILLES_CI.length,
  districts: DISTRICTS_CI.length,
  prefectures: DISTRICTS_CI.reduce((total, d) => total + d.regions.reduce((r, reg) => r + reg.prefectures.length, 0), 0),
  sousPrefectures: DISTRICTS_CI.reduce((total, d) => total + d.regions.reduce((r, reg) => r + reg.prefectures.reduce((p, pre) => p + pre.sousPrefectures.length, 0), 0), 0)
};