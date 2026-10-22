// Cherche QUI vide #root : inspecte l'arbre React après connexion.
export default async function run(page) {
  const journal = [];
  page.on('pageerror', e => journal.push('pageerror: ' + e.message));
  page.on('console', m => journal.push(`[${m.type()}] ${m.text()}`));

  // Mémorise le conteneur racine et la fibre React au démarrage.
  await page.evaluate(() => {
    const racine = document.getElementById('root');
    window.__racine = racine;
    window.__avant = racine.firstChild;
  });

  await page.getByRole('textbox', { name: /Email/i }).first().fill('demo@skys-erp.com');
  await page.getByRole('textbox', { name: /Mot de passe/i }).first().fill('Skys-Demo-2026!');
  await page.getByRole('button', { name: /Se connecter/i }).first().click();
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => {
    const racine = document.getElementById('root');
    const res = {
      enfants: racine.children.length,
      html: racine.innerHTML.slice(0, 200),
      memeRacine: racine === window.__racine,
      racineDansDocument: document.contains(racine),
      // La clé interne de React sur le conteneur : vide => React a démonté.
      cleReact: Object.keys(racine).filter(k => k.startsWith('_react')).map(k => {
        const v = racine[k];
        return `${k}=${v == null ? 'null' : typeof v === 'object' ? Object.keys(v).join(',') || '{}' : v}`;
      }),
      bodyHtmlDebut: document.body.innerHTML.slice(0, 300)
    };
    return res;
  });

  return { info, journal };
}
