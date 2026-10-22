/**
 * RECHERCHE DES « ACTIONS MUETTES » — boutons de suppression qui sortent
 * sans rien dire (return nu), laissant croire que le bouton ne marche pas.
 *
 * On parcourt tous les modules et on signale chaque `return;` immédiatement
 * précédé d'une condition `if (!…)`, dans une fonction dont le nom commence
 * par supprimer/retirer.
 *
 * Usage : node scripts/audit-actions-muettes.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, '../src');

const fichiers = [];
const parcourir = dossier => {
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) parcourir(chemin);
    else if (/\.(js|jsx)$/.test(entree.name) && !/\.test\.|\.spec\./.test(entree.name)) fichiers.push(chemin);
  }
};
parcourir(src);

const suspectes = [];

for (const fichier of fichiers) {
  const lignes = fs.readFileSync(fichier, 'utf8').split('\n');
  let fonctionCourante = null;

  lignes.forEach((ligne, index) => {
    const definition = /const\s+(supprimer\w*|retirer\w*|effacer\w*|debloquer\w*)\s*=\s*(async\s*)?\(?/.exec(ligne);
    if (definition) fonctionCourante = definition[1];

    // `if (...) return;` ou `if (...) { return; }` sur la même ligne.
    const muette = /\bif\s*\([^)]*\)\s*\{?\s*return\s*;/.test(ligne);
    if (muette && fonctionCourante) {
      suspectes.push({
        fichier: path.relative(src, fichier),
        ligne: index + 1,
        fonction: fonctionCourante,
        code: ligne.trim().slice(0, 110)
      });
    }

    // Détail d'un return sur la ligne suivante : if (...) { \n return;
    if (/\bif\s*\([^)]*\)\s*\{\s*$/.test(ligne)) {
      const suivante = (lignes[index + 1] || '').trim();
      const apres = (lignes[index + 2] || '').trim();
      if (suivante === 'return;' && apres === '}' && fonctionCourante) {
        suspectes.push({
          fichier: path.relative(src, fichier),
          ligne: index + 2,
          fonction: fonctionCourante,
          code: `${ligne.trim().slice(0, 80)} → return;`
        });
      }
    }
  });
}

if (!suspectes.length) {
  console.log('Aucune action muette détectée.');
} else {
  console.log(`${suspectes.length} action(s) muette(s) — un ` + '`return;` sans message` :\n');
  suspectes.forEach(s => console.log(`  ${s.fichier}:${s.ligne} [${s.fonction}]\n     ${s.code}`));
}
