/**
 * QA : le lien reçu par e-mail ouvre-t-il vraiment la page de réinitialisation ?
 *
 * GitHub Pages renvoie un 404 pour une adresse profonde (/mot-de-passe/...).
 * Le fichier public/404.html est censé rediriger. Un 404 ne prouve donc rien :
 * seul un navigateur dit ce que l'utilisateur voit réellement.
 *
 * Usage : node tests/_qa-lien-prod.mjs [url]
 */
import { chromium } from 'playwright';

const URL_TEST = process.argv[2]
  || 'https://souley123.github.io/mot-de-passe/reinitialiser?slug=maquincaillerie&jeton=TEST&email=test%40example.com';

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });

const etapes = [];
page.on('framenavigated', cadre => {
  if (cadre === page.mainFrame()) etapes.push(cadre.url());
});

const statuts = [];
page.on('response', reponse => {
  if (reponse.request().resourceType() === 'document') statuts.push(`${reponse.status()} ${reponse.url()}`);
});

await page.goto(URL_TEST, { waitUntil: 'load' }).catch(() => {});
await page.waitForTimeout(4000);

console.log('URL demandée :', URL_TEST);
console.log('Documents chargés :', statuts);
console.log('Navigations :', etapes);
console.log('URL finale :', page.url());

const texte = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
console.log('Titre :', await page.title());
console.log('Texte visible :', texte.slice(0, 240));

const surPageReinitialisation = /réinitialiser le mot de passe/i.test(texte);
const champs = await page.locator('input[type="password"]').count();
console.log('\nPage de réinitialisation affichée :', surPageReinitialisation);
console.log('Champs de mot de passe :', champs);

await page.screenshot({ path: 'tests/qa-mobile/lien-production.png' });
console.log('Capture : tests/qa-mobile/lien-production.png');

await navigateur.close();
process.exit(surPageReinitialisation && champs >= 2 ? 0 : 1);
