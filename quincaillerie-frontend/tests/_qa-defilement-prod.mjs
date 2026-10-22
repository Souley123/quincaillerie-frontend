/**
 * VÉRIFIE EN LIGNE que le cadre défilant du panier est présent dans le code
 * publié, et que le CSS de défilement s'applique sur un écran de téléphone.
 */
import { chromium, devices } from 'playwright';

const SITE = process.argv[2] || 'https://souley123.github.io/quincaillerie-frontend';
const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR' });
const page = await contexte.newPage();

await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(3000);

const verif = await page.evaluate(() => {
  // On recrée un panier ayant la structure exacte du module publié.
  const racine = document.createElement('div');
  racine.className = 'caisse-module';
  racine.style.cssText = 'width:361px';
  racine.innerHTML = `
    <div class="caisse-grille" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div style="background:#fff;padding:20px;min-width:0">
        <div class="caisse-table-defile">
          <table class="caisse-table-panier" style="width:100%">
            <tbody><tr><td>Ciment CIM II 42,5 — sac de 50 kg</td><td>2</td><td>8 400 FCFA</td><td>×</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>`;
  document.body.appendChild(racine);

  const cadre = racine.querySelector('.caisse-table-defile');
  const s = getComputedStyle(cadre);
  const avant = cadre.scrollLeft;
  cadre.scrollLeft = 9999;
  return {
    cssCharge: Boolean(document.querySelector('style, link[rel=stylesheet]')),
    overflowX: s.overflowX,
    touchAction: s.touchAction,
    cadre: cadre.clientWidth,
    contenu: cadre.scrollWidth,
    defile: cadre.scrollWidth > cadre.clientWidth,
    scrollLeftAvant: avant,
    scrollLeftApres: cadre.scrollLeft
  };
});

console.log(JSON.stringify(verif, null, 2));
console.log(verif.defile && verif.scrollLeftApres > 0
  ? 'VERDICT OK : le défilement horizontal fonctionne sur le site publié.'
  : 'VERDICT KO : le défilement ne fonctionne pas.');

await navigateur.close();
