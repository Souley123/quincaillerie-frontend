/**
 * QA : le logo SKYS est-il bien visible, net et correctement dimensionné
 * sur ordinateur ET sur téléphone ?
 *
 * Usage : node tests/_qa-logo-connexion.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const navigateur = await chromium.launch({ channel: 'chrome' });

for (const [nom, options] of [
  ['ordinateur-1920', { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 }],
  ['pixel5', devices['Pixel 5']],
  ['iphone-se', devices['iPhone SE']]
]) {
  const contexte = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const page = await contexte.newPage();
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const info = await page.evaluate(() => {
    const logos = [...document.querySelectorAll('.login-presentation-logo, .login-brand-logo')]
      .filter(img => img.getBoundingClientRect().width > 0)
      .map(img => {
        const r = img.getBoundingClientRect();
        return {
          classe: img.className,
          largeur: Math.round(r.width),
          hauteur: Math.round(r.height),
          charge: img.complete && img.naturalWidth > 0,
          naturelle: `${img.naturalWidth}×${img.naturalHeight}`
        };
      });
    return { largeurEcran: window.innerWidth, logos };
  });

  console.log(`${nom} (${info.largeurEcran} px) — logos visibles : ${info.logos.length}`);
  info.logos.forEach(l => console.log(`   ${l.classe} : ${l.largeur}×${l.hauteur} px | chargé=${l.charge} | source ${l.naturelle}`));
  if (info.logos.length === 0) console.log('   ⚠ AUCUN logo visible');
  const tropLarge = info.logos.filter(l => l.largeur > info.largeurEcran * 0.8);
  if (tropLarge.length) console.log('   ⚠ logo trop large pour l’écran');

  await page.screenshot({ path: `tests/qa-mobile/logo-${nom}.png` });
  await contexte.close();
}

await navigateur.close();
