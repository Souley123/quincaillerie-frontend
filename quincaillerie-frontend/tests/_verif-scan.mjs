/**
 * VERIFICATION (lecture seule) — barre de scan de la Caisse.
 * Camera a GAUCHE, champ borne, bouton a droite ; menu lateral intact.
 *   node tests/_verif-scan.mjs
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const entreprise = {
  companyId: 'M', slug: 'maquincaillerie', raisonSociale: 'T', devise: 'FCFA',
  tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

const navigateur = await chromium.launch({ channel: 'chrome' });

for (const [nom, viewport, mobile] of [
  ['desktop-1840', { width: 1840, height: 858 }, false],
  ['telephone-393', { width: 393, height: 851 }, true]
]) {
  const contexte = await navigateur.newContext({
    viewport, isMobile: mobile, hasTouch: mobile, locale: 'fr-FR'
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

  if (mobile) {
    await page.locator('.app-menu-toggle').click().catch(() => { });
    await page.waitForTimeout(500);
  }
  await page.locator('#categorie-principale').selectOption('transaction').catch(() => { });
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const box = el => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const cam = document.querySelector('.caisse-module .pos-btn-camera');
    const inp = document.querySelector('.caisse-module .pos-input-field');
    const btn = document.querySelector('.caisse-module .pos-btn-scan-ajouter');
    const add = document.querySelector('.caisse-module .pos-action-buttons-row .pos-btn-primary');
    const red = document.querySelector('.caisse-module .pos-action-buttons-row .pos-btn-warning');
    const sb = document.querySelector('aside#appSidebar, .app-sidebar');
    const main = document.querySelector('main.app-main');
    const bsb = sb ? sb.getBoundingClientRect() : null;

    return {
      cameraAGauche: !!(cam && inp) && cam.getBoundingClientRect().x < inp.getBoundingClientRect().x,
      camera: box(cam), champ: box(inp), boutonScan: box(btn),
      boutonsCatalogue: { ajouter: box(add), reduire: box(red) },
      sidebar: bsb ? { x: Math.round(bsb.x), w: Math.round(bsb.width), h: Math.round(bsb.height) } : null,
      menuPleineHauteur: bsb ? Math.round(bsb.height) >= window.innerHeight - 1 : false,
      mainX: main ? Math.round(main.getBoundingClientRect().x) : null,
      debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  console.log(`\n=== ${nom} ===`);
  console.log(JSON.stringify(m, null, 2));
  await page.screenshot({ path: `tests/qa-mobile/verif-scan-${nom}.png` });
  await contexte.close();
}

await navigateur.close();
