// Capture l'état de la page juste APRÈS la connexion, et vérifie si l'écran
// se vide ensuite (crash de rendu silencieux).
export default async function run(page) {
  const journal = [];
  page.on('console', m => journal.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => journal.push('pageerror: ' + e.message));

  await page.evaluate(() => {
    window.__journalDom = [];
    const cible = document.getElementById('root');
    new MutationObserver(ms => {
      for (const m of ms) {
        window.__journalDom.push({ t: Math.round(performance.now()), ajouts: m.addedNodes.length, retraits: m.removedNodes.length, children: cible.children.length });
      }
    }).observe(cible, { childList: true });
  });

  await page.getByRole('textbox', { name: /Email/i }).first().fill('demo@skys-erp.com');
  await page.getByRole('textbox', { name: /Mot de passe/i }).first().fill('Skys-Demo-2026!');
  await page.getByRole('button', { name: /Se connecter/i }).first().click();

  await page.waitForTimeout(2500);
  const t2 = await page.evaluate(() => ({
    enfants: document.getElementById('root').children.length,
    enfantsBody: document.body.children.length,
    texte: document.getElementById('root').innerText.slice(0, 200),
    url: location.href
  }));
  await page.screenshot({ path: 'tmp-apres.png' });

  await page.waitForTimeout(6000);
  const t8 = await page.evaluate(() => ({
    enfants: document.getElementById('root').children.length,
    texte: document.getElementById('root').innerText.slice(0, 200),
    mutations: window.__journalDom.slice(-8),
    jeton: Boolean(localStorage.getItem('skys_erp_jeton'))
  }));

  return { a2s: t2, a8s: t8, journal };
}
