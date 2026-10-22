/**
 * Rend le TABLEAU DE BORD avec un catalogue de plusieurs familles, en pilotant
 * directement l'état de l'application (localStorage lu à l'initialisation).
 *
 * Astuce : on écrit le catalogue dans TOUTES les clés possibles AVANT le
 * premier rendu, puis on recharge. Cela couvre les deux espaces de stockage
 * (démo et compte) sans dépendre de l'ordre d'initialisation.
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
const contexte = await navigateur.newContext({ viewport: { width: 1500, height: 950 }, locale: 'fr-FR' });
const page = await contexte.newPage();

// Tout injecter AVANT le premier chargement de l'application.
await page.addInitScript(({ c, e }) => {
  if (sessionStorage.getItem('injecte')) return;
  sessionStorage.setItem('injecte', '1');
  const session = JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e });
  localStorage.setItem('skys_erp_jeton', 'j');
  localStorage.setItem('skys_erp_entreprise', session);
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
  localStorage.setItem('skys_erp_subscribed', 'true');
  ['skys__demo__demo__erp_products', 'erp_products', 'skys_demo_erp_products'].forEach(cle => {
    localStorage.setItem(cle, JSON.stringify(c));
  });
}, { c: CATALOGUE, e: entreprise });

await page.route('**/api/**', r => {
  const url = r.request().url();
  if (url.includes('/api/auth/moi')) {
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise }) });
  }
  /* Les articles viennent du SERVEUR (`/api/products`), pas du stockage local. */
  if (url.includes('/api/products')) {
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOGUE.map((p, i) => ({ ...p, _id: `p${i}` }))) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.locator('#categorie-principale').selectOption('dashboard').catch(() => {});
await page.waitForTimeout(1800);

const resultat = await page.evaluate(() => {
  const donut = document.querySelector('.dashboard-donut');
  const carte = [...document.querySelectorAll('.dashboard-panel')].find(p => /Articles par famille/i.test(p.innerText));
  return {
    donutPresent: Boolean(donut),
    centre: donut ? donut.innerText.replace(/\s+/g, ' ').trim() : null,
    fond: donut ? getComputedStyle(donut).backgroundImage.slice(0, 240) : null,
    carte: carte ? carte.innerText.replace(/\s+/g, ' ').slice(0, 500) : null
  };
});

console.log(JSON.stringify(resultat, null, 2));
await page.screenshot({ path: 'tests/qa-mobile/camembert-familles.png' });
await navigateur.close();
