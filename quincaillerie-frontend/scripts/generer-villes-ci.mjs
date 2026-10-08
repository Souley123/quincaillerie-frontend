// Source : https://en.wikipedia.org/wiki/Sub-prefectures_of_Ivory_Coast
// Import ponctuel des sièges de sous-préfectures (pas de dépendance réseau à l'exécution).
import { writeFile } from 'node:fs/promises';

const url = 'https://en.wikipedia.org/w/api.php?action=parse&page=Sub-prefectures_of_Ivory_Coast&prop=wikitext&format=json';
const response = await fetch(url);
if (!response.ok) throw new Error(`Référentiel indisponible : ${response.status}`);
const texte = (await response.json()).parse.wikitext['*'];
const regions = {};
let region = '';
for (const ligne of texte.split('\n')) {
  const district = ligne.match(/^===\[\[(Abidjan Autonomous District|Yamoussoukro Autonomous District)\]\]/);
  if (district) {
    region = district[1] === 'Abidjan Autonomous District' ? "District Autonome d'Abidjan" : 'District Autonome de Yamoussoukro';
    regions[region] = [];
  }
  const section = ligne.match(/^====\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
  if (section && !['Urban Abidjan', 'Rural Abidjan'].includes(section[1])) {
    region = section[1].replace(/ Region$/, '');
    regions[region] = [];
  }
  const localite = ligne.match(/^\*#\s+\[\[([^\]]+)\]\]/);
  if (localite && region) {
    const ville = localite[1].split('|').pop();
    if (!regions[region].includes(ville)) regions[region].push(ville);
  }
}
// Abidjan (ville) comprend les communes urbaines ; elle reste sélectionnable.
regions["District Autonome d'Abidjan"].unshift('Abidjan');
if (Object.keys(regions).length !== 33 || Object.values(regions).reduce((n, liste) => n + liste.length, 0) < 500) {
  throw new Error('Référentiel incomplet : génération refusée.');
}
for (const liste of Object.values(regions)) liste.sort((a, b) => a.localeCompare(b, 'fr'));
const contenu = `// Sièges des sous-préfectures et communes urbaines, regroupés par région.\n// Source : https://en.wikipedia.org/wiki/Sub-prefectures_of_Ivory_Coast\n// Données géographiques, pas une liste exhaustive de tous les villages.\nexport const REGIONS_VILLES_CI = ${JSON.stringify(regions, null, 2)};\n\nexport const VILLES_DESTINATION_CI = [...new Set(Object.values(REGIONS_VILLES_CI).flat())].sort((a, b) => a.localeCompare(b, 'fr'));\n`;
await writeFile(new URL('../src/data/villes-ci.js', import.meta.url), contenu, 'utf8');
console.log(`${Object.keys(regions).length} zones, ${Object.values(regions).reduce((n, liste) => n + liste.length, 0)} lieux par région générés.`);
