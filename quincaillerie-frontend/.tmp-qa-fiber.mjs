// Écoute les transitions React (hook de développement) autour de l'état final vide.
export default async function run(page) {
  page.on('console', m => { if (/SKYSTRACE/.test(m.text())) console.log(m.text()); });

  await page.evaluate(() => {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) { console.log('SKYSTRACE pas de hook devtools'); return; }
    window.__fiberRacine = null;
    const rendu = () => {
      const racine = document.getElementById('root');
      const cle = Object.keys(racine).find(k => k.startsWith('__reactContainer'));
      return cle ? racine[cle] : null;
    };
    // Récupère l'arbre en profondeur après chaque commit.
    hook.onCommitFiberRoot = (id, root) => {
      try {
        const lignes = [];
        const visiter = (f, p, d) => {
          if (!f || d > 6) return;
          const nom = f.elementType?.name || f.elementType || f.type?.name || f.type;
          const rendu = f.memoizedProps ? 'hasProps' : 'null';
          if (d < 6) lignes.push(`${'  '.repeat(d)}${typeof nom === 'string' ? nom : (nom || '?')} [${rendu}]`);
          visiter(f.child, f, d + 1);
          visiter(f.sibling, p, d);
        };
        visiter(root.current?.child || root.current, null, 0);
        console.log('SKYSTRACE ' + lignes.slice(0, 25).join(' | '));
      } catch (e) { /* ignore */ }
    };
  });

  await page.getByRole('textbox', { name: /Email/i }).first().fill('demo@skys-erp.com');
  await page.getByRole('textbox', { name: /Mot de passe/i }).first().fill('Skys-Demo-2026!');
  await page.getByRole('button', { name: /Se connecter/i }).first().click();
  await page.waitForTimeout(6000);
  return { fin: 'voir les lignes SKYSTRACE' };
}
