// Charge la page, se connecte, puis rejoue l'état "connecté" pour observer
// le rendu de l'ERP (ou son absence).
export default async function run(page) {
  const journal = [];
  page.on('pageerror', e => journal.push('pageerror: ' + e.message));
  page.on('console', m => journal.push(`[${m.type()}] ${m.text()}`));

  await page.evaluate(() => {
    window.__vidages = 0;
    const cible = document.getElementById('root');
    new MutationObserver(ms => {
      for (const m of ms) if (m.removedNodes.length && m.target === cible) window.__vidages++;
    }).observe(cible, { childList: true });
  });

  await page.getByRole('textbox', { name: /Email/i }).first().fill('demo@skys-erp.com');
  await page.getByRole('textbox', { name: /Mot de passe/i }).first().fill('Skys-Demo-2026!');
  await page.getByRole('button', { name: /Se connecter/i }).first().click();

  // Échantillonne ce qui est à l'écran pendant 8 secondes.
  const echantillons = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
    echantillons.push(await page.evaluate(() => ({
      t: Math.round(performance.now()),
      enfants: document.getElementById('root').children.length,
      vidages: window.__vidages,
      debut: (document.getElementById('root').innerText || '').replace(/\s+/g, ' ').slice(0, 60)
    })));
  }

  return { echantillons, journal };
}
