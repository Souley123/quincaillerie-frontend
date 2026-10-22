/**
 * QA de la PAGE DE RÉINITIALISATION elle-même (rendu + validation).
 *
 * Vérifie ce que l'utilisateur venu d'un e-mail voit vraiment :
 *   - la carte SKYS ERP (et non du HTML brut),
 *   - deux champs, un indicateur de robustesse, un lien de retour,
 *   - le message d'erreur quand les mots de passe diffèrent.
 *
 * Usage : node tests/_qa-page-reinit-locale.mjs [urlFront] [mobile]
 */
import { chromium, devices } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:3000';
const mobile = process.argv[3] === 'mobile';

const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext(mobile ? { ...devices['iPhone SE'], locale: 'fr-FR' } : { locale: 'fr-FR' });
const page = await contexte.newPage();

const erreurs = [];
page.on('pageerror', erreur => erreurs.push(erreur.message));
page.on('console', message => {
  if (message.type() === 'error') erreurs.push(message.text().slice(0, 200));
});

await page.route('**/api/**', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: '[]'
}));

await page.goto(`${URL_APP}/mot-de-passe/reinitialiser?slug=maquincaillerie&jeton=${'a'.repeat(64)}&email=ksouleymanesoro60%40gmail.com`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const carte = await page.locator('.login-card').count();
const titres = await page.locator('h1').first().innerText();
const champs = await page.locator('input[type="password"]').count();
const retour = await page.getByText('Retour à la connexion').count();
const marque = await page.getByText('SKYS ERP').count();

console.log('Carte SKYS ERP présente :', carte > 0);
console.log('Titre :', titres);
console.log('Champs mot de passe :', champs);
console.log('Lien « Retour à la connexion » :', retour > 0);
console.log('Marque affichée :', marque > 0);

await page.locator('#nouveau-mdp').fill('Abcdef123456!x');
await page.waitForTimeout(300);
const robustesse = await page.getByText(/Faible|Moyen|Bon|Excellent/).count();
console.log('Indicateur de robustesse :', robustesse > 0);

await page.locator('#confirmation-mdp').fill('AutreMdp123456!');
await page.waitForTimeout(300);
const discordance = await page.getByText('Les mots de passe ne correspondent pas.').count();
console.log('Alerte de discordance :', discordance > 0);

await page.locator('#confirmation-mdp').fill('Abcdef123456!x');
await page.screenshot({ path: `tests/qa-mobile/page-reinit${mobile ? '-mobile' : ''}.png`, fullPage: true });
console.log('Capture : tests/qa-mobile/page-reinit' + (mobile ? '-mobile' : '') + '.png');
console.log('Erreurs JS :', erreurs.length ? erreurs : 'aucune');

await navigateur.close();
