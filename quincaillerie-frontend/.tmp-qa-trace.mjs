// Trace la connexion : qui démonte React et avec quelle pile d'appels ?
export default async function run(page) {
  const journal = [];
  page.on('pageerror', e => journal.push('pageerror: ' + e.message));
  page.on('console', m => journal.push(`[${m.type()}] ${m.text()}`));

  page.on('response', async r => {
    if (r.url().includes('/api/auth/login')) {
      journal.push('LOGIN ' + r.status() + ' ' + (await r.text().catch(() => '')).slice(0, 300));
    }
  });

  await page.evaluate(() => {
    window.__traces = [];
    const vider = el => {
      const pile = new Error('conteneur vidé').stack.split('\n').slice(1, 7).join(' <- ');
      window.__traces.push({ quand: Math.round(performance.now()), conteneur: el.id || el.className, pile });
    };
    // Observe aussi les remplacements de <body> et les retraits des conteneurs.
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.removedNodes.length && m.target.id === 'root') vider(m.target);
        if (m.removedNodes.length && m.target === document.body) {
          for (const n of m.removedNodes) {
            window.__traces.push({ quand: Math.round(performance.now()), retireDeBody: n.tagName + '#' + n.id + '.' + n.className });
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: false });
    new MutationObserver(ms => {
      for (const m of ms) if (m.removedNodes.length) vider(m.target);
    }).observe(document.getElementById('root'), { childList: true });

    // Filets : detecte un innerHTML = '' sur body/root.
    const desc = (proto, nom) => {
      const d = Object.getOwnPropertyDescriptor(proto, nom);
      if (!d || !d.set) return;
      Object.defineProperty(proto, nom, {
        configurable: true,
        get: d.get,
        set(v) {
          if (v === '' && (this.id === 'root' || this === document.body)) {
            window.__traces.push({ quand: Math.round(performance.now()), innerHtmlVide: this.id || 'body', pile: new Error('innerHTML=""').stack.split('\n').slice(1, 7).join(' <- ') });
          }
          d.set.call(this, v);
        }
      });
    };
    desc(Element.prototype, 'innerHTML');
    desc(Element.prototype, 'textContent');
    const rm = Element.prototype.remove;
    Element.prototype.remove = function () {
      if (this.id === 'root' || this === document.body) window.__traces.push({ quand: Math.round(performance.now()), remove: this.id || 'body', pile: new Error('remove()').stack.split('\n').slice(1, 7).join(' <- ') });
      return rm.call(this);
    };
  });

  await page.getByRole('textbox', { name: /Email/i }).first().fill('demo@skys-erp.com');
  await page.getByRole('textbox', { name: /Mot de passe/i }).first().fill('Skys-Demo-2026!');
  await page.getByRole('button', { name: /Se connecter/i }).first().click();
  await page.waitForTimeout(6000);

  const traces = await page.evaluate(() => window.__traces);
  return { traces, journal };
}
