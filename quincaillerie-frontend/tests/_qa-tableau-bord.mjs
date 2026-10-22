/**
 * QA tableau de bord (ordinateur) : bandeau compact + en-tête collant.
 *
 * Usage : node tests/_qa-tableau-bord.mjs [urlFront]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const entreprise = {
  companyId: 'M', slug: 'maquincaillerie', raisonSociale: 'SKYS ERP Solution', devise: 'FCFA',
  tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({ viewport: { width: 1832, height: 858 }, locale: 'fr-FR' });
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
await page.waitForTimeout(1800);

/* L'application ouvre le dernier onglet mémorisé. On force explicitement le
   tableau de bord : sans cela, le test mesurait la Caisse. */
await page.locator('#categorie-principale').selectOption('dashboard').catch(() => {});
await page.waitForTimeout(1500);

const surDashboard = await page.evaluate(() => Boolean(document.querySelector('.dashboard-welcome')));
console.log('Tableau de bord affiché :', surDashboard);

const avant = await page.evaluate(() => {
  const b = document.querySelector('.dashboard-welcome');
  const h = document.querySelector('.app-header');
  return {
    bandeauHauteur: b ? Math.round(b.getBoundingClientRect().height) : null,
    bandeauPadding: b ? getComputedStyle(b).padding : null,
    titreTaille: b?.querySelector('h3') ? getComputedStyle(b.querySelector('h3')).fontSize : null,
    enTeteHauteur: h ? Math.round(h.getBoundingClientRect().height) : null,
    enTetePosition: h ? getComputedStyle(h).position : null
  };
});
console.log('Avant défilement :', JSON.stringify(avant, null, 2));

await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(600);

const apres = await page.evaluate(() => {
  const h = document.querySelector('.app-header');
  const r = h.getBoundingClientRect();
  return {
    defilement: Math.round(window.scrollY),
    enTeteTop: Math.round(r.top),
    enTeteVisible: r.top >= -1 && r.top < 120,
    titreAffiche: h.innerText.replace(/\s+/g, ' ').slice(0, 60)
  };
});
console.log('Après défilement de 600 px :', JSON.stringify(apres, null, 2));
console.log(apres.enTeteVisible
  ? 'VERDICT OK : l\'en-tête reste visible pendant le défilement.'
  : 'VERDICT KO : l\'en-tête disparaît.');

await page.screenshot({ path: 'tests/qa-mobile/dashboard-entete-collant.png' });
await navigateur.close();
