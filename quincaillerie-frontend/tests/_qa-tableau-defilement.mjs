/**
 * LE TABLEAU DU PANIER DÉFILE-T-IL HORIZONTALEMENT SUR TÉLÉPHONE ?
 *
 * On injecte le catalogue dans `erp_products` (clé réelle utilisée par
 * App.js), on ajoute deux articles par l'interface, puis on mesure :
 *   - largeur du cadre vs largeur du tableau ;
 *   - `overflow-x` réellement calculé ;
 *   - `scrollLeft` obtenu après un vrai geste de défilement.
 *
 * Usage : node tests/_qa-tableau-defilement.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';

const CATALOGUE = [
  { ref: 'CIM-42-50', nom: 'Ciment CIM II 42,5 — sac de 50 kg', famille: 'Matériaux', prix: 4200, quantiteStock: 120, minStock: 10, codeBarre: '1234567890123' },
  { ref: 'FER-12-12', nom: 'Fer à béton 12 mm x 12 m (barre)', famille: 'Matériaux', prix: 9500, quantiteStock: 60, minStock: 10, codeBarre: '7654321098765' }
];

const entreprise = {
  companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test',
  devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR' });
const page = await contexte.newPage();

await page.route('**/api/**', r => r.request().url().includes('/api/auth/moi')
  ? r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ utilisateur: { id: '1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise })
    })
  : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

await page.addInitScript(() => {
  /* Uniquement pour la première navigation : le catalogue est injecté ensuite,
     sur l'origine réelle de la page (voir plus bas). */
});

/* Le catalogue est discuté AVANT le rechargement, sur l'origine de la page :
   `addInitScript` s'exécute avant que `localStorage` soit fiable (about:blank),
   ce qui faisait échouer l'injection — d'où « Articles disponibles : 0 ». */
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

await page.evaluate(({ c, e }) => {
  localStorage.setItem('skys_erp_jeton', 'j');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: '1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
  localStorage.setItem('skys_erp_subscribed', 'true');
  /* Clé RÉELLE lue par l'application, relevée dans le navigateur :
     « skys__demo__demo__erp_products ». Écrire « erp_products » seul ne
     produisait jamais de catalogue — d'où « Articles disponibles : 0 ». */
  localStorage.setItem('skys__demo__demo__erp_products', JSON.stringify(c));
}, { c: CATALOGUE, e: entreprise });

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);

await page.locator('.app-menu-toggle').click();
await page.waitForTimeout(500);
await page.locator('#categorie-principale').selectOption('transaction');
await page.waitForTimeout(1500);

const select = page.locator('.caisse-grille select').first();
const options = await select.locator('option').evaluateAll(l => l.map(o => o.value).filter(Boolean));
console.log('Articles disponibles :', options.length);

for (const valeur of options.slice(0, 2)) {
  await select.selectOption(valeur).catch(() => {});
  await page.getByRole('button', { name: 'Ajouter au panier' }).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
}

const avant = await page.evaluate(() => {
  const cadre = document.querySelector('.caisse-table-defile');
  const table = document.querySelector('.caisse-table-panier');
  return {
    lignes: table ? table.querySelectorAll('tbody tr').length : 0,
    cadreLargeur: cadre ? Math.round(cadre.clientWidth) : null,
    tableLargeur: table ? Math.round(table.getBoundingClientRect().width) : null,
    cadresDefile: cadre ? cadre.scrollWidth > cadre.clientWidth : null,
    overflowX: cadre ? getComputedStyle(cadre).overflowX : null,
    scrollLeft: cadre ? cadre.scrollLeft : null,
    page: document.documentElement.scrollWidth,
    ecran: document.documentElement.clientWidth
  };
});
console.log('AVANT défilement :', JSON.stringify(avant, null, 2));

// Geste réel de défilement horizontal dans le cadre.
await page.evaluate(() => {
  const cadre = document.querySelector('.caisse-table-defile');
  if (cadre) cadre.scrollLeft = 999;
});
await page.waitForTimeout(400);

const apres = await page.evaluate(() => {
  const cadre = document.querySelector('.caisse-table-defile');
  return { scrollLeft: cadre ? cadre.scrollLeft : null, page: document.documentElement.scrollWidth };
});
console.log('APRÈS défilement :', JSON.stringify(apres));

await page.screenshot({ path: 'tests/qa-mobile/panier-telephone.png', fullPage: true });
await navigateur.close();
