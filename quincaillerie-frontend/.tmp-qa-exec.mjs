// Harnais : rend le rapport des scénarios .tmp-qa-*.mjs lisible sur la console.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const fichier = process.argv[2];
const url = process.argv[3] || 'http://localhost:3000/';
if (!fichier) { console.error('Usage: node .tmp-qa-exec.mjs <scenario.mjs> [url]'); process.exit(1); }

const { default: run } = await import(pathToFileURL(resolve(fichier)).href);
const navigateur = await chromium.launch({
  headless: true,
  /* Le binaire de la version attendue par Playwright n'est pas installé ici ;
     un Chromium compatible est déjà présent en local. */
  executablePath: process.env.QA_CHROME || 'C:\\Users\\LENOVO\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe'
});
const page = await navigateur.newPage();
page.setDefaultTimeout(30000);
/* Les scénarios remplissent les champs par leur libellé : on remplace les
   identifiants codés en dur par ceux fournis (variables d'environnement
   QA_EMAIL / QA_MDP), sans réécrire chaque fichier de scénario. */
const EMAIL = process.env.QA_EMAIL || 'ksouleymanesoro60@gmail.com';
const MOT_DE_PASSE = process.env.QA_MDP || 'Souley123';
const remplir = page.getByRole.bind(page);
page.getByRole = (role, options) => {
  const localisateur = remplir(role, options);
  const nom = String(options?.name || '');
  const estMotDePasse = /Mot de passe/i.test(nom);
  const estEmail = /Email|Adresse Email/i.test(nom);
  if (role !== 'textbox' || (!estMotDePasse && !estEmail)) return localisateur;
  const valeur = estMotDePasse ? MOT_DE_PASSE : EMAIL;
  const saisir = async () => (estMotDePasse ? page.locator('#login-password') : page.locator('#login-email')).first().fill(valeur);
  /* Localisateur réel : les scénarios continuent d'appeler .first().fill(...),
     seule la valeur saisie est remplacée. */
  return {
    first: () => ({ fill: saisir }),
    last: () => ({ fill: saisir }),
    nth: () => ({ fill: saisir }),
    fill: saisir
  };
};
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => (document.getElementById('root')?.children.length ?? 0) > 0, null, { timeout: 90000 });
try {
  const rapport = await run(page);
  const sortie = JSON.stringify(rapport, null, 2);
  console.log(sortie);
  const { writeFileSync } = await import('node:fs');
  writeFileSync('.tmp-qa-rapport.json', sortie);
} catch (e) {
  console.log('ECHEC: ' + (e.stack || e.message));
} finally {
  await navigateur.close();
}
