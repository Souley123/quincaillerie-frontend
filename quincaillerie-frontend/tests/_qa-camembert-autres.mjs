/**
 * QA : les familles regroupées sous « Autres » sont-elles consultables ?
 *
 * On injecte 9 familles. Le camembert affiche les 6 plus grandes ; le reste
 * est regroupé sous « Autres » — un bouton doit permettre de l'ouvrir.
 *
 * Usage : node tests/_qa-camembert-autres.mjs [urlFront]
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
  article('Jardin', 'Jardinage'), article('Gant', 'Équipements de protection'),
  article('Brouette', 'Jardinage')
];

const navigateur = await chromium.launch({ channel: 'chrome' });
const contexte = await navigateur.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'fr-FR' });
const page = await contexte.newPage();

await page.route('**/api/**', r => {
  const url = r.request().url();
  if (url.includes('/api/auth/moi')) {
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise }) });
  }
  if (url.includes('/api/products')) {
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOGUE.map((p, i) => ({ ...p, _id: `p${i}` }))) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await page.addInitScript(e => {
  localStorage.setItem('skys_erp_jeton', 'j');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
  localStorage.setItem('skys_erp_subscribed', 'true');
}, entreprise);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.locator('#categorie-principale').selectOption('dashboard').catch(() => {});
await page.waitForTimeout(1800);

const avant = await page.evaluate(() => {
  const pan = [...document.querySelectorAll('.dashboard-panel')].find(p => /Articles par famille/i.test(p.innerText));
  return { texte: pan ? pan.innerText.replace(/\s+/g, ' ').slice(0, 420) : null };
});
console.log('AVANT ouverture :', JSON.stringify(avant, null, 2));

// Ouvrir le détail de « Autres ».
const boutonAutres = page.getByText(/Autres \(/).first();
const existe = await boutonAutres.count();
console.log('Ligne « Autres » présente :', existe > 0);
if (existe) {
  await boutonAutres.click().catch(() => {});
  await page.waitForTimeout(600);
}

const apres = await page.evaluate(() => {
  const pan = [...document.querySelectorAll('.dashboard-panel')].find(p => /Articles par famille/i.test(p.innerText));
  const details = pan ? pan.querySelector('details') : null;
  return {
    ouvert: details ? details.open : null,
    detailTexte: details ? details.innerText.replace(/\s+/g, ' ').slice(0, 400) : null
  };
});
console.log('APRÈS ouverture :', JSON.stringify(apres, null, 2));

await page.screenshot({ path: 'tests/qa-mobile/camembert-autres.png' });
await navigateur.close();
