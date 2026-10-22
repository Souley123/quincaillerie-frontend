/**
 * VERIFICATION (lecture seule) — taille de la fenetre camera dans la Caisse.
 *   node tests/_verif-camera.mjs
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const entreprise = {
  companyId: 'M', slug: 'maquincaillerie', raisonSociale: 'T', devise: 'FCFA',
  tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

const navigateur = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
});

for (const [nom, viewport] of [
  ['telephone-393', { width: 393, height: 851 }],
  ['desktop-1840', { width: 1840, height: 858 }]
]) {
  const contexte = await navigateur.newContext({
    viewport, isMobile: nom.startsWith('telephone'), hasTouch: nom.startsWith('telephone'),
    locale: 'fr-FR', permissions: ['camera']
  });
  const page = await contexte.newPage();

  await page.route('**/api/**', r => r.request().url().includes('/api/auth/moi')
    ? r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true },
        entreprise
      })
    })
    : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.addInitScript(e => {
    localStorage.setItem('skys_erp_jeton', 'j');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({
      utilisateur: { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true },
      entreprise: e
    }));
    localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
    localStorage.setItem('skys_erp_subscribed', 'true');
  }, entreprise);

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  if (nom.startsWith('telephone')) {
    await page.locator('.app-menu-toggle').click().catch(() => { });
    await page.waitForTimeout(500);
  }
  await page.locator('#categorie-principale').selectOption('transaction').catch(() => { });
  await page.waitForTimeout(1200);

  // Ouvrir la camera
  await page.locator('.caisse-module .pos-btn-camera').click().catch(() => { });
  await page.waitForTimeout(2500);

  const m = await page.evaluate(() => {
    const box = el => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    };
    const cont = document.querySelector('#skys-reader-video');
    const vid = document.querySelector('#skys-reader-video video');
    return {
      conteneur: box(cont),
      video: box(vid),
      largeurEcran: window.innerWidth,
      debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  console.log(`\n=== ${nom} ===`);
  console.log(JSON.stringify(m, null, 2));
  await page.screenshot({ path: `tests/qa-mobile/verif-camera-${nom}.png` });
  await contexte.close();
}

await navigateur.close();
