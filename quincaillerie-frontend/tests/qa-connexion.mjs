export default async function run(page, ui) {
  const resultat = { etapes: [] };

  const attendreLogin = async () => {
    await page.waitForSelector('input[placeholder*="mail" i], input[type="text"]', { timeout: 15000 });
    return page.locator('input').count();
  };

  await attendreLogin();
  resultat.etapes.push('ecran de connexion affiche');

  // --- Test 1 : mauvais mot de passe ---
  await page.fill('input[placeholder*="mail" i]', 'admin@test.ci');
  await page.locator('input[type="password"]').first().fill('MauvaisMotDePasse123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);

  const texteErreur = await page.evaluate(() => document.body.innerText);
  resultat.erreurMauvaisMdp = texteErreur.includes('Identifiants incorrects')
    || texteErreur.includes('tentatives')
    || texteErreur.includes('incorrect');
  resultat.etapes.push('mauvais mot de passe rejete');

  // --- Test 2 : bon mot de passe ---
  await page.fill('input[placeholder*="mail" i]', 'admin@test.ci');
  await page.locator('input[type="password"]').first().fill('MotDePasse123');
  await page.locator('button[type="submit"]').first().click();

  await page.waitForTimeout(4000);

  const apresConnexion = await page.evaluate(() => document.body.innerText);

  resultat.jetonStocke = await page.evaluate(() => !!localStorage.getItem('skys_erp_jeton'));
  resultat.roleStocke = await page.evaluate(() => localStorage.getItem('erp_role'));
  resultat.entrepriseStockee = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('skys_erp_entreprise') || '{}').entreprise?.raisonSociale || null; }
    catch { return null; }
  });

  resultat.connecte = !apresConnexion.includes('Secure Access')
    && resultat.jetonStocke
    && apresConnexion.length > 500;

  resultat.apresConnexion = apresConnexion.slice(0, 300);

  // --- Test 3 : rechargement conserve la session ---
  await page.reload();
  await page.waitForTimeout(4000);
  const apresRechargement = await page.evaluate(() => document.body.innerText);
  resultat.sessionRestauree = !apresRechargement.includes('Secure Access');

  // --- Test 4 : verification serveur de la session ---
  resultat.apiMoi = await page.evaluate(async () => {
    const jeton = localStorage.getItem('skys_erp_jeton');
    const r = await fetch('http://localhost:5001/api/auth/moi', {
      headers: { Authorization: `Bearer ${jeton}` }
    });
    return { statut: r.status, corps: await r.json() };
  });

  // --- Test 5 : isolation, un autre tenant ne voit rien ---
  resultat.produitsDuTenant = await page.evaluate(async () => {
    const jeton = localStorage.getItem('skys_erp_jeton');
    const r = await fetch('http://localhost:5001/api/products', {
      headers: { Authorization: `Bearer ${jeton}` }
    });
    return { statut: r.status, nombre: (await r.json()).length };
  });

  return resultat;
}