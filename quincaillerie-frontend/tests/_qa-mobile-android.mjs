/**
 * REPRODUCTION MOBILE FIDÈLE (Android réel) : pourquoi l'écran « essai expiré »
 * s'affiche-t-il sur téléphone alors qu'il a disparu sur ordinateur ?
 *
 * Trois différences qu'un test desktop ne voit jamais :
 *   1. le stylet/tactile (`hasTouch`, `isMobile`) ;
 *   2. une fenêtre basse (barre d'adresse Android) ;
 *   3. un verrou local hérité d'une ancienne version du site.
 *
 * Usage : node tests/_qa-mobile-android.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'https://souley123.github.io/quincaillerie-frontend';
const navigateur = await chromium.launch({ channel: 'chrome' });
const rapport = [];

for (const [nom, options] of [
  ['Pixel 5 (réel)', devices['Pixel 5']],
  ['Galaxy S9 (réel)', devices['Galaxy S9+']],
  ['Android portrait étroit', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ['Android paysage', { viewport: { width: 851, height: 393 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]
]) {
  const contexte = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const page = await contexte.newPage();
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    const texte = document.body.innerText.replace(/\s+/g, ' ');
    const panneau = document.querySelector('.login-presentation');
    const carte = document.querySelector('.login-card');
    return {
      largeur: window.innerWidth,
      hauteur: window.innerHeight,
      panneau: panneau ? getComputedStyle(panneau).display : 'absent',
      carteLargeur: carte ? Math.round(carte.getBoundingClientRect().width) : 0,
      connexion: /Adresse Email ou Login/i.test(texte),
      essaiExpire: /période d.essai est expirée|abonnement a expiré/i.test(texte),
      extrait: texte.slice(0, 110)
    };
  });
  rapport.push({ nom, ...m });
  console.log(`${nom} — ${m.largeur}×${m.hauteur}`);
  console.log(`   panneau=${m.panneau} | carte=${m.carteLargeur}px | connexion=${m.connexion} | essaiExpiré=${m.essaiExpiré}`);
  console.log(`   « ${m.extrait} »`);
  await page.screenshot({ path: `tests/qa-mobile/android-${nom.replace(/[^a-z0-9]+/gi, '-')}.png` });
  await contexte.close();
}

await navigateur.close();
const anomalie = rapport.filter(r => r.essaiExpire);
console.log(`\nVERDICT : ${anomalie.length === 0 ? 'aucun écran d\'abonnement sur mobile.' : `${anomalie.length} profil(s) affichent l'écran d'abonnement.`}`);
