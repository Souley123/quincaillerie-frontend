/**
 * Étape 2 : depuis la session déjà connectée, ouvrir le module « Catégorie »
 * puis lire les catégories affichées et le nombre d'articles par famille.
 */
export default async function run(page, ui) {
  const avant = await ui.snapshot();

  // Ouvrir le module « Gestion de Stock » (onglet « Catégorie »).
  const boutonStock = page.getByRole('button', { name: /^Gestion de Stock$/ }).first();
  await boutonStock.click().catch(() => { });
  await page.waitForTimeout(2500);

  const apres = await ui.snapshot({ full: true });

  const donnees = await page.evaluate(() => {
    const selects = [...document.querySelectorAll('select')];
    const selectCat = selects.find(s => [...s.options].some(o => /Quincaillerie de fixation/i.test(o.textContent)));
    const tableau = [...document.querySelectorAll('table')].map(t =>
      [...t.querySelectorAll('tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()).slice(0, 25)
    );
    return {
      optionsSelecteur: selectCat ? [...selectCat.options].map(o => o.textContent.trim()) : null,
      tableaux: tableau,
      ongletCategoriesVisible: /Créer une catégorie/i.test(document.body.innerText)
    };
  });

  return { avant: avant.slice(0, 500), apres: apres.slice(0, 3000), donnees };
}
