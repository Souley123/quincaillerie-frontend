/**
 * QUE FAIT LE BOUTON « RETOUR À LA CONNEXION » ?
 *
 * L'utilisateur arrive sur la page de réinitialisation, clique sur le lien de
 * retour… et revient sur la page de réinitialisation. Ce script reproduit le
 * parcours réel et affiche chaque navigation pour localiser la cause.
 *
 * Usage : node tests/_qa-retour-connexion.mjs [urlDeBase]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://souley123.github.io/quincaillerie-frontend';
const LIEN = `${BASE}/mot-de-passe/reinitialiser?slug=maquincaillerie&jeton=${'a'.repeat(64)}&email=ksouleymanesoro60%40gmail.com`;

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });

const etapes = [];
page.on('framenavigated', cadre => {
  if (cadre === page.mainFrame()) etapes.push(`navigation → ${cadre.url()}`);
});
page.on('response', reponse => {
  if (reponse.request().resourceType() === 'document') etapes.push(`document ${reponse.status()} ${reponse.url()}`);
});

await page.goto(LIEN, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log('1. Arrivée :', page.url());
console.log('   Titre :', (await page.locator('h1').first().innerText()).trim());

const retour = page.getByText('Retour à la connexion');
console.log('\n2. Lien de retour — href =', JSON.stringify(await retour.getAttribute('href')));

await retour.click();
await page.waitForTimeout(3500);

console.log('\n3. Après le clic :');
etapes.slice(-6).forEach(etape => console.log('   ', etape));
console.log('   URL finale :', page.url());

const texte = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
const surConnexion = /Adresse Email ou Login|Mot de passe oublié/i.test(texte);
const surReinit = /Réinitialiser le mot de passe/i.test(texte);
console.log('   Écran de connexion affiché :', surConnexion);
console.log('   Page de réinitialisation   :', surReinit);
console.log('   Texte :', texte.slice(0, 120));

await page.screenshot({ path: 'tests/qa-mobile/retour-connexion.png', fullPage: true });
await navigateur.close();
