/**
 * MESURE DIRECTE du module Caisse sur iPhone SE, avec calculs détaillés.
 * But : savoir si « 288px » est UNE colonne (correct) ou un défaut.
 */
import { chromium } from 'playwright';

const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({
  viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR'
});
const page = await contexte.newPage();

const entreprise = {
  companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test',
  devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

await page.route('**/api/**', route => {
  if (route.request().url().includes('/api/auth/moi')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ utilisateur: { id: 'u1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise }) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await page.addInitScript(e => {
  localStorage.setItem('skys_erp_jeton', 'jeton-test');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: 'u1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
  localStorage.setItem('skys_erp_subscribed', 'true');
  localStorage.setItem('erp_products', JSON.stringify([
    { ref: 'CIM-42-50', nom: 'Ciment CIM II 42,5 — sac de 50 kg', famille: 'Matériaux', prix: 4200, quantiteStock: 120, minStock: 10, codeBarre: '1234567890123' },
    { ref: 'FER-12-12', nom: 'Fer à béton 12 mm x 12 m (barre)', famille: 'Matériaux', prix: 9500, quantiteStock: 60, minStock: 10, codeBarre: '7654321098765' }
  ]));
}, entreprise);

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('.app-menu-toggle').click();
await page.waitForTimeout(500);
await page.locator('#categorie-principale').selectOption('transaction');
await page.waitForTimeout(1500);

// Remplir le panier par la liste déroulante des articles.
const select = page.locator('.caisse-grille select').first();
const valeurs = await select.locator('option').evaluateAll(l => l.map(o => o.value).filter(Boolean));
console.log('Options du catalogue :', valeurs.length);
for (const v of valeurs.slice(0, 2)) {
  await select.selectOption(v).catch(() => {});
  await page.getByRole('button', { name: 'Ajouter au panier' }).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
}

const d = await page.evaluate(() => {
  const g = document.querySelector('.caisse-grille');
  const cartes = g ? [...g.children] : [];
  const t = document.querySelector('.caisse-table-panier');
  const cadre = document.querySelector('.caisse-table-defile');
  return {
    ecran: document.documentElement.clientWidth,
    grilleLargeur: g ? Math.round(g.getBoundingClientRect().width) : null,
    colonnesCalculees: g ? getComputedStyle(g).gridTemplateColumns : null,
    nbCartes: cartes.length,
    cartesPositions: cartes.map(c => {
      const r = c.getBoundingClientRect();
      return { gauche: Math.round(r.left), largeur: Math.round(r.width), memeLigneQueLaPrecedente: null };
    }),
    lignesPanier: t ? t.querySelectorAll('tbody tr').length : 0,
    tableLargeur: t ? Math.round(t.getBoundingClientRect().width) : null,
    cadreLargeur: cadre ? Math.round(cadre.getBoundingClientRect().width) : null,
    cadreDefile: cadre ? cadre.scrollWidth > cadre.clientWidth : null,
    pageLargeur: document.documentElement.scrollWidth
  };
});
console.log(JSON.stringify(d, null, 2));
await page.screenshot({ path: 'tests/qa-mobile/caisse-direct-320.png', fullPage: true });
await navigateur.close();
