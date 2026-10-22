/**
 * REPRODUCTION FIDÈLE, sans aucune simulation :
 * le vrai site GitHub Pages parle au VRAI backend Render.
 *
 * Objectif : voir exactement l'écran affiché à l'ouverture, puis ce que
 * devient l'interface quand le compte est verrouillé (423).
 *
 * Usage : node tests/_qa-reproduction-reelle.mjs [email]
 */
import { chromium } from 'playwright';

const SITE = 'https://souley123.github.io/quincaillerie-frontend/';
const EMAIL = process.argv[2] || 'ksouleymanesoro60@gmail.com';

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });

const appels = [];
page.on('response', reponse => {
  if (reponse.url().includes('/api/')) appels.push(`${reponse.status()} ${reponse.url().replace(/^https?:\/\/[^/]+/, '')}`);
});
const erreurs = [];
page.on('pageerror', erreur => erreurs.push(erreur.message.slice(0, 160)));

await page.goto(SITE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const ecran = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 260);

console.log('=== 1. OUVERTURE (aucun stockage préexistant) ===');
console.log('URL     :', page.url());
console.log('Écran   :', await ecran());
console.log('Appels  :', appels.length ? appels : 'aucun');
await page.screenshot({ path: 'tests/qa-mobile/reproduction-1-ouverture.png', fullPage: true });

// 2. Tentative de connexion avec un mot de passe volontairement faux.
console.log('\n=== 2. CONNEXION (mot de passe volontairement faux) ===');
appels.length = 0;
const champEmail = page.locator('#login-email');
if (await champEmail.count()) {
  await champEmail.fill(EMAIL);
  await page.locator('#login-password').fill('MotDePasseFaux999!');
  await page.locator('form.login-form button[type="submit"]').click();
  await page.waitForTimeout(4000);
  console.log('Appels  :', appels);
  console.log('Écran   :', await ecran());
  await page.screenshot({ path: 'tests/qa-mobile/reproduction-2-echec.png', fullPage: true });
} else {
  console.log('Aucun champ de connexion : un autre écran est affiché dès le départ.');
}

// 3. Stockage laissé par l'application.
const stockage = await page.evaluate(() => Object.keys(localStorage)
  .filter(cle => /trial|subscribed|abonnement|essai|jeton|entreprise|auth|role/.test(cle))
  .map(cle => `${cle} = ${String(localStorage.getItem(cle)).slice(0, 80)}`));
console.log('\n=== 3. STOCKAGE LOCAL ===');
console.log(stockage.length ? stockage.join('\n') : '(vide)');
console.log('\nErreurs JS :', erreurs.length ? erreurs : 'aucune');

await navigateur.close();
