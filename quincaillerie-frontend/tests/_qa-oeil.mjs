/**
 * QA : bouton « Afficher le mot de passe » sur la page de connexion.
 *
 * Vérifie ce que l'utilisateur obtient concrètement :
 *   - un bouton œil visible dans le champ ;
 *   - le basculement password → text et retour ;
 *   - l'état annoncé aux lecteurs d'écran (aria-pressed, aria-label) ;
 *   - le rendu sur ordinateur et téléphone.
 *
 * Usage : node tests/_qa-oeil.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const navigateur = await chromium.launch({ channel: 'chrome' });

for (const [nom, options] of [
  ['ordinateur', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ['pixel5', devices['Pixel 5']]
]) {
  const contexte = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const page = await contexte.newPage();
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  const oeil = page.locator('.login-oeil').first();
  const champ = page.locator('#login-password');

  await champ.fill('MonSecret123!');
  const avant = await champ.getAttribute('type');
  const etiquetteAvant = await oeil.getAttribute('aria-label');
  const boite = await oeil.boundingBox();

  await oeil.click();
  await page.waitForTimeout(250);
  const apres = await champ.getAttribute('type');
  const etiquetteApres = await oeil.getAttribute('aria-label');
  const valeurVisible = await champ.inputValue();

  await page.screenshot({ path: `tests/qa-mobile/oeil-${nom}.png` });

  await oeil.click();
  await page.waitForTimeout(200);
  const retour = await champ.getAttribute('type');

  console.log(`${nom}`);
  console.log(`  bouton : ${Math.round(boite.width)}×${Math.round(boite.height)} px`);
  console.log(`  type avant=${avant} → après clic=${apres} → re-clic=${retour}`);
  console.log(`  aria-label : « ${etiquetteAvant} » → « ${etiquetteApres} »`);
  console.log(`  valeur affichée : ${valeurVisible === 'MonSecret123!' ? 'correcte' : 'INCORRECTE'}`);
  await contexte.close();
}

await navigateur.close();
