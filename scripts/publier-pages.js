/**
 * PUBLICATION MANUELLE SUR LA BRANCHE gh-pages
 *
 * Pourquoi ? Le workflow GitHub Actions se déclenche bien sur les push de
 * `main`, mais ne produit plus de commit sur `gh-pages` : le site reste donc
 * figé sur une ancienne version, alors que le code et les tests sont corrects.
 *
 * Ce script construit le front puis publie `quincaillerie-frontend/dist` sur
 * `gh-pages` (orpheline, comme le fait peaceiris/actions-gh-pages), avec le
 * fichier `.nojekyll` indispensable aux noms de dossiers commençant par « _ ».
 *
 * Usage : node scripts/publier-pages.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const racine = path.resolve(__dirname, '../quincaillerie-frontend');
const dist = path.join(racine, 'dist');
const executer = (commande, dossier) => execSync(commande, { cwd: dossier, stdio: 'inherit' });

console.log('1/5 — Build de production…');
executer('node node_modules/vite/bin/vite.js build', racine);

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  throw new Error('Build incomplet : dist/index.html absent.');
}

// .nojekyll : sans ce fichier, GitHub Pages ignore les dossiers « _ ».
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

console.log('2/5 — Préparation du dépôt gh-pages…');
const temporaire = fs.mkdtempSync(path.join(os.tmpdir(), 'skys-pages-'));
for (const element of fs.readdirSync(dist)) {
  fs.cpSync(path.join(dist, element), path.join(temporaire, element), { recursive: true });
}

console.log('3/5 — Initialisation de la branche orpheline…');
executer('git init -q', temporaire);
executer('git checkout -q -b gh-pages', temporaire);

const depot = execSync('git remote get-url origin', { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }).trim();
executer(`git remote add origin ${depot}`, temporaire);
executer('git add -A', temporaire);

const commitSource = execSync('git rev-parse --short HEAD', { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }).trim();
executer(
  `git -c user.name="SKYS Deploy" -c user.email="deploy@skys.local" commit -q -m "deploy: ${commitSource} (publication manuelle)"`,
  temporaire
);

console.log('4/5 — Envoi sur origin/gh-pages…');
executer('git push -f origin gh-pages', temporaire);

console.log('5/5 — Nettoyage.');
fs.rmSync(temporaire, { recursive: true, force: true });

console.log('\nPublication terminée. GitHub Pages reconstruit en 1 à 3 minutes.');
