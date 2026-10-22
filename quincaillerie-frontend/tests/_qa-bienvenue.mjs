/** Mesure le bandeau de bienvenue avant/après réduction. */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const entreprise = { companyId: 'M', slug: 'maquincaillerie', raisonSociale: 'SKYS ERP Solution', devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true, abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString() };

const navigateur = await chromium.launch({ channel: 'chrome' });

for (const [nom, viewport, mobile] of [['ordinateur-1832', { width: 1832, height: 858 }, false], ['telephone-393', { width: 393, height: 851 }, true]]) {
  const contexte = await navigateur.newContext({ viewport, isMobile: mobile, hasTouch: mobile, locale: 'fr-FR' });
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

  const m = await page.evaluate(() => {
    const bandeau = document.querySelector('.dashboard-welcome');
    if (!bandeau) return null;
    const r = bandeau.getBoundingClientRect();
    const h3 = bandeau.querySelector('h3');
    const p = bandeau.querySelector('p');
    return {
      hauteur: Math.round(r.height),
      padding: getComputedStyle(bandeau).padding,
      titreTaille: h3 ? getComputedStyle(h3).fontSize : null,
      texteTaille: p ? getComputedStyle(p).fontSize : null,
      largeur: Math.round(r.width)
    };
  });
  console.log(`${nom} →`, JSON.stringify(m));
  await page.screenshot({ path: `tests/qa-mobile/bienvenue-${nom}.png` });
  await contexte.close();
}

await navigateur.close();
