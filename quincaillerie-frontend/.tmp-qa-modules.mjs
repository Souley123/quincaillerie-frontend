// Vérification finale : connexion réelle + navigation dans plusieurs modules.
// Aucune erreur de page ni écran vide ne doit apparaître.
export default async function run(page) {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push('PAGEERROR: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error') erreurs.push('console: ' + m.text().slice(0, 150)); });

  await page.getByRole('textbox', { name: /Email/i }).first().fill('x@x.com');
  await page.getByRole('textbox', { name: /Mot de passe/i }).first().fill('x');
  await page.getByRole('button', { name: /Se connecter/i }).first().click();

  for (let i = 0; i < 40; i += 1) {
    if (await page.evaluate(() => document.querySelectorAll('aside button, aside a').length > 3)) break;
    await page.waitForTimeout(400);
  }
  const connecte = await page.evaluate(() => ({
    racine: document.getElementById('root').innerHTML.length,
    jeton: Boolean(localStorage.getItem('skys_erp_jeton')),
    menus: document.querySelectorAll('aside button, aside a').length
  }));

  const cibles = ['Gestion de Stock', 'Caisse & Transactions', 'Clients & Contacts', 'Tableau de Bord'];
  const visites = [];
  for (const libelle of cibles) {
    const avant = erreurs.length;
    await page.evaluate(t => {
      const b = Array.from(document.querySelectorAll('aside button, aside a'))
        .find(el => (el.innerText || '').replace(/\s+/g, ' ').includes(t));
      b?.click();
    }, libelle);
    await page.waitForTimeout(500);
    visites.push({
      module: libelle,
      ...(await page.evaluate(() => ({
        racine: document.getElementById('root').innerHTML.length,
        enTete: (document.querySelector('.app-header-title')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)
      }))),
      erreurs: erreurs.slice(avant)
    });
  }

  await page.screenshot({ path: '.tmp-qa-final.png' });
  return { connecte, visites, videDetecte: visites.some(v => v.racine < 500), erreurs };
}
