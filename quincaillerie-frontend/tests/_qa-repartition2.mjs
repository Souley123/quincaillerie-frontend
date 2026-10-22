/**
 * Vérifie le diagramme de répartition sur l'onglet « Tableau de Bord ».
 * Force la navigation par la liste déroulante PUIS vérifie le rendu.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const entreprise = {
  companyId: 'M', slug: 'maquincaillerie', raisonSociale: 'SKYS ERP Solution', devise: 'FCFA',
  tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

const article = (nom, famille) => ({ ref: nom.toLowerCase(), nom, famille, prix: 1000, prixAchat: 700, quantiteStock: 10, minStock: 2, codeBarre: '' });
const CATALOGUE = [
  article('Ciment', 'Matériaux'), article('Sable', 'Matériaux'), article('Gravier', 'Matériaux'),
  article('Marteau', 'Outillage manuel'), article('Tournevis', 'Outillage manuel'),
  article('Câble', 'Électricité'), article('Perceuse', 'Outillage électroportatif'),
  article('Peinture', 'Peinture et finition'), article('Tuyau', 'Plomberie'),
  article('Jardin', 'Jardinage'), article('Gant', 'Équipements de protection')
];

const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'fr-FR' });
const page = await contexte.newPage();

await page.route('**/api/**', r => r.request().url().includes('/api/auth/moi')
  ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise }) })
  : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

await page.evaluate(({ c, e }) => {
  localStorage.setItem('skys_erp_jeton', 'j');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
  localStorage.setItem('skys_erp_subscribed', 'true');
}, { c: CATALOGUE, e: entreprise });

/* Le catalogue est écrit APRÈS la session : l'application lit
   `skys__demo__demo__erp_products` au démarrage, et l'écrire avant la
   session faisait remplacer le catalogue par celui, vide, du compte. */
await page.evaluate(c => {
  localStorage.setItem('skys__demo__demo__erp_products', JSON.stringify(c));
}, CATALOGUE);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Aller explicitement au tableau de bord.
await page.locator('#categorie-principale').selectOption('dashboard').catch(() => {});
await page.waitForTimeout(1800);

const resultat = await page.evaluate(() => {
  const donut = document.querySelector('.dashboard-donut');
  const panneau = donut ? donut.closest('.dashboard-panel') : null;
  const carteFamilles = [...document.querySelectorAll('.dashboard-panel')]
    .find(p => /Articles par famille/i.test(p.innerText));
  return {
    dashboardPresent: Boolean(document.querySelector('.dashboard-welcome')),
    donutPresent: Boolean(donut),
    carteTrouvee: Boolean(carteFamilles),
    carteTexte: carteFamilles ? carteFamilles.innerText.replace(/\s+/g, ' ').slice(0, 400) : null,
    centre: donut ? donut.innerText.replace(/\s+/g, ' ').trim() : null,
    fond: donut ? getComputedStyle(donut).backgroundImage.slice(0, 260) : null
  };
});

console.log(JSON.stringify(resultat, null, 2));
await page.screenshot({ path: 'tests/qa-mobile/repartition-familles.png' });
await navigateur.close();
