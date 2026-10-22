/**
 * POURQUOI LE LIEN ATTERRIT SUR LE 404 DE GITHUB ?
 *
 * Deux adresses sont en jeu :
 *   A. .../quincaillerie-frontend/mot-de-passe/reinitialiser  (corrigée)
 *   B. .../mot-de-passe/reinitialiser                          (ancienne, APP_URL racine)
 *
 * L'adresse B n'est servie par AUCUN site GitHub : le fichier 404.html n'est
 * donc jamais exécuté et GitHub affiche sa page d'erreur. Ce script le prouve
 * en mesurant les redirections réelles de chaque adresse.
 *
 * Usage : node tests/_qa-redirections.mjs
 */
import { chromium } from 'playwright';

const CASES = [
  ['A — sous-chemin (corrigé)', 'https://souley123.github.io/quincaillerie-frontend/mot-de-passe/reinitialiser?slug=maquincaillerie&jeton=TEST&email=a%40b.c'],
  ['B — racine (ancien lien)', 'https://souley123.github.io/mot-de-passe/reinitialiser?slug=maquincaillerie&jeton=TEST&email=a%40b.c']
];

const navigateur = await chromium.launch({ channel: 'chrome' });

for (const [libelle, url] of CASES) {
  const page = await navigateur.newPage({ locale: 'fr-FR' });
  const sauts = [];
  page.on('response', reponse => {
    if (reponse.request().resourceType() === 'document') sauts.push(reponse.status());
  });
  page.on('framenavigated', cadre => {
    if (cadre === page.mainFrame()) sauts.push(`→ ${new URL(cadre.url()).pathname}`);
  });

  await page.goto(url, { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(3500);

  const texte = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  const estPageReinit = /réinitialiser le mot de passe/i.test(texte);
  const estErreurGitHub = /There isn't a GitHub Pages site here|404/i.test(texte) && !estPageReinit;

  console.log(`\n${libelle}`);
  console.log('  parcours   :', sauts.join(' '));
  console.log('  finale     :', page.url());
  console.log('  page réelle:', estPageReinit ? 'OUI — formulaire de réinitialisation' : estErreurGitHub ? 'NON — erreur GitHub 404' : `NON — « ${texte.slice(0, 80)} »`);
  await page.close();
}

await navigateur.close();
