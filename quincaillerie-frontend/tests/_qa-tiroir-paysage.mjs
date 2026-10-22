/** Diagnostic : le tiroir se referme-t-il en PAYSAGE (915×412) ? */
import { chromium } from 'playwright';

const SITE = process.argv[2] || 'http://localhost:3000';
const entreprise = { companyId: 'M', slug: 'maquincaillerie', raisonSociale: 'T', devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true, abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString() };

const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR' });
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

const etat = async libelle => {
  const i = await page.evaluate(() => ({
    ouvert: Boolean(document.querySelector('.app-sidebar-ouverte')),
    voile: Boolean(document.querySelector('.app-sidebar-overlay')),
    sidebarVisible: (() => {
      const s = document.querySelector('.app-sidebar');
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return { gauche: Math.round(r.left), droite: Math.round(r.right), largeur: Math.round(r.width) };
    })(),
    select: document.querySelector('#categorie-principale')?.value || null,
    caisse: Boolean(document.querySelector('.caisse-module'))
  }));
  console.log(`${libelle} → ${JSON.stringify(i)}`);
};

await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(2500);
await etat('1. chargement');
await page.locator('.app-menu-toggle').click();
await page.waitForTimeout(600);
await etat('2. menu ouvert');
await page.locator('#categorie-principale').selectOption('transaction');
await page.waitForTimeout(2000);
await etat('3. après sélection');

await navigateur.close();
