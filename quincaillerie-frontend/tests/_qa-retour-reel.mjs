/**
 * QA RÉALISTE du bouton « Retour à la connexion ».
 *
 * Un vrai utilisateur n'ouvre jamais le lien dans un onglet vierge sans
 * historique : il a d'abord vu l'application. On reproduit donc :
 *   1. visite de la page d'accueil (connexion) ;
 *   2. ouverture du lien reçu par e-mail ;
 *   3. clic sur « Retour à la connexion » ;
 *   4. retour arrière du navigateur.
 *
 * Usage : node tests/_qa-retour-reel.mjs [urlDeBase]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const LIEN = `${BASE}/mot-de-passe/reinitialiser?slug=maquincaillerie&jeton=${'d'.repeat(64)}&email=ksouleymanesoro60%40gmail.com`;

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });
await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

const ecran = async () => {
  const texte = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  return /Adresse Email ou Login/i.test(texte) ? 'CONNEXION'
    : /Réinitialiser le mot de passe/i.test(texte) ? 'RÉINITIALISATION'
    : texte.trim() ? 'AUTRE' : 'PAGE VIDE';
};

// 1. L'utilisateur a d'abord vu l'application.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
console.log('1. Page d\'accueil          :', await ecran());

// 2. Il ouvre le lien reçu par e-mail.
await page.goto(LIEN, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
console.log('2. Lien de l\'e-mail         :', await ecran());

// 3. Clic sur « Retour à la connexion ».
await page.getByText('Retour à la connexion').click();
await page.waitForTimeout(2500);
const apresClic = await ecran();
console.log('3. Après le clic            :', apresClic, '—', page.url());

// 4. Retour arrière du navigateur.
await page.goBack({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(2500);
const apresRetour = await ecran();
console.log('4. Après retour arrière     :', apresRetour, '—', page.url());

const ok = apresClic === 'CONNEXION' && apresRetour !== 'RÉINITIALISATION';
console.log(`\nVERDICT ${ok ? 'OK' : 'KO'} : le clic mène à la connexion, et le retour arrière ne rouvre pas le formulaire.`);

await page.screenshot({ path: 'tests/qa-mobile/retour-connexion.png', fullPage: true });
await navigateur.close();
process.exit(ok ? 0 : 1);
