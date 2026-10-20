/**
 * AUDIT CIBLÉ — boutons de suppression qui sortent SANS message.
 *
 * On ne cherche QUE les `return;` qui suivent immédiatement une condition
 * d'ÉCHEC (`if (!x)`, `if (!x.ok)`), dans les fonctions `supprimer*` /
 * `retirer*`. Un `if (!confirme) return;` est normal (l'utilisateur a annulé).
 *
 * Usage : node scripts/audit-suppressions.js
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

// Les retours légitimes : l'utilisateur a refusé, ou le composant est démonté.
const LEGITIMES = /!confirme|annule|enCours|!window\.location\.search|!evenement|!event\.key/;

const trouvés = [];

for (const fichier of fichiers) {
  const lignes = fs.readFileSync(fichier, 'utf8').split('\n');
  let fonction = null;
  const indentationFonction = { valeur: 0 };

  lignes.forEach((ligne, index) => {
    // Début d'une fonction de suppression, à l'indentation de 2 espaces.
    const def = /^(\s*)const\s+(supprimer\w*|retirer\w*)\s*=/.exec(ligne);
    if (def) {
      fonction = def[2];
      indentationFonction.valeur = def[1].length;
    }
    // Fin de la fonction (accolade seule à l'indentation de déclaration).
    if (fonction && new RegExp(`^\\s{${indentationFonction.valeur}}\\}\\s*;?\\s*$`).test(ligne)) {
      fonction = null;
    }

    if (!fonction) return;

    const condition = /^\s*if\s*\(([^)]*)\)\s*(?:\{\s*)?return\s*;/.exec(ligne);
    if (!condition) return;
    const test = condition[1];
    if (LEGITIMES.test(test)) return;         // annulation volontaire
    if (/\.ok\b|mutationTime|persisted/.test(test)) return;

    trouvés.push({
      fichier: path.relative(src, fichier),
      ligne: index + 1,
      fonction,
      condition: test.trim(),
      code: ligne.trim()
    });
  });
}

if (!trouvés.length) {
  console.log('OK — aucune suppression silencieuse.');
} else {
  console.log(`${trouvés.length} sortie(s) silencieuse(s) à vérifier :\n`);
  trouvés.forEach(t => console.log(`  ${t.fichier}:${t.ligne}  [${t.fonction}]\n     if (${t.condition}) return;`));
}
