/**
 * QA : « Retour à la connexion » puis retour arrière du navigateur.
 *
 * Objectif : après avoir cliqué sur le bouton, le bouton « retour » du
 * navigateur ne doit PLUS ramener sur la page de réinitialisation.
 *
 * Usage : node tests/_qa-retour-historique.mjs [urlDeBase]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const LIEN = `${BASE}/mot-de-passe/reinitialiser?slug=maquincaillerie&jeton=${'b'.repeat(64)}&email=ksouleymanesoro60%40gmail.com`;

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });
await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

const etat = async () => {
  const texte = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  return /Adresse Email ou Login/i.test(texte) ? 'CONNEXION'
    : /Réinitialiser le mot de passe/i.test(texte) ? 'RÉINITIALISATION'
    : 'AUTRE';
};

// 1. L'utilisateur ouvre le lien reçu par e-mail.
await page.goto(LIEN, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
console.log('1. Après ouverture du lien      :', await etat(), '—', page.url());
const longueurApresLien = await page.evaluate(() => history.length);

// 2. Il clique sur « Retour à la connexion ».
await page.getByText('Retour à la connexion').click();
await page.waitForTimeout(2500);
console.log('2. Après « Retour à la connexion » :', await etat(), '—', page.url());

// 3. Il appuie ensuite sur le bouton « retour » du navigateur.
await page.goBack({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(2500);
const final = await etat();
console.log('3. Après retour arrière du navigateur :', final, '—', page.url());

console.log('\nHistorique :', longueurApresLien, 'entrée(s) à l\'arrivée');
console.log(final === 'CONNEXION'
  ? 'VERDICT OK  : impossible de revenir sur la page de réinitialisation.'
  : 'VERDICT KO  : le retour arrière ramène encore sur la page de réinitialisation.');

await page.screenshot({ path: 'tests/qa-mobile/retour-connexion.png', fullPage: true });
await navigateur.close();
process.exit(final === 'CONNEXION' ? 0 : 1);
