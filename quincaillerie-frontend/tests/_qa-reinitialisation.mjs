/**
 * QA « Mot de passe oublié ? » — parcours réel dans le navigateur.
 *
 * Ce script clique vraiment dans l'interface (il ne suppose rien) :
 *   1. ouvre la page de connexion ;
 *   2. clique sur « Mot de passe oublié ? » ;
 *   3. saisit l'adresse et envoie ;
 *   4. affiche ce que l'utilisateur voit (succès ou message d'erreur exact) ;
 *   5. ouvre ensuite la page de réinitialisation avec le jeton fourni, et
 *      vérifie que le formulaire de nouveau mot de passe apparaît.
 *
 * Usage :
 *   node tests/_qa-reinitialisation.mjs [email] [jeton] [urlFront]
 * Exemple :
 *   node tests/_qa-reinitialisation.mjs ksouleymanesoro60@gmail.com <jeton> http://localhost:3000/
 */
import { chromium } from 'playwright';

const email = process.argv[2] || 'ksouleymanesoro60@gmail.com';
const jeton = process.argv[3] || '';
const URL_APP = process.argv[4] || 'http://localhost:3000/';

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });

const erreursConsole = [];
const appelsApi = [];
page.on('response', reponse => {
  if (reponse.url().includes('/api/')) appelsApi.push(`${reponse.status()} ${reponse.url()}`);
});
page.on('pageerror', erreur => erreursConsole.push(erreur.message));
page.on('console', message => {
  if (message.type() === 'error') erreursConsole.push(message.text().slice(0, 200));
});

/* Aucune interception : les appels vont au VRAI backend (localhost:5001).
   Les intercepter reviendrait à tester le simulateur, pas l'application. */

await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

console.log('--- 1. Écran de connexion ---');
const lienOublie = page.locator('.login-forgot');
await lienOublie.waitFor({ timeout: 15000 });
console.log('« Mot de passe oublié ? » visible :', await lienOublie.isVisible());
await lienOublie.click();
await page.waitForTimeout(400);

console.log('\n--- 2. Écran de réinitialisation ---');
const titre = await page.locator('h1').first().innerText();
console.log('Titre :', titre.replace(/\s+/g, ' ').trim());

const champEmail = page.locator('input[type="email"]').first();
await champEmail.fill(email);
console.log('Valeur du champ :', await champEmail.inputValue());
console.log('Champ valide (HTML) :', await champEmail.evaluate(champ => champ.checkValidity()));
const boutonEnvoyer = page.getByRole('button', { name: /^Envoyer/ }).first();
console.log('Bouton « Envoyer » désactivé :', await boutonEnvoyer.isDisabled());
await boutonEnvoyer.click();
await page.waitForTimeout(500);
const formulaireInvalide = await page.evaluate(() => {
  const formulaire = document.querySelector('.login-card form');
  if (!formulaire) return 'aucun formulaire';
  const invalides = Array.from(formulaire.elements)
    .filter(champ => champ.willValidate && !champ.checkValidity())
    .map(champ => `${champ.tagName.toLowerCase()}[${champ.type || ''}] ${champ.validationMessage}`);
  return invalides.length ? invalides : 'tout est valide';
});
console.log('Validation navigateur :', formulaireInvalide);

console.log('\n--- 3. Réponse après envoi ---');
await page.waitForTimeout(3000);
const succes = await page.locator('text=Demande prise en compte').count();
const alerte = await page.locator('[role="alert"]').count();
console.log('Confirmation affichée :', succes > 0);
if (alerte > 0) console.log('Message d’erreur :', (await page.locator('[role="alert"]').first().innerText()).trim());
console.log('Texte de la carte :', (await page.locator('.login-card').innerText()).replace(/\s+/g, ' ').slice(0, 220));
await page.screenshot({ path: 'tests/qa-mobile/reinitialisation-demande.png' });
/* Le formulaire est remplacé par la confirmation : on attend son texte
   pendant une durée qui couvre le réveil d'un backend Render ensommeillé. */
const depart = Date.now();
const confirmation = await page
  .locator('text=Demande prise en compte')
  .waitFor({ timeout: 70000 })
  .then(() => true)
  .catch(() => false);
console.log('Durée avant confirmation :', Math.round((Date.now() - depart) / 1000), 's');
console.log('Confirmation reçue :', confirmation);
if (!confirmation) {
  console.log('Contenu affiché :', (await page.locator('.login-card').innerText()).replace(/\s+/g, ' ').slice(0, 240));
}

if (jeton) {
  console.log('\n--- 4. Page ouverte depuis le lien de l’e-mail ---');
  const base = URL_APP.replace(/\/$/, '');
  await page.goto(`${base}/mot-de-passe/reinitialiser?email=${encodeURIComponent(email)}&jeton=${jeton}`);
  await page.waitForTimeout(1200);
  const formulaire = await page.locator('input[type="password"]').count();
  const texte = (await page.locator('main').innerText()).replace(/\s+/g, ' ').trim();
  console.log('Champs de mot de passe présents :', formulaire);
  console.log('Contenu de la page :', texte.slice(0, 160));
  await page.screenshot({ path: 'tests/qa-mobile/reinitialisation-page.png' });
}

console.log('\nAppels API :', appelsApi.length ? appelsApi : 'aucun');
console.log('Erreurs JavaScript :', erreursConsole.length ? erreursConsole : 'aucune');
await navigateur.close();
