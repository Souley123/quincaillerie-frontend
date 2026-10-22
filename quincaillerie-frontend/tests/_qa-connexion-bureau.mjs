/**
 * QA : la connexion sur ORDINATEUR (et non plus une carte étroite centrée).
 *
 * Usage : node tests/_qa-connexion-bureau.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';

const navigateur = await chromium.launch({ channel: 'chrome' });

const CASES = [
  ['ordinateur-1920x1080', { viewport: { width: 1920, height: 1080 } }],
  ['ordinateur-1366x768', { viewport: { width: 1366, height: 768 } }],
  ['tablette-820x1180', { ...devices['iPad Air'] }],
  ['mobile-se', { ...devices['iPhone SE'] }]
];

for (const [nom, options] of CASES) {
  const contexte = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const page = await contexte.newPage();
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  const mesures = await page.evaluate(() => {
    const panneau = document.querySelector('.login-presentation');
    const carte = document.querySelector('.login-card');
    const rect = carte.getBoundingClientRect();
    const stylePanneau = panneau ? getComputedStyle(panneau) : null;
    return {
      panneauVisible: stylePanneau ? stylePanneau.display !== 'none' : false,
      carteLargeur: Math.round(rect.width),
      carteGauche: Math.round(rect.left),
      debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
      hauteurEcran: window.innerHeight
    };
  });

  console.log(`${nom}`);
  console.log(`  panneau de présentation : ${mesures.panneauVisible ? 'affiché' : 'masqué'}`);
  console.log(`  carte : ${mesures.carteLargeur} px, à ${mesures.carteGauche} px du bord`);
  console.log(`  débordement horizontal  : ${mesures.debordement}`);
  await page.screenshot({ path: `tests/qa-mobile/bureau-${nom}.png`, fullPage: true });
  await contexte.close();
}

await navigateur.close();
