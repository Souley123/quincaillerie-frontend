// Après connexion, inspecte l'arbre React Fiber pour trouver l'erreur avalée
// et l'état des écrans de garde.
export default async function run(page) {
  await page.getByRole('textbox', { name: /Email/i }).first().fill('demo@skys-erp.com');
  await page.getByRole('textbox', { name: /Mot de passe/i }).first().fill('Skys-Demo-2026!');
  await page.getByRole('button', { name: /Se connecter/i }).first().click();
  await page.waitForTimeout(6000);

  return await page.evaluate(() => {
    const root = document.getElementById('root');
    const cle = Object.keys(root).find(k => k.startsWith('__reactContainer'));
    const res = { html: root.innerHTML.length, cle: cle || null, chemins: [] };
    if (!cle) return res;
    // Parcourt l'arbre fiber à la recherche d'une erreur capturée par try/catch
    // (les composants d'erreur stockent souvent le message dans leur state).
    const vus = new Set();
    const pile = [[root[cle], 'root']];
    while (pile.length && res.chemins.length < 40) {
      const [fibre, chemin] = pile.pop();
      if (!fibre || vus.has(fibre)) continue;
      vus.add(fibre);
      try {
        const st = fibre.memoizedState;
        if (st && typeof st === 'object') {
          const vals = Object.values(st).filter(v => typeof v === 'string' && v.length > 0 && v.length < 200);
          if (vals.length) res.chemins.push({ chemin, vals });
        }
        const memo = fibre.memoizedProps;
        if (memo && (memo.error || memo.err)) res.chemins.push({ chemin: chemin + '|props', val: String(memo.error || memo.err).slice(0, 300) });
      } catch (e) { /* ignoré */ }
      if (fibre.child) pile.push([fibre.child, chemin + '>' + (typeof fibre.type === 'string' ? fibre.type : (fibre.type?.name || '?'))]);
      if (fibre.sibling) pile.push([fibre.sibling, chemin]);
    }
    return res;
  });
}
