export default async function run(page, ui) {
  const tailles = [
    { w: 880, h: 800, nom: 'caisse-880.png' },
    { w: 1024, h: 800, nom: 'caisse-1024.png' },
    { w: 1440, h: 900, nom: 'caisse-1440.png' }
  ];
  const r = [];
  for (const t of tailles) {
    await page.setViewportSize({ width: t.w, height: t.h });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const g = document.querySelector('.pos-grid-layout');
      const ga = getComputedStyle(g).gridTemplateColumns;
      const l = document.querySelector('.pos-left-column').getBoundingClientRect();
      const d = document.querySelector('.pos-right-column').getBoundingClientRect();
      const btn = document.querySelector('.pos-btn-scan-ajouter').getBoundingClientRect();
      return {
        colonnes: ga.split(' ').length,
        gauche: Math.round(l.width) + 'x' + Math.round(l.height),
        droite: Math.round(d.width) + 'x' + Math.round(d.height),
        coteACote: l.right <= d.left + 1,
        btnAjouter: Math.round(btn.width) + 'x' + Math.round(btn.height),
        debord: document.documentElement.scrollWidth > window.innerWidth
      };
    });
    r.push({ taille: t.w, ...m });
    await page.screenshot({ path: t.nom });
  }
  return r;
}
