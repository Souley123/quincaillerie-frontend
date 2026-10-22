/**
 * Pourquoi deux tranches du camembert n'ont-elles pas de nom ?
 * (« — 11 % » et « Non classé — 22 % »)
 */
import { chromium } from 'playwright';

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await (await navigateur.newContext({ locale: 'fr-FR' })).newPage();

const entreprise = { companyId: 'M', slug: 'm', raisonSociale: 'T', devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true, abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString() };
const catalogue = [
  { _id: '1', ref: 'A', nom: 'Article sans famille', famille: '', prix: 1000, quantiteStock: 5, minStock: 1 },
  { _id: '2', ref: 'B', nom: 'Article famille vide', famille: '   ', prix: 1000, quantiteStock: 5, minStock: 1 },
  { _id: '3', ref: 'C', nom: 'Ciment', famille: 'Matériaux', prix: 1000, quantiteStock: 5, minStock: 1 }
];

await page.route('**/api/**', r => {
  const u = r.request().url();
  if (u.includes('/api/auth/moi')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise }) });
  if (u.includes('/api/products')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalogue) });
  return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await page.addInitScript(e => {
  localStorage.setItem('skys_erp_jeton', 'j');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
  localStorage.setItem('skys_erp_subscribed', 'true');
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
}, entreprise);

await page.goto(process.argv[2] || 'http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.locator('#categorie-principale').selectOption('dashboard').catch(() => {});
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const pan = [...document.querySelectorAll('.dashboard-panel')].find(p => /Articles par famille/i.test(p.innerText));
  if (!pan) return null;
  const svg = pan.querySelector('svg[aria-label^="Répartition"]');
  return {
    legende: pan.innerText.replace(/\s+/g, ' ').slice(0, 300),
    tranches: svg ? [...svg.querySelectorAll('path title')].map(t => t.textContent) : []
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'tests/qa-mobile/camembert-sans-nom.png' });
await navigateur.close();
