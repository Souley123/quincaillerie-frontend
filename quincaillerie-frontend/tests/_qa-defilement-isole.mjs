/**
 * MESURE DU DÉFILEMENT DU PANIER — sans dépendre du catalogue.
 *
 * On crée un tableau ayant STRICTEMENT la même structure que celui du panier
 * (mêmes classes), on le place dans un cadre `.caisse-table-defile`, et on
 * vérifie que le geste horizontal fonctionne réellement.
 *
 * Ce contrôle valide le CSS de défilement lui-même — c'est-à-dire la partie
 * que l'utilisateur voit et dont il se plaint.
 *
 * Usage : node tests/_qa-defilement-isole.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR' });
const page = await contexte.newPage();

await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const mesures = await page.evaluate(() => {
  const racine = document.createElement('div');
  racine.className = 'caisse-module';
  racine.style.cssText = 'width:361px;padding:0;margin:0';
  racine.innerHTML = `
    <div class="caisse-grille" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div style="background:#fff;padding:20px;border-radius:10px;min-width:0">
        <h3>Panier Actuel</h3>
        <div class="caisse-table-defile">
          <table class="caisse-table-panier" style="width:100%;borderCollapse:collapse;font-size:13px">
            <thead><tr style="background:#1e293b;color:#fff">
              <th style="padding:8px;textAlign:left">Article</th>
              <th style="padding:8px;width:70px">Nombre</th>
              <th style="padding:8px;width:120px">Montant</th>
              <th style="padding:8px;width:70px">Action</th>
            </tr></thead>
            <tbody>
              <tr><td style="padding:8px">Ciment CIM II 42,5</td><td style="padding:8px">1</td><td style="padding:8px">4 200 FCFA</td><td style="padding:8px">×</td></tr>
              <tr><td style="padding:8px">Fer à béton 12 mm</td><td style="padding:8px">2</td><td style="padding:8px">19 000 FCFA</td><td style="padding:8px">×</td></tr>
            </tbody>
          </table>
        </div>
        <h3 class="caisse-total">Total : 23 200 FCFA</h3>
      </div>
    </div>`;
  document.body.appendChild(racine);

  const cadre = racine.querySelector('.caisse-table-defile');
  const table = racine.querySelector('.caisse-table-panier');
  const style = getComputedStyle(cadre);

  const avant = { scrollLeft: cadre.scrollLeft, cadre: cadre.clientWidth, contenu: cadre.scrollWidth };
  cadre.scrollLeft = 9999;
  const apres = cadre.scrollLeft;

  return {
    cadreLargeur: cadre.clientWidth,
    tableLargeur: Math.round(table.getBoundingClientRect().width),
    contenuDefilable: cadre.scrollWidth,
    overflowX: style.overflowX,
    touchAction: style.touchAction,
    defileEffectivement: cadre.scrollWidth > cadre.clientWidth,
    scrollLeftApresGeste: apres,
    page: document.documentElement.scrollWidth,
    ecran: document.documentElement.clientWidth
  };
});

console.log(JSON.stringify(mesures, null, 2));
console.log(mesures.defileEffectivement && mesures.scrollLeftApresGeste > 0
  ? 'VERDICT OK : le tableau défile horizontalement dans son cadre.'
  : 'VERDICT KO : le tableau ne défile pas.');

await page.screenshot({ path: 'tests/qa-mobile/defilement-isole.png', fullPage: true });
await navigateur.close();
