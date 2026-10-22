/* Contrôle ciblé de la ligne de message « Aucun article » sur mobile. */
export default async function run(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('skys_erp_jeton', 'jeton-qa-mobile');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({
      utilisateur: { nom: 'QA', email: 'demo@skys-erp.com', role: 'Administrateur' },
      entreprise: { nom: 'QA', slug: 'demo', abonnementActif: true }
    }));
  });
  await page.route('**/api/auth/moi', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      utilisateur: { nom: 'QA', email: 'demo@skys-erp.com', role: 'Administrateur' },
      entreprise: { nom: 'QA', slug: 'demo', abonnementActif: true }
    })
  }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  if (await page.locator('.app-menu-toggle').isVisible().catch(() => false)) {
    await page.locator('.app-menu-toggle').click().catch(() => { });
    await page.waitForTimeout(600);
  }
  await page.locator('.sidebar a, .app-sidebar a, .sidebar button, .app-sidebar button')
    .filter({ hasText: /stock/i }).first().click({ timeout: 5000 }).catch(() => { });
  await page.waitForTimeout(2500);

  return page.evaluate(() => {
    const td = document.querySelector('.app-main table td[colspan]');
    if (!td) return { trouve: false };
    const r = td.getBoundingClientRect();
    const cadre = td.closest('div');
    return {
      trouve: true,
      texte: td.innerText.trim().slice(0, 80),
      largeurCellule: Math.round(r.width),
      largeurCadre: cadre ? cadre.clientWidth : null,
      debordeCadre: cadre ? Math.round(r.right) > Math.round(cadre.getBoundingClientRect().right) + 1 : null
    };
  });
}
