/**
 * VÉRIFIE les retouches ordinateur (1832 × 858) : boutons flottants,
 * bouton de fermeture du tiroir, cartes de la caisse.
 */
import { chromium } from 'playwright';

const entreprise = {
  companyId: 'M', slug: 'maquincaillerie', raisonSociale: 'T', devise: 'FCFA',
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

await page.goto(process.argv[2] || 'http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('#categorie-principale').selectOption('transaction');
await page.waitForTimeout(1500);

const resultat = await page.evaluate(() => {
  const bornes = el => {
    const r = el.getBoundingClientRect();
    return { gauche: Math.round(r.left), droite: Math.round(r.right), bas: Math.round(r.bottom) };
  };
  const boutons = [...document.querySelectorAll('button[aria-label]')]
    .filter(b => /accessibil|assistant/i.test(b.getAttribute('aria-label')))
    .map(b => ({ etiquette: b.getAttribute('aria-label').slice(0, 26), ...bornes(b) }));

  const fermeture = document.querySelector('.app-sidebar-close');
  const cartes = [...document.querySelectorAll('.caisse-grille > div')].map(c => {
    const r = c.getBoundingClientRect();
    return { hauteur: Math.round(r.height) };
  });

  return {
    boutons,
    fermetureTiroir: fermeture ? getComputedStyle(fermeture).display : 'absent',
    cartes,
    page: document.documentElement.scrollWidth,
    ecran: document.documentElement.clientWidth
  };
});

console.log(JSON.stringify(resultat, null, 2));
await page.screenshot({ path: 'tests/qa-mobile/desktop-caisse-final.png' });
await navigateur.close();
