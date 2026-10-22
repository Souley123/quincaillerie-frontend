/**
 * POURQUOI LE TIROIR RESTE OUVERT SUR iPhone SE (320 px) ?
 *
 * Rejoue le parcours réel et enregistre l'état du tiroir après chaque action,
 * pour localiser le moment exact où il ne se referme pas.
 *
 * Usage : node tests/_qa-tiroir-diagnostic.mjs [urlFront]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
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
}, entreprise);

const etat = async libelle => {
  const info = await page.evaluate(() => ({
    ouvert: Boolean(document.querySelector('.app-sidebar-ouverte')),
    overlay: Boolean(document.querySelector('.app-sidebar-overlay')),
    select: document.querySelector('#categorie-principale')?.value || null,
    caisse: Boolean(document.querySelector('.caisse-module')),
    transform: document.querySelector('.app-sidebar') ? getComputedStyle(document.querySelector('.app-sidebar')).transform : null
  }));
  console.log(`${libelle} → ${JSON.stringify(info)}`);
};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await etat('1. chargement');

await page.locator('.app-menu-toggle').click();
await page.waitForTimeout(600);
await etat('2. menu ouvert');

// Changer le module par la liste déroulante, comme l'utilisateur.
await page.locator('#categorie-principale').selectOption('transaction');
await page.waitForTimeout(1500);
await etat('3. Caisse choisie');

// Forcer un changement de module supplémentaire puis revenir.
await page.locator('.app-menu-toggle').click().catch(() => {});
await page.waitForTimeout(500);
await etat('4. menu réouvert');

await page.locator('#categorie-principale').selectOption('dashboard').catch(() => {});
await page.waitForTimeout(1200);
await etat('5. Dashboard choisi');

await page.screenshot({ path: 'tests/qa-mobile/tiroir-diagnostic.png', fullPage: false });
await navigateur.close();
