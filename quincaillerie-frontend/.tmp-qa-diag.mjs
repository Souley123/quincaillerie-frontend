// Le CONTENU change-t-il vraiment ? Compare le corps de la zone principale
// entre Tableau de Bord et Caisse & Transactions.
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

  const clic = async libelle => {
    await page.evaluate(t => {
      Array.from(document.querySelectorAll('aside button'))
        .find(el => (el.innerText || '').replace(/\s+/g, ' ').trim() === t)?.click();
    }, libelle);
    await page.waitForTimeout(900);
    return page.evaluate(() => {
      const zone = document.querySelector('.app-contenu-zone') || document.querySelector('main') || document.body;
      const texte = (zone.innerText || '').replace(/\s+/g, ' ').trim();
      return {
        longueur: texte.length,
        debut: texte.slice(0, 90),
        carteBord: Boolean(document.querySelector('.dashboard-view')),
        caisse: /Panier|Total à payer|Encaisser|Moyen de paiement/i.test(texte)
      };
    });
  };

  const resultats = [];
  for (const libelle of ['Tableau de Bord', 'Caisse & Transactions', 'Tableau de Bord']) {
    resultats.push({ libelle, ...(await clic(libelle)) });
  }
  return { resultats, erreurs };
}
