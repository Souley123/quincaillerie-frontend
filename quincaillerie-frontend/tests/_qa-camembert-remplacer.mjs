/**
 * QA : peut-on REMPLACER une famille affichée par une autre ?
 * On coche une petite famille dans « Remplacer une famille affichée »
 * et on vérifie qu'elle apparaît dans le camembert.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const entreprise = { companyId: 'M', slug: 'm', raisonSociale: 'T', devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true, abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString() };

const article = (nom, famille) => ({ ref: nom.toLowerCase(), nom, famille, prix: 1000, prixAchat: 700, quantiteStock: 10, minStock: 2 });
const CATALOGUE = [
  article('Ciment', 'Matériaux'), article('Sable', 'Matériaux'), article('Gravier', 'Matériaux'),
  article('Marteau', 'Outillage manuel'), article('Tournevis', 'Outillage manuel'),
  article('Câble', 'Électricité'), article('Perceuse', 'Outillage électroportatif'),
  article('Peinture', 'Peinture et finition'), article('Tuyau', 'Plomberie'),
  article('Jardin', 'Jardinage'), article('Gant', 'Équipements')
];

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await (await navigateur.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'fr-FR' })).newPage();

await page.route('**/api/**', r => {
  const u = r.request().url();
  if (u.includes('/api/auth/moi')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise }) });
  if (u.includes('/api/products')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOGUE.map((p, i) => ({ ...p, _id: `p${i}` }))) });
  return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await page.addInitScript(e => {
  localStorage.setItem('skys_erp_jeton', 'j');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
  localStorage.setItem('skys_erp_subscribed', 'true');
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
}, entreprise);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.locator('#categorie-principale').selectOption('dashboard').catch(() => {});
await page.waitForTimeout(1500);

const panneau = page.locator('.dashboard-panel').filter({ hasText: 'Articles par famille' }).first();
const tranches = () => panneau.locator('svg[aria-label^="Répartition"] path title').allTextContents();
console.log('AVANT — tranches :', JSON.stringify(await tranches()));

// Déplier « Remplacer une famille affichée ».
await panneau.getByText(/Remplacer une famille affichée/).click();
await page.waitForTimeout(500);

// Cocher « Plomberie » (petite famille, normalement dans « Autres »).
const bouton = panneau.getByRole('button', { name: /Plomberie/ });
console.log('Bouton « Plomberie » présent :', await bouton.count() > 0);
await bouton.first().click();
await page.waitForTimeout(800);

console.log('APRÈS — tranches :', JSON.stringify(await tranches()));
const legendes = await panneau.innerText();
console.log('Plomberie visible dans la légende :', /Plomberie/.test(legendes));

await page.screenshot({ path: 'tests/qa-mobile/camembert-remplacer.png' });
await navigateur.close();
