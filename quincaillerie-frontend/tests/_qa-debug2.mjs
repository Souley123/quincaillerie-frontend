import { chromium } from 'playwright';

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });
await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const passe = String(Date.now() - 86400000);
  localStorage.setItem('skys_erp_trial_expire', passe);
  localStorage.setItem('skys_erp_subscribed', 'false');
  localStorage.setItem('skys_erp_essai_consomme', 'true');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => ({
  cles: Object.keys(localStorage).filter(c => /trial|subscribed|abonnement|essai/.test(c)).map(c => `${c}=${localStorage.getItem(c)}`),
  h1: document.querySelector('h1')?.innerText || null,
  debut: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)
}));
console.log(JSON.stringify(info, null, 2));
await navigateur.close();
