/**
 * BUILD POUR LES APPLICATIONS NATIVES (CAPACITOR ANDROID / iOS)
 * ------------------------------------------------------------
 * Pourquoi ce script existe :
 *
 * `vite.config.js` publie le site sur GitHub Pages, donc en production il
 * prefixe TOUTES les URLs par `/quincaillerie-frontend/` :
 *
 *   <script src="/quincaillerie-frontend/assets/index-xxxx.js">
 *
 * Dans le WebView Capacitor, l'application est servie a la RACINE
 * (`https://localhost/`). Le WebView cherchait donc
 * `https://localhost/quincaillerie-frontend/assets/index-xxxx.js` -> 404 :
 * le JavaScript n'etait jamais charge et l'ecran restait BLANC
 * (`<div id="root">` vide, aucune erreur visible).
 *
 * Ce script reconstruit `dist/` avec `VITE_BASE_PATH=/`, puis lance
 * `npx cap sync` pour copier le resultat dans les projets natifs.
 * GitHub Pages n'est pas impacte : la CI garde son build prefixe.
 *
 * Usage (depuis quincaillerie-frontend/) :
 *   node scripts/build-mobile.mjs            -> build + cap sync
 *   node scripts/build-mobile.mjs android    -> build + cap sync android
 *   node scripts/build-mobile.mjs ios        -> build + cap sync ios
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = fileURLToPath(new URL('..', import.meta.url));
const plateformes = process.argv.slice(2);

const executer = (commande, args, env = {}) => {
  const resultat = spawnSync(commande, args, {
    cwd: racine,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env }
  });
  if (resultat.status !== 0) {
    console.error(`\nEchec : ${commande} ${args.join(' ')}`);
    process.exit(resultat.status || 1);
  }
};

console.log('1/3 — Build Vite avec les chemins a la racine (VITE_BASE_PATH=/)...');
executer('npx', ['vite', 'build'], { VITE_BASE_PATH: '/' });

console.log('2/3 — Verification des chemins dans dist/index.html...');
/* On ne teste QUE les scripts et feuilles de style : eux seuls decident du
   chargement de l'application. Une page blanche vient d'un JS ou d'un CSS
   introuvable, pas d'une icone absente. */
const indexHtml = fs.readFileSync(path.join(racine, 'dist', 'index.html'), 'utf8');
const ressourcesPrefixees = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(m => m[1])
  .filter(url => /\.(?:js|mjs|css)(?:\?|$)/.test(url) && url.includes('/quincaillerie-frontend/'));
if (ressourcesPrefixees.length > 0) {
  console.error('ERREUR : ces ressources gardent le prefixe /quincaillerie-frontend/ :');
  ressourcesPrefixees.forEach(url => console.error(`  - ${url}`));
  console.error('Le WebView afficherait une page blanche. Build annule.');
  process.exit(1);
}
console.log('OK : les assets sont references depuis la racine (/assets/...).');

console.log('3/3 — Copie vers les projets natifs (cap sync)...');
executer('npx', ['cap', 'sync', ...plateformes]);

console.log('\nTermine. Reconstruisez l\'APK dans Android Studio pour voir le changement.');
