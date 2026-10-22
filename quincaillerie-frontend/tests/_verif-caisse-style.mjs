/**
 * VERIFICATION (lecture seule) — les styles reconstruits de la Caisse
 * s'appliquent-ils vraiment, et la page tient-elle sans debordement ?
 *
 *  - ordinateur 1366x768 et telephone 393x851 ;
 *  - on verifie la presence des regles .caisse-module (classe bien appliquee),
 *    la hauteur des blocs compacts et l'absence de debordement horizontal.
 *
 * Aucun fichier du projet n'est modifie. Usage :
 *   node tests/_verif-caisse-style.mjs [http://localhost:3000]
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
  ['ordinateur-1366', { width: 1366, height: 768 }, false],
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

  // Navigation vers le module Caisse & Transactions.
  if (mobile) {
    await page.locator('.app-menu-toggle').click().catch(() => { });
    await page.waitForTimeout(400);
  }
  const sel = page.locator('#categorie-principale');
  if (await sel.count()) {
    await sel.selectOption('transaction').catch(() => { });
  } else {
    await page.getByText(/Caisse & Transactions/).first().click().catch(() => { });
  }
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const px = el => el ? Math.round(el.getBoundingClientRect().height) : null;
    const w = el => el ? Math.round(el.getBoundingClientRect().width) : null;
    const cs = (el, p) => el ? getComputedStyle(el)[p] : null;
    const q = s => document.querySelector(s);

    const module = q('.caisse-module');
    const scanCard = q('.caisse-module .pos-scan-card');
    const input = q('.caisse-module .pos-input-field');
    const camera = q('.caisse-module .pos-btn-camera');
    const btnAjout = q('.caisse-module .pos-btn-scan-ajouter');
    const cartes = [...document.querySelectorAll('.caisse-module .pos-card')];
    const titres = [...document.querySelectorAll('.caisse-module .pos-card-titre-simple')];

    return {
      modulePresent: !!module,
      scan: { hauteur: px(scanCard), padding: cs(scanCard, 'padding') },
      champ: { hauteur: px(input), fontSize: cs(input, 'fontSize') },
      camera: { hauteur: px(camera) },
      boutonAjout: { hauteur: px(btnAjout), fontSize: cs(btnAjout, 'fontSize') },
      cartes: cartes.map(c => ({ hauteur: px(c), largeur: w(c), padding: cs(c, 'padding') })),
      titres: titres.map(t => ({ texte: t.textContent.trim(), fontSize: cs(t, 'fontSize'), marge: cs(t, 'marginBottom') })),
      grille: (() => {
        const g = q('.caisse-module .pos-grid-layout');
        return g ? { colonnes: getComputedStyle(g).gridTemplateColumns, gap: getComputedStyle(g).gap } : null;
      })(),
      panierVide: px(q('.caisse-module .pos-panier-vide')),
      ecran: document.documentElement.clientWidth,
      largeurPage: document.documentElement.scrollWidth,
      debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  console.log(`\n=== ${nom} ===`);
  console.log(JSON.stringify(m, null, 2));

  await page.screenshot({ path: `tests/qa-mobile/verif-caisse-${nom}.png`, fullPage: false });
  await contexte.close();
}

await navigateur.close();
