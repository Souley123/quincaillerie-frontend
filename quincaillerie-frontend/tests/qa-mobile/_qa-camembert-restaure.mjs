/* Vérifie que le bloc camembert du tableau de bord est bien celui d'avant :
   légende « Autres ▾ » dépliable, sélecteur « Familles affichées » et bloc
   « Remplacer une famille affichée » présents. Aucune modification de l'app :
   seule la vérification de session est contournée. */
const UTILISATEUR = { nom: 'QA', email: 'demo@skys-erp.com', role: 'Administrateur' };
const ENTREPRISE = { nom: 'Quincaillerie QA', slug: 'demo', abonnementActif: true };

export default async function run(page) {
  await page.setViewportSize({ width: 1366, height: 900 });

  await page.addInitScript(([u, e]) => {
    localStorage.setItem('skys_erp_jeton', 'jeton-qa-mobile');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: u, entreprise: e }));
  }, [UTILISATEUR, ENTREPRISE]);

  await page.route('**/api/auth/moi', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ utilisateur: UTILISATEUR, entreprise: ENTREPRISE })
  }));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // L'app rouvre le dernier module consulté : on revient sur le tableau de bord.
  const lien = page.locator('.sidebar a, .app-sidebar a, .sidebar button, .app-sidebar button')
    .filter({ hasText: /Tableau de [Bb]ord/ }).first();
  await lien.click({ timeout: 5000 }).catch(() => { });
  await page.waitForTimeout(2500);

  return page.evaluate(() => {
    const texte = document.body.innerText;
    const selecteur = document.getElementById('nb-familles-camembert');
    const legendeAutres = [...document.querySelectorAll('details summary')]
      .some(el => /^Autres \(\d+\)/.test(el.textContent.trim()));
    return {
      ouvert: Boolean(document.querySelector('.app-main')) && !document.querySelector('input[type=password]'),
      selecteurFamilles: Boolean(selecteur),
      legendeAutresDepliable: legendeAutres,
      blocRemplacer: texte.includes('Remplacer une famille affichée'),
      camembert: Boolean(document.querySelector('svg[aria-label*="Répartition"]'))
    };
  });
}
