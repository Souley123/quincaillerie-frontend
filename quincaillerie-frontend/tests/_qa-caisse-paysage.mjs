/**
 * REPRODUIT LA CAPTURE DE L'UTILISATEUR : téléphone en PAYSAGE.
 *
 * La capture montre un écran large (barre d'état + navigation), probablement
 * un téléphone en orientation paysage (~850-920 px de large). Or nos règles
 * mobiles s'arrêtent à 768 px : au-delà, le module garde sa grille d'ordinateur
 * `1fr 1fr` et déborde.
 *
 * Usage : node tests/_qa-caisse-paysage.mjs
 */
import { chromium } from 'playwright';

const SITE = process.argv[2] || 'https://souley123.github.io/quincaillerie-frontend';

const entreprise = {
  companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test',
  devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

const navigateur = await chromium.launch({ channel: 'chrome' });

for (const [nom, largeur, hauteur] of [
  ['paysage-915', 915, 412],
  ['paysage-851', 851, 393],
  ['portrait-412', 412, 915],
  // Taille de la capture utilisateur (1832 × 858), cas signalé.
  ['capture-1832', 1832, 858]
]) {
  const contexte = await navigateur.newContext({
    viewport: { width: largeur, height: hauteur }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR'
  });
  const page = await contexte.newPage();

  await page.route('**/api/**', route => {
    if (route.request().url().includes('/api/auth/moi')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ utilisateur: { id: 'u1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise })
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.addInitScript(e => {
    localStorage.setItem('skys_erp_jeton', 'jeton-test');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: 'u1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
    localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
    localStorage.setItem('skys_erp_subscribed', 'true');
  }, entreprise);

  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.locator('.app-menu-toggle').click({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('#categorie-principale').selectOption('transaction').catch(() => {});
  await page.waitForTimeout(1800);

  const m = await page.evaluate(() => {
    const grille = document.querySelector('.caisse-grille');
    const largeur = document.documentElement.clientWidth;
    const din = [];
    document.querySelectorAll('.caisse-module *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (el.closest('.caisse-table-defile') && !el.classList.contains('caisse-table-defile')) return;
      if (r.right > largeur + 1) din.push(`${el.tagName.toLowerCase()} ${Math.round(r.left)}..${Math.round(r.right)}`);
    });
    return {
      ecran: largeur,
      page: document.documentElement.scrollWidth,
      colonnes: grille ? getComputedStyle(grille).gridTemplateColumns : null,
      cartes: grille ? [...grille.children].map(c => Math.round(c.getBoundingClientRect().width)) : [],
      debordements: din.slice(0, 6)
    };
  });

  console.log(`\n=== ${nom} (${largeur}×${hauteur}) ===`);
  console.log(JSON.stringify(m, null, 2));
  await page.screenshot({ path: `tests/qa-mobile/caisse-${nom}.png`, fullPage: true });
  await contexte.close();
}

await navigateur.close();
