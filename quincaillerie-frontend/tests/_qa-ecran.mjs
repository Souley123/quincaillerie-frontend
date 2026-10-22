/**
 * QA « première vue » — ce que l'utilisateur voit AU CHARGEMENT, sans défiler.
 *
 * Le script _qa-mobile.mjs photographie la page entière (fullPage) : on ne
 * voyait donc jamais la coupure réelle de l'écran. Ici on capture uniquement
 * la fenêtre visible et on mesure si la carte tient dans l'écran.
 *
 * Usage : node tests/_qa-ecran.mjs [url]
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL_APP = process.argv[2] || 'http://127.0.0.1:3000/';
const CIBLES = [
  { nom: 'android-pixel5', appareil: devices['Pixel 5'] },
  { nom: 'iphone-12', appareil: devices['iPhone 12'] },
  { nom: 'iphone-se', appareil: devices['iPhone SE'] }
];

const mesures = () => {
  const vue = window.innerHeight;
  const carte = document.querySelector('.login-card');
  const bascule = document.querySelector('.login-switch');
  const bouton = document.querySelector('.login-btn');
  const rect = carte ? carte.getBoundingClientRect() : null;
  const rectBouton = bouton ? bouton.getBoundingClientRect() : null;
  return {
    hauteurVue: vue,
    carteHaute: rect ? Math.round(rect.height) : null,
    carteDepasse: rect ? rect.bottom > vue + 1 : null,
    boutonMargeBas: rectBouton ? Math.round(vue - rectBouton.bottom) : null,
    basculeVisible: bascule ? bascule.getBoundingClientRect().bottom <= vue + 1 : null,
    defilementVertical: document.documentElement.scrollHeight > vue + 1
  };
};

await mkdir(new URL('./qa-mobile/', import.meta.url), { recursive: true });
const navigateur = await chromium.launch({ channel: 'chrome' });
const rapport = {};

for (const cible of CIBLES) {
  const contexte = await navigateur.newContext({ ...cible.appareil, locale: 'fr-FR' });
  const page = await contexte.newPage();
  await page.route('**/api/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]'
  }));
  await page.goto(URL_APP, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1000);
  // Position de défilement remise à zéro : capture de la première vue.
  await page.evaluate(() => window.scrollTo(0, 0));
  rapport[cible.nom] = await page.evaluate(mesures);
  const dossier = new URL('./qa-mobile/', import.meta.url);
  await page.screenshot({
    path: decodeURIComponent(dossier.pathname).replace(/^\/(\w:)/, '$1') + `${cible.nom}-vue.png`
  });
  await contexte.close();
}

await navigateur.close();
console.log(JSON.stringify(rapport, null, 2));
