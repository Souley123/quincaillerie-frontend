// Vérifie la connexion réelle depuis la page de connexion.
export default async function run(page, ui) {
  const snap = await ui.snapshot();
  const erreurs = [];
  page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', e => erreurs.push('pageerror: ' + e.message));
  return { url: page.url(), snap };
}
