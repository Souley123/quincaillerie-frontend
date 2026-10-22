/**
 * VÉRIFICATION EN LIGNE de la Caisse sur petit écran (320 px).
 * Mesure la page PUBLIÉE (GitHub Pages), pas le serveur local.
 */
import { chromium } from 'playwright';

const SITE = 'https://souley123.github.io/quincaillerie-frontend';

const entreprise = {
  companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test',
  devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({
  viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR'
});
const page = await contexte.newPage();

await page.route('**/api/**', route => {
  if (route.request().url().includes('/api/auth/moi')) {
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ utilisateur: { id: 'u1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise })
    });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await page.addInitScript(e => {
  localStorage.setItem('skys_erp_jeton', 'jeton-test');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: 'u1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
  localStorage.setItem('skys_erp_subscribed', 'true');
}, entreprise);

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(3000);

await page.locator('.app-menu-toggle').click({ timeout: 20000 });
await page.waitForTimeout(600);
await page.locator('#categorie-principale').selectOption('transaction');
await page.waitForTimeout(2000);

const mesure = await page.evaluate(() => {
  const grille = document.querySelector('.caisse-grille');
  return {
    ecran: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    grilleLargeur: grille ? Math.round(grille.getBoundingClientRect().width) : null,
    colonnes: grille ? getComputedStyle(grille).gridTemplateColumns : null,
    cartesLargeur: grille ? [...grille.children].map(c => Math.round(c.getBoundingClientRect().width)) : [],
    cartesGauche: grille ? [...grille.children].map(c => Math.round(c.getBoundingClientRect().left)) : [],
    caisseAffichee: Boolean(document.querySelector('.caisse-module'))
  };
});
console.log(JSON.stringify(mesure, null, 2));

await page.screenshot({ path: 'tests/qa-mobile/prod-caisse-320.png', fullPage: true });
await navigateur.close();
