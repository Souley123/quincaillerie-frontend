/**
 * COMPARAISON : un site public classique se comporte-t-il pareil ?
 *
 * Si le retour arrière aboutit aussi à `about:blank` sur un site commercial
 * ordinaire, alors c'est le comportement du navigateur en test automatisé,
 * pas un défaut de l'application.
 */
import { chromium } from 'playwright';

const navigateur = await chromium.launch({ channel: 'chrome' });

for (const [nom, url, lien] of [
  ['site public (exemple)', 'https://www.iana.org/help/example-domains', 'a[href*="iana.org"]'],
  ['application SKYS', 'http://localhost:3000/mot-de-passe/reinitialiser?jeton=' + 'c'.repeat(64) + '&email=a%40b.c', 'text=Retour à la connexion']
]) {
  const page = await navigateur.newPage();
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(800);
  const clic = await page.locator(lien).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(1200);
  const apres = page.url();
  await page.goBack({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
  console.log(`${nom}\n  page 1 : ${url}\n  clic   : ${clic ? 'oui' : 'non'} → ${apres}\n  retour : ${page.url()}\n`);
  await page.close();
}

await navigateur.close();
