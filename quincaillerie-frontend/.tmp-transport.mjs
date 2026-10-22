export default async function run(page, ui) {
  // Lien direct par l'URL (onglet actif) pour éviter un parcours de connexion.
  await page.evaluate(() => {
    const ev = new Event('hashchange');
    window.location.hash = '#transport';
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(400);

  // Repli : cliquer l'entrée de menu « Transport » si le hash n'a rien fait.
  if (!(await page.locator('.transport-steps').count())) {
    const lien = page.getByText('Transport', { exact: false }).first();
    if (await lien.count()) {
      await lien.click().catch(() => { });
      await page.waitForTimeout(600);
    }
  }

  const present = await page.locator('.transport-steps').count();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  if (present) await page.screenshot({ path: 'transport-form.png' });
  return { formPresent: present, url: page.url(), extrait: (await page.locator('body').innerText()).slice(0, 400) };
}
