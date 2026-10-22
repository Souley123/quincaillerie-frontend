import { chromium } from 'playwright';

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });

const entreprise = {
  companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Ma Quincaillerie',
  devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 86400000).toISOString()
};

await page.route('**/api/**', route => route.fulfill({
  status: 200, contentType: 'application/json', body: '[]'
}));

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const p = 'skys__maquincaillerie__ksouleymanesoro60@gmail.com__';
  localStorage.setItem(`${p}erp_trial_expire`, String(Date.now() - 86400000));
  localStorage.setItem(`${p}erp_abonnement_expire`, 'true');
  localStorage.setItem(`${p}erp_essai_consomme`, 'true');
  localStorage.setItem(`${p}erp_subscribed`, 'false');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const releve = await page.evaluate(() => {
  const cles = Object.keys(localStorage).filter(c => /trial_expire|abonnement_expire|essai_consomme|subscribed/.test(c));
  return {
    cles: cles.map(c => `${c} = ${localStorage.getItem(c)}`),
    titre: document.querySelector('h1')?.innerText || '(aucun h1)',
    texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 150)
  };
});
console.log(JSON.stringify(releve, null, 2));
console.log('Entreprise de test (échéance valide) :', entreprise.abonnementEcheance);

await navigateur.close();
