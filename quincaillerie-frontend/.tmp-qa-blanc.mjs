// Se connecte puis capture l'erreur exacte qui vide #root.
export default async function run(page) {
  const journal = [];
  page.on('pageerror', e => journal.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => journal.push(`[${m.type()}] ${m.text()}`));
  page.on('response', async r => {
    if (r.url().includes('/api/')) journal.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
  });

  await page.getByRole('textbox', { name: /Email/i }).first().fill('demo@skys-erp.com');
  await page.getByRole('textbox', { name: /Mot de passe/i }).first().fill('Skys-Demo-2026!');
  await page.getByRole('button', { name: /Se connecter/i }).first().click();
  await page.waitForTimeout(5000);

  return {
    journal,
    root: await page.evaluate(() => document.getElementById('root').innerHTML.length),
    stockage: await page.evaluate(() => Object.keys(localStorage))
  };
}
