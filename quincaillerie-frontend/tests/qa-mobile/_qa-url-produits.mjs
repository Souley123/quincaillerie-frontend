/* Journalise l'URL réelle de la requête produits (diagnostic, ne modifie rien). */
const UTILISATEUR = { nom: 'QA', email: 'demo@skys-erp.com', role: 'Administrateur' };
const ENTREPRISE = { nom: 'Quincaillerie QA', slug: 'demo', abonnementActif: true };

export default async function run(page) {
  await page.addInitScript(([u, e]) => {
    localStorage.setItem('skys_erp_jeton', 'jeton-qa-mobile');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: u, entreprise: e }));
  }, [UTILISATEUR, ENTREPRISE]);
  await page.route('**/api/auth/moi', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ utilisateur: UTILISATEUR, entreprise: ENTREPRISE })
  }));
  await page.reload({ waitUntil: 'domcontentloaded' });

  const urls = [];
  page.on('request', req => {
    const type = req.resourceType();
    if (type === 'xhr' || type === 'fetch') urls.push(`${req.method()} ${req.url()}`);
  });
  await page.waitForTimeout(6000);
  return { total: urls.length, urls: urls.slice(0, 12) };
}
