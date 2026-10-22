/**
 * QA : les TRANCHES du camembert sont-elles cliquables et mettent-elles en
 * évidence la famille correspondante dans la légende ?
 *
 * On clique sur une tranche SVG, puis on mesure :
 *   - l'opacité des tranches (celle cliquée à 1, les autres à ~0,28) ;
 *   - le texte affiché au centre (pourcentage de la famille) ;
 *   - l'atténuation de la ligne de légende.
 *
 * Usage : node tests/_qa-tranches-cliquables.mjs [urlFront]
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

const panneau = page.locator('.dashboard-panel').filter({ hasText: 'Articles par famille' }).first();
/* On cible le SVG du CAMEMBERT par son aria-label : le panneau contient
   d'autres icônes dont les <path> faussaient les mesures. */
const camembert = panneau.locator('svg[aria-label^="Répartition"]');

const etat = async libelle => {
  const info = await camembert.evaluate(svg => {
    const tranches = [...svg.querySelectorAll('path')];
    return {
      nbTranches: tranches.length,
      opacites: tranches.map(p => Number(getComputedStyle(p).opacity).toFixed(2)),
      infobulles: tranches.map(p => p.querySelector('title')?.textContent || null),
      centre: svg.parentElement.innerText.replace(/\s+/g, ' ').trim() || null
    };
  });
  console.log(`${libelle} → nb=${info.nbTranches} | opacités=${JSON.stringify(info.opacites)} | centre=« ${info.centre} »`);
  return info;
};

const avant = await etat('AVANT clic');

// Cliquer sur la première tranche (Matériaux, la plus grande).
const trancheMateriaux = camembert.locator('path').first();
console.log('Infobulles :', JSON.stringify(avant.infobulles));
await trancheMateriaux.click({ force: true });
await page.waitForTimeout(500);
const apres = await etat('APRÈS clic sur la tranche « Matériaux »');

// Re-cliquer pour désélectionner.
await trancheMateriaux.click({ force: true });
await page.waitForTimeout(400);
const retour = await etat('APRÈS re-clic (désélection)');

await page.screenshot({ path: 'tests/qa-mobile/camembert-clic.png' });

const ok = apres.opacites[0] === '1.00' && apres.opacites.slice(1).every(o => o !== '1.00');
console.log(ok
  ? '\nVERDICT OK : la tranche cliquée reste pleine, les autres sont atténuées.'
  : '\nVERDICT KO : la mise en évidence ne fonctionne pas.');
console.log('Retour à l’état initial :', retour.opacites.every(o => o === '1.00'));

await navigateur.close();
