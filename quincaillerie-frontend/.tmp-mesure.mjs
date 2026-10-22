/* MESURE TEMPORAIRE — vérification des nouvelles largeurs (après correction). */
export default async function run(page) {
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  return page.evaluate(() => {
    const hote = document.createElement('div');
    hote.className = 'app-main';
    hote.style.cssText = 'padding:22px 30px;';
    hote.innerHTML = `
      <div class="table-container-mobile">
        <table class="responsive-table" style="border-collapse:collapse;text-align:left;font-size:13px">
          <colgroup>
            <col style="width:70px"><col style="width:180px"><col style="width:112px">
            <col style="width:132px"><col style="width:104px"><col style="width:104px">
            <col style="width:62px"><col style="width:136px">
          </colgroup>
          <thead><tr style="color:white">
            <th>Réf</th><th>Désignation</th><th>Catégorie</th><th>Sous-catégorie</th>
            <th>Fournisseur</th><th style="text-align:right">Prix Vente</th>
            <th style="text-align:center">Stock</th><th style="text-align:center">Actions</th>
          </tr></thead>
          <tbody><tr>
            <td style="font-weight:bold">REF-001</td><td style="white-space:normal">Sac de ciment CPJ 45 – 50 kg</td>
            <td>Menuiserie et serrurerie</td><td>—</td><td>SORO DISTRIBUTION</td>
            <td style="text-align:right;white-space:nowrap">12 500 FCFA</td>
            <td style="text-align:center">40</td>
            <td><div style="display:flex;gap:5px"><button style="font-size:12px;padding:4px 7px">Modifier</button><button style="font-size:12px;padding:4px 7px">Retirer</button></div></td>
          </tr></tbody>
        </table>
      </div>`;
    document.body.appendChild(hote);

    const t = hote.querySelector('table');
    const conteneur = t.parentElement;
    return {
      fenetre: window.innerWidth,
      conteneur: Math.round(conteneur.getBoundingClientRect().width),
      table: Math.round(t.getBoundingClientRect().width),
      debordement: t.scrollWidth - conteneur.clientWidth,
      coupees: [...t.querySelectorAll('thead th')]
        .filter(th => th.scrollWidth > th.clientWidth + 1)
        .map(th => th.textContent.trim()),
      colonnes: [...t.querySelectorAll('thead th')].map(th => ({
        texte: th.textContent.trim(),
        largeur: Math.round(th.getBoundingClientRect().width)
      }))
    };
  });
}
