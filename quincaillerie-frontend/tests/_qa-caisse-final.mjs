/**
 * MESURE FINALE — Caisse & Transactions sur téléphone.
 *
 * Corrections par rapport aux essais précédents :
 *   - on ferme le TIROIR après avoir cliqué dans le menu (il restait ouvert
 *     dans les tests, masquant la page et empêchant toute mesure utile) ;
 *   - on remplit le panier en cliquant sur le premier article de la liste.
 *
 * Usage : node tests/_qa-caisse-final.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const navigateur = await chromium.launch({ channel: 'chrome' });

const PROFILS = [
  ['pixel5', devices['Pixel 5']],
  ['iphone-se-320', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['android-360', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }]
];

const entreprise = {
  companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test',
  devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

for (const [nom, options] of PROFILS) {
  const contexte = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const page = await contexte.newPage();

  await page.route('**/api/**', route => {
    const url = route.request().url();
    if (url.includes('/api/auth/moi')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ utilisateur: { id: 'u1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise })
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.addInitScript(e => {
    localStorage.setItem('skys_erp_jeton', 'jeton-test');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: 'u1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
    localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
    localStorage.setItem('skys_erp_subscribed', 'true');
    /* Le catalogue vit en localStorage sous `erp_products` (voir App.js).
       Noms LONGS : c'est le cas qui fait déborder le tableau du panier. */
    const catalogue = [
      { ref: 'CIM-42-50', nom: 'Ciment CIM II 42,5 — sac de 50 kg', famille: 'Matériaux', prix: 4200, quantiteStock: 120, minStock: 10, codeBarre: '1234567890123' },
      { ref: 'FER-12-12', nom: 'Fer à béton 12 mm x 12 m (barre)', famille: 'Matériaux', prix: 9500, quantiteStock: 60, minStock: 10, codeBarre: '7654321098765' }
    ];
    localStorage.setItem('erp_products', JSON.stringify(catalogue));
  }, entreprise);

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Ouvrir le tiroir, cliquer sur le module, puis FERMER le tiroir.
  await page.locator('.app-menu-toggle').click().catch(() => {});
  await page.waitForTimeout(500);
  await page.getByText(/Caisse & Transactions/).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const voile = page.locator('.app-sidebar-overlay');
  if (await voile.count()) { await voile.click({ force: true }).catch(() => {}); }
  await page.waitForTimeout(600);

  const tiroirOuvert = await page.locator('.app-sidebar-ouverte').count();

  // Remplir le panier via la liste : une option par produit chargé.
  const select = page.locator('.caisse-grille select').first();
  let lignes = 0;
  if (await select.count()) {
    const valeurs = await select.locator('option').evaluateAll(l => l.map(o => o.value).filter(Boolean));
    for (const valeur of valeurs.slice(0, 2)) {
      await select.selectOption(valeur).catch(() => {});
      await page.getByRole('button', { name: 'Ajouter au panier' }).first().click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    lignes = await page.locator('.caisse-table-panier tbody tr').count();
  }

  const mesure = await page.evaluate(() => {
    const largeur = document.documentElement.clientWidth;
    const cadre = document.querySelector('.caisse-table-defile');
    const table = document.querySelector('.caisse-table-panier');
    const debordements = [];
    document.querySelectorAll('.caisse-module *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (el.closest('.caisse-table-defile') && el !== cadre) return;
      if (r.right > largeur + 1 || r.left < -1) {
        debordements.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    });
    const actions = [...document.querySelectorAll('.caisse-actions button')].map(b => {
      const r = b.getBoundingClientRect();
      return `${b.innerText.trim().slice(0, 14)} ${Math.round(r.width)}px ${r.left >= -1 && r.right <= largeur + 1 ? 'OK' : 'HORS ÉCRAN'}`;
    });
    return {
      ecran: largeur,
      page: document.documentElement.scrollWidth,
      colonnes: document.querySelector('.caisse-grille') ? getComputedStyle(document.querySelector('.caisse-grille')).gridTemplateColumns : null,
      tableau: Boolean(table),
      cadre: cadre ? `${Math.round(cadre.getBoundingClientRect().width)}px` : null,
      defile: cadre ? cadre.scrollWidth > cadre.clientWidth : null,
      debordements,
      actions
    };
  });

  console.log(`\n=== ${nom} ===`);
  console.log(`tiroir encore ouvert : ${tiroirOuvert} | lignes ajoutées : ${lignes}`);
  console.log(JSON.stringify(mesure, null, 2));
  await page.screenshot({ path: `tests/qa-mobile/caisse-final-${nom}.png`, fullPage: true });

  await contexte.close();
}

await navigateur.close();
