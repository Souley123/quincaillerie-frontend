// Teste la connexion avec le compte de démonstration sur l'API de production.
export default async function run(page, ui) {
  const resultats = {};

  // 1. Test direct de POST /api/auth/login via le navigateur (contourne le blocage CORS de curl).
  resultats.connexion = await page.evaluate(async () => {
    const essais = [
      { email: 'demo@skys-erp.com', motDePasse: 'Skys-Demo-2026!' },
      { email: 'demo@skys-erp.com', motDePasse: 'Skys-Demo-2026!', slug: 'demo' }
    ];
    const out = [];
    for (const corps of essais) {
      try {
        const r = await fetch('https://gestion-de-stocks-5lv3.onrender.com/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corps)
        });
        const txt = await r.text();
        out.push({ envoi: Object.keys(corps).join(','), status: r.status, reponse: txt.slice(0, 220) });
      } catch (e) {
        out.push({ envoi: Object.keys(corps).join(','), erreur: String(e) });
      }
    }
    return out;
  });

  // 2. Les routes attendues du nouveau code.
  resultats.routes = await page.evaluate(async () => {
    const routes = ['/health', '/api/tunnel', '/api/paiements/config'];
    const out = {};
    for (const p of routes) {
      try {
        const r = await fetch('https://gestion-de-stocks-5lv3.onrender.com' + p);
        out[p] = r.status;
      } catch (e) { out[p] = 'erreur: ' + String(e); }
    }
    return out;
  });

  return resultats;
}
