/**
 * QA : la case « Alertes visuelles et vibration » produit-elle un effet
 * immédiat, et le bandeau reste-t-il lisible ?
 *
 * Usage : node tests/_qa-alerte-visuelle.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR' });
const page = await contexte.newPage();

await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
await page.goto(BASE, { waitUntil: 'networkidle' });

// Connexion simulée : on injecte une session pour atteindre les paramètres.
await page.evaluate(() => {
  const entreprise = { companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test', devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true, abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString() };
  localStorage.setItem('skys_erp_jeton', 'jeton-test');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: 'u1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise }));
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
  localStorage.setItem('skys_erp_subscribed', 'true');
});
await page.route('**/api/auth/moi', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({
    utilisateur: { id: 'u1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true },
    entreprise: { companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test', devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true, abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString() }
  })
}));

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const case1 = page.getByText('Alertes visuelles et vibration').first();
if (!(await case1.count())) {
  console.log('Écran de paramètres inaccessible automatiquement — test du service seul.');
} else {
  await case1.click();
  await page.waitForTimeout(600);
  const bandeau = await page.evaluate(() => {
    const el = document.getElementById('skys-alerte-visuelle');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      visible: getComputedStyle(el).display !== 'none',
      texte: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 80),
      top: Math.round(r.top),
      hauteur: Math.round(r.height),
      dansEcran: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth
    };
  });
  console.log('Bandeau après le clic :', JSON.stringify(bandeau, null, 2));
  await page.screenshot({ path: 'tests/qa-mobile/alerte-visuelle.png' });
}

// Test direct du service (indépendant de l'écran).
const direct = await page.evaluate(async () => {
  const module = await import('/src/services/accessibilite.js');
  module.alerteVisuelle('Test direct du bandeau visuel', { dureeMs: 3000 });
  await new Promise(r => setTimeout(r, 300));
  const el = document.getElementById('skys-alerte-visuelle');
  const r = el.getBoundingClientRect();
  return { visible: getComputedStyle(el).display !== 'none', top: Math.round(r.top), texte: el.innerText.trim().slice(0, 60) };
});
console.log('Appel direct :', JSON.stringify(direct));
await page.screenshot({ path: 'tests/qa-mobile/alerte-visuelle-direct.png' });

await navigateur.close();
