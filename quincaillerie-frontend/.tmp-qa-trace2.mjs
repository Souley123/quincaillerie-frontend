// Capture TOUT ce qui se passe après le clic : erreurs, réponses, et qui vide #root.
export default async function run(page) {
  const journal = [];
  page.on('pageerror', e => journal.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => journal.push(`[${m.type()}] ${m.text()}`.slice(0, 300)));
  page.on('framenavigated', f => journal.push('NAV: ' + f.url()));
  page.on('crash', () => journal.push('PAGE CRASH'));
  page.on('response', r => {
    if (r.url().includes('/api/')) journal.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace('http://localhost:5001', '')}`);
  });
  page.on('requestfailed', r => journal.push('REQFAIL ' + r.url() + ' ' + r.failure()?.errorText));

  // Trace qui retire le nœud de #root.
  await page.evaluate(() => {
    window.__trace = [];
    const cible = document.getElementById('root');
    const mo = new MutationObserver(ms => {
      for (const m of ms) if (m.removedNodes.length) {
        window.__trace.push({ t: Math.round(performance.now()), retires: m.removedNodes.length, pile: (new Error()).stack.split('\n').slice(1, 6).join(' | ') });
      }
    });
    mo.observe(cible, { childList: true });
    window.__avant = cible.innerHTML.length;
  });

  await page.getByRole('textbox', { name: /Email/i }).first().fill('demo@skys-erp.com');
  await page.getByRole('textbox', { name: /Mot de passe/i }).first().fill('Skys-Demo-2026!');
  await page.getByRole('button', { name: /Se connecter/i }).first().click();

  const etats = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(800);
    etats.push(await page.evaluate(() => ({
      t: Math.round(performance.now()),
      root: document.getElementById('root').innerHTML.length,
      jeton: Boolean(localStorage.getItem('skys_erp_jeton')),
      trace: window.__trace.length
    })));
  }
  return { etats, trace: await page.evaluate(() => window.__trace), journal };
}
