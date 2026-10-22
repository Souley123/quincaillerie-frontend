/**
 * MESURE DU TABLEAU DU PANIER sur téléphone — cas le plus critique.
 *
 * Le panier est rempli en cliquant sur « Ajouter au panier » (produits
 * fournis par une route simulée). On mesure ensuite :
 *   - largeur page vs écran (débordement de PAGE) ;
 *   - débordements hors du cadre défilant ;
 *   - le tableau DÉFILE-t-il bien dans son cadre ?
 *   - les trois boutons d'action sont-ils dans l'écran ?
 *
 * Usage : node tests/_qa-caisse-tableau.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const navigateur = await chromium.launch({ channel: 'chrome' });

const PROFILS = [
  ['pixel5', devices['Pixel 5']],
  ['iphone-se-320', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]
];

const entreprise = {
  companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test',
  devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

const produits = [
  { _id: 'p1', nom: 'Ciment CIM II 42,5 — sac de 50 kg', prix: 4200, quantiteStock: 120, categorie: 'Matériaux', codeBarre: '1234567890123', reference: '1234567890123' },
  { _id: 'p2', nom: 'Fer à béton 12 mm x 12 m (barre)', prix: 9500, quantiteStock: 60, categorie: 'Matériaux', codeBarre: '7654321098765', reference: '7654321098765' }
];

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
    // Toute lecture de produits renvoie le catalogue de test.
    if (/produit|stock|article|catalog/i.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(produits) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.addInitScript(({ e, p }) => {
    localStorage.setItem('skys_erp_jeton', 'jeton-test');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: 'u1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
    localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
    localStorage.setItem('skys_erp_subscribed', 'true');
    // Catalogue local : plusieurs clés possibles selon la version de l'app.
    ['erp_produits', 'erp_products', 'erp_catalogue', 'produits'].forEach(cle => {
      localStorage.setItem(cle, JSON.stringify(p));
    });
  }, { e: entreprise, p: produits });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const menu = page.locator('.app-menu-toggle');
  if (await menu.count()) { await menu.click().catch(() => {}); await page.waitForTimeout(400); }
  await page.getByText(/Caisse & Transactions/).first().click().catch(() => {});
  await page.waitForTimeout(1500);

  // 1) Sélection dans la liste (si le catalogue est chargé).
  const select = page.locator('.caisse-grille select').first();
  let ajoute = false;
  if (await select.count()) {
    const valeurs = await select.locator('option').evaluateAll(liste => liste.map(o => o.value).filter(Boolean));
    if (valeurs.length) {
      for (const valeur of valeurs.slice(0, 2)) {
        await select.selectOption(valeur).catch(() => {});
        await page.getByRole('button', { name: 'Ajouter au panier' }).first().click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
      ajoute = await page.locator('.caisse-table-panier').count() > 0;
    }
  }

  // 2) Repli : saisie d'un code-barres dans la barre de scan.
  if (!ajoute) {
    const champ = page.locator('#saisie-manuelle-code, .scan-bar input').first();
    if (await champ.count()) {
      await champ.fill('1234567890123').catch(() => {});
      await champ.press('Enter').catch(() => {});
      await page.waitForTimeout(900);
      ajoute = await page.locator('.caisse-table-panier').count() > 0;
    }
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
        debordements.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} → ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    });
    const actions = [...document.querySelectorAll('.caisse-actions button')].map(b => {
      const r = b.getBoundingClientRect();
      return { texte: b.innerText.trim().slice(0, 16), gauche: Math.round(r.left), droite: Math.round(r.right), largeur: Math.round(r.width), dansEcran: r.left >= -1 && r.right <= largeur + 1 };
    });
    return {
      largeurEcran: largeur,
      largeurPage: document.documentElement.scrollWidth,
      tableauPresent: Boolean(table),
      cadreDefilant: Boolean(cadre),
      cadreLargeur: cadre ? Math.round(cadre.getBoundingClientRect().width) : 0,
      tableLargeur: table ? Math.round(table.getBoundingClientRect().width) : 0,
      defileHorizontal: cadre ? cadre.scrollWidth > cadre.clientWidth : null,
      debordements,
      actions
    };
  });

  console.log(`\n=== ${nom} — panier rempli : ${ajoute} ===`);
  console.log(JSON.stringify(mesure, null, 2));
  await page.screenshot({ path: `tests/qa-mobile/caisse-tableau-${nom}.png`, fullPage: true });

  await contexte.close();
}

await navigateur.close();
