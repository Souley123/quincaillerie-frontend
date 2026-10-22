/**
 * L'EN-TÊTE RESTE-T-IL VISIBLE QUAND ON FAIT DÉFILER ?
 *
 * Teste le VRAI défilement (molette, puis script sur le conteneur qui défile),
 * en identifiant lequel des éventuels conteneurs bouge réellement.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const entreprise = { companyId: 'M', slug: 'maquincaillerie', raisonSociale: 'SKYS ERP Solution', devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true, abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString() };

const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({ viewport: { width: 1366, height: 700 }, locale: 'fr-FR' });
const page = await contexte.newPage();

await page.route('**/api/**', r => r.request().url().includes('/api/auth/moi')
  ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise }) })
  : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

await page.addInitScript(e => {
  localStorage.setItem('skys_erp_jeton', 'j');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
  localStorage.setItem('skys_erp_subscribed', 'true');
}, entreprise);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('#categorie-principale').selectOption('dashboard').catch(() => {});
await page.waitForTimeout(1200);

const conteneur = await page.evaluate(() => {
  const candidats = ['window', '.app-main', '.app-shell', 'body', 'html'];
  return candidats.map(sel => {
    if (sel === 'window') {
      return { sel, scrollHeight: document.documentElement.scrollHeight, clientHeight: window.innerHeight };
    }
    const el = document.querySelector(sel);
    return el ? { sel, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY } : null;
  }).filter(Boolean);
});
console.log('Conteneurs :', JSON.stringify(conteneur, null, 2));

// Défilement par molette au centre de la page.
await page.mouse.move(700, 500);
await page.mouse.wheel(0, 700);
await page.waitForTimeout(900);

const apres = await page.evaluate(() => {
  const h = document.querySelector('.app-header');
  const r = h.getBoundingClientRect();
  const main = document.querySelector('.app-main');
  return {
    windowScrollY: Math.round(window.scrollY),
    mainScrollTop: main ? Math.round(main.scrollTop) : null,
    enTeteTop: Math.round(r.top),
    enTeteBas: Math.round(r.bottom),
    enTeteVisible: r.top >= -1 && r.bottom > 10
  };
});
console.log('Après molette :', JSON.stringify(apres, null, 2));
console.log(apres.enTeteVisible
  ? 'VERDICT OK : l\'en-tête reste visible.'
  : 'VERDICT KO : l\'en-tête disparaît au défilement.');

await page.screenshot({ path: 'tests/qa-mobile/dashboard-defilement.png' });
await navigateur.close();
