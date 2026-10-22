/**
 * MESURE ciblée du module CAISSE (et non de l'accueil).
 *
 * Le script ouvre le menu, clique sur « Caisse & Transactions », ajoute un
 * article au panier (pour que le tableau soit rendu), puis mesure :
 *   - la largeur réelle de la page vs celle de l'écran ;
 *   - chaque élément qui dépasse à droite ou à gauche ;
 *   - la position des boutons d'action.
 *
 * Usage : node tests/_qa-caisse-mesure.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const navigateur = await chromium.launch({ channel: 'chrome' });

const PROFILS = [
  ['pixel5', devices['Pixel 5']],
  ['iphone-se-320', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]
];

const entreprise = {
  companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Test',
  devise: 'FCFA', tauxTva: 18, palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};

for (const [nom, options] of PROFILS) {
  const contexte = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const page = await contexte.newPage();

  await page.route('**/api/**', route => {
    const url = route.request().url();
    if (url.includes('/api/auth/moi')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ utilisateur: { id: 'u1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise })
      });
    }
    if (/produit/i.test(url)) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { _id: 'p1', nom: 'Ciment CIM II 42,5 — sac de 50 kg', prix: 4200, quantiteStock: 120, categorie: 'Matériaux' },
          { _id: 'p2', nom: 'Fer à béton 12 mm x 12 m', prix: 9500, quantiteStock: 60, categorie: 'Matériaux' }
        ])
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.addInitScript(e => {
    localStorage.setItem('skys_erp_jeton', 'jeton-test');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: { id: 'u1', nom: 'Test', email: 't@t.t', role: 'Administrateur', emailVerifie: true }, entreprise: e }));
    localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
    localStorage.setItem('skys_erp_subscribed', 'true');
  }, entreprise);

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);

  // Ouvrir le menu puis aller sur la caisse.
  const menu = page.locator('.app-menu-toggle');
  if (await menu.count()) { await menu.click().catch(() => {}); await page.waitForTimeout(500); }
  const lien = page.getByText(/Caisse & Transactions|Caisse/).first();
  if (await lien.count()) { await lien.click().catch(() => {}); await page.waitForTimeout(1500); }

  const surCaisse = await page.evaluate(() => ({
    caisse: Boolean(document.querySelector('.caisse-module')),
    scan: Boolean(document.querySelector('.scan-bar')),
    grille: Boolean(document.querySelector('.caisse-grille'))
  }));
  console.log(`\n=== ${nom} — module Caisse présent : ${JSON.stringify(surCaisse)} ===`);

  if (surCaisse.caisse) {
    // Remplir le panier par la VRAIE interface : on saisit un code-barres
    // connu dans la barre de scan, ce qui passe par la logique de l'application
    // (les produits de test sont fournis par la route simulée).
    const remplirPanier = async lecteurs => {
      for (const lecteur of lecteurs) {
        const champ = page.locator(lecteur).first();
        if (!(await champ.count())) continue;
        try {
          await champ.fill('P1');
          await champ.press('Enter');
          await page.waitForTimeout(700);
          if (await page.locator('.caisse-table-panier').count()) return true;
        } catch { /* essai suivant */ }
      }
      return false;
    };
    const ajoute = await remplirPanier(['#saisie-manuelle-code', '.scan-bar input']);
    console.log('Article ajouté au panier :', ajoute);

    const mesure = await page.evaluate(() => {
      const largeur = document.documentElement.clientWidth;
      const debordements = [];
      document.querySelectorAll('.caisse-module *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const dansDefilement = el.closest('.caisse-table-defile');
        if (dansDefilement) return;
        if (r.right > largeur + 1 || r.left < -1) {
          debordements.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} → ${Math.round(r.left)}..${Math.round(r.right)}`);
        }
      });
      const grille = document.querySelector('.caisse-grille');
      const actions = [...document.querySelectorAll('.caisse-actions button')].map(b => {
        const r = b.getBoundingClientRect();
        return { texte: b.innerText.trim().slice(0, 18), gauche: Math.round(r.left), droite: Math.round(r.right), largeur: Math.round(r.width) };
      });
      return {
        largeurEcran: largeur,
        largeurPage: document.documentElement.scrollWidth,
        colonnesGrille: grille ? getComputedStyle(grille).gridTemplateColumns : null,
        debordements,
        actions,
        tableauPresent: Boolean(document.querySelector('.caisse-table-panier')),
        defileurPresent: Boolean(document.querySelector('.caisse-table-defile'))
      };
    });

    console.log(JSON.stringify(mesure, null, 2));
    await page.screenshot({ path: `tests/qa-mobile/caisse-mesure-${nom}.png`, fullPage: true });
  }

  await contexte.close();
}

await navigateur.close();
