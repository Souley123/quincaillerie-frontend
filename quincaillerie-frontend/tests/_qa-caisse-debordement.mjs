/**
 * QA « zéro débordement » — Caisse & Transactions sur téléphone.
 *
 * Ce script ne se contente pas de regarder : il MESURE.
 *   - tout élément qui dépasse à gauche ou à droite de l'écran ;
 *   - tout élément plus large que son conteneur ;
 *   - la largeur réelle du document vs celle de l'écran.
 *
 * Usage : node tests/_qa-caisse-debordement.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';

const PROFILS = [
  ['pixel5', devices['Pixel 5']],
  ['petit-android-360', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ['iphone-se-320', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]
];

const navigateur = await chromium.launch({ channel: 'chrome' });

for (const [nom, options] of PROFILS) {
  const contexte = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const page = await contexte.newPage();

  await page.route('**/api/**', async route => {
    const url = route.request().url();
    if (url.includes('/api/auth/moi')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          utilisateur: { id: 'u1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true },
          entreprise: { companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test', devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true, abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString() }
        })
      });
    }
    if (url.includes('/api/produits') || url.includes('/api/produit')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'p1', nom: 'Ciment CIM II 42,5 — sac de 50 kg', prix: 4200, quantiteStock: 120 },
          { _id: 'p2', nom: 'Fer à béton 12 mm x 12 m', prix: 9500, quantiteStock: 60 }
        ])
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.addInitScript(() => {
    const entreprise = { companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test', devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true, abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString() };
    localStorage.setItem('skys_erp_jeton', 'jeton-test');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: 'u1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise }));
    localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
    localStorage.setItem('skys_erp_subscribed', 'true');
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const mesure = async (etape) => page.evaluate(etape => {
    const largeur = document.documentElement.clientWidth;
    const debordements = [];
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.visibility === 'hidden' || style.display === 'none') return;
      if (r.right > largeur + 1 || r.left < -1) {
        const dansDefilement = el.closest('.caisse-table-defile, [style*="overflow-x"], .app-table-scroll');
        if (!dansDefilement) {
          debordements.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} → left ${Math.round(r.left)} / right ${Math.round(r.right)} (écran ${largeur})`);
        }
      }
    });
    return {
      largeurEcran: largeur,
      scrollLargeur: document.documentElement.scrollWidth,
      debordements: debordements.slice(0, 8),
      nombre: debordements.length
    };
  }, etape);

  console.log(`\n=== ${nom} (${options.viewport?.width || 'device'} px) ===`);

  // Étape 1 : simuler un panier non vide n'est pas nécessaire — on contrôle
  // déjà la structure rendue (barre de scan, cartes, boutons).
  const r1 = await mesure('accueil');
  console.log('Accueil   :', JSON.stringify(r1));

  // Étape 2 : on force le rendu de l'écran Caisse si le menu est accessible.
  const cible = page.getByText('Caisse & Transactions').first();
  if (await cible.count()) {
    await cible.click().catch(() => {});
    await page.waitForTimeout(1200);
    const r2 = await mesure('caisse');
    console.log('Caisse    :', JSON.stringify(r2));
    await page.screenshot({ path: `tests/qa-mobile/caisse-${nom}.png`, fullPage: true });
  } else {
    console.log('Caisse    : écran non atteint automatiquement (menu)');
  }

  await contexte.close();
}

await navigateur.close();
