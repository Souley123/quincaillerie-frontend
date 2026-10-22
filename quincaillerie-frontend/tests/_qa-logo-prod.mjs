/**
 * VÉRIFICATION EN LIGNE du logo SKYS (ordinateur + téléphone).
 *
 * Contrôle que l'image est réellement CHARGÉE (pas de 404 sur GitHub Pages,
 * où un chemin absolu « /logo-skys.svg » renverrait la racine du domaine) et
 * qu'elle reste nette à l'échelle affichée.
 *
 * Usage : node tests/_qa-logo-prod.mjs
 */
import { chromium, devices } from 'playwright';

const BASE = 'https://souley123.github.io/quincaillerie-frontend';
const navigateur = await chromium.launch({ channel: 'chrome' });

for (const [nom, options] of [
  ['ordinateur', { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 }],
  ['pixel5', devices['Pixel 5']],
  ['iphone-se', devices['iPhone SE']]
]) {
  const contexte = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const page = await contexte.newPage();
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  const demandesLogo = [];
  page.on('response', reponse => {
    if (/logo-skys/.test(reponse.url())) demandesLogo.push(`${reponse.status()} ${reponse.url()}`);
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => [...document.querySelectorAll('.login-presentation-logo, .login-brand-logo')]
    .filter(img => img.getBoundingClientRect().width > 0)
    .map(img => {
      const r = img.getBoundingClientRect();
      return {
        source: img.getAttribute('src'),
        affiche: `${Math.round(r.width)}×${Math.round(r.height)}`,
        charge: img.complete && img.naturalWidth > 0
      };
    }));

  console.log(`${nom} — logo(s) visibles : ${info.length}`);
  demandesLogo.forEach(ligne => console.log(`   réseau : ${ligne}`));
  info.forEach(logo => console.log(`   ${logo.source} → ${logo.affiche} | chargé=${logo.charge}`));
  if (!info.length || !info.every(logo => logo.charge)) console.log('   ⚠ PROBLÈME : logo absent ou image non chargée');

  await page.screenshot({ path: `tests/qa-mobile/prod-logo-${nom}.png` });
  await contexte.close();
}

await navigateur.close();
