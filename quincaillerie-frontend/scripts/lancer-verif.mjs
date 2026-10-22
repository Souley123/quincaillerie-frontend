/**
 * LANCEUR DES VÉRIFICATIONS D'INTERFACE
 * =====================================
 * Démarre la préversion du build, exécute le script demandé dans un
 * navigateur piloté, puis arrête la préversion.
 *
 *   npm run verif:acces      → scripts/verif-acces.mjs
 *   npm run verif:tableaux   → scripts/verif-tableaux.mjs
 *
 * Prérequis : `npm run build` doit avoir été lancé.
 * Le navigateur (patchright) est fourni par l'extension de l'agent ; s'il est
 * absent, le message indique comment l'installer.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const PORT = Number(process.env.VERIF_PORT || 4173);
const URL_APP = `http://localhost:${PORT}/quincaillerie-frontend/`;

const CIBLES = {
  acces: 'verif-acces.mjs',
  tableaux: 'verif-tableaux.mjs'
};

const cible = CIBLES[process.argv[2]];
if (!cible) {
  console.error('Usage : node scripts/lancer-verif.mjs [acces|tableaux]');
  process.exit(1);
}

if (!existsSync(path.join(RACINE, 'dist', 'index.html'))) {
  console.error('Build absent : lancez d’abord `npm run build`.');
  process.exit(1);
}

/* Le navigateur piloté vit dans le dossier de compétences de l'agent. */
const navigateur = process.env.VERIF_BROWSER
  || path.join(process.env.USERPROFILE || process.env.HOME || '', '.codegpt', 'skills', 'browser-automation', 'browser.mjs');

if (!existsSync(navigateur)) {
  console.error(`Navigateur de vérification introuvable :\n  ${navigateur}\nDéfinissez VERIF_BROWSER=<chemin>/browser.mjs`);
  process.exit(1);
}

/* 1. Préversion du build. */
const preview = spawn(
  process.execPath,
  [path.join(RACINE, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: RACINE, stdio: 'ignore' }
);

const arreter = () => { try { preview.kill(); } catch { /* déjà arrêté */ } };
process.on('SIGINT', () => { arreter(); process.exit(130); });
process.on('SIGTERM', () => { arreter(); process.exit(143); });

const attendre = async () => {
  for (let essai = 0; essai < 40; essai += 1) {
    try {
      const reponse = await fetch(URL_APP);
      if (reponse.ok) return true;
    } catch { /* serveur pas encore prêt */ }
    await new Promise(resoudre => setTimeout(resoudre, 250));
  }
  return false;
};

const pret = await attendre();
if (!pret) {
  console.error('La préversion n’a pas démarré (port occupé ?).');
  arreter();
  process.exit(1);
}

console.log(`Préversion prête : ${URL_APP}\nExécution de ${cible}…\n`);

/* 2. Vérification, sur le site publié (origine autorisée par l'API). */
const resultat = spawnSync(
  process.execPath,
  [navigateur, URL_APP, '--script', path.join(ICI, cible), '--timeout', '180000'],
  { cwd: RACINE, stdio: 'inherit', env: { ...process.env, VERIF_URL: URL_APP }, timeout: 240000 }
);

arreter();
process.exit(resultat.status ?? 0);
