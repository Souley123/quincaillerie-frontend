/* ==========================================================================
   AUDIT MOBILE DES TABLEAUX (Android / iOS) — script unique et réutilisable
   --------------------------------------------------------------------------
   Remplace les scripts jetables qa-capture*.mjs / qa-mobile-tables*.mjs.

   Objectif : vérifier EN VRAI, sur un viewport de téléphone (390 × 844 par
   défaut), que chaque tableau de l'ERP défile horizontalement, ne déborde
   jamais de la page et garde des colonnes lisibles.

   Usage :
     node <skill>/browser.mjs http://localhost:3000/ \
       --script ./tests/qa-mobile/_qa-mobile-tableaux.mjs \
       --screenshot ./tests/qa-mobile/audit-tableaux-390.png

   ⚠ Le script NE MODIFIE PAS l'application. Il contourne seulement la
   vérification de session (le serveur MongoDB peut être injoignable), en
   interceptant `GET /api/auth/moi` dans le navigateur. Toutes les autres
   requêtes restent réelles.

   Lecture du résultat :
     • debordementPage doit valoir 0 (rien ne sort de l'écran) ;
     • pour chaque tableau à colonnes nombreuses, `scrollable` doit être true
       et `reel > visible` (c'est le signe que le défilement horizontal joue).
   ========================================================================== */

const VIEWPORT = { width: 390, height: 844 };

const UTILISATEUR = {
  nom: 'QA Mobile',
  email: 'demo@skys-erp.com',
  role: 'Administrateur'
};
const ENTREPRISE = { nom: 'Quincaillerie QA', slug: 'demo', abonnementActif: true };

/** Ouvre l'ERP en contournant uniquement la vérification de session. */
async function preparerSession(page) {
  await page.setViewportSize(VIEWPORT);

  await page.addInitScript(([u, e]) => {
    localStorage.setItem('skys_erp_jeton', 'jeton-qa-mobile');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: u, entreprise: e }));
  }, [UTILISATEUR, ENTREPRISE]);

  await page.route('**/api/auth/moi', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ utilisateur: UTILISATEUR, entreprise: ENTREPRISE })
  }));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  return page.evaluate(() => !document.querySelector('input[type=password]')
    && Boolean(document.querySelector('.app-main')));
}

/** Ouvre un module par son libellé dans la barre latérale. */
async function ouvrirModule(page, nom) {
  if (await page.locator('.app-menu-toggle').isVisible().catch(() => false)) {
    await page.locator('.app-menu-toggle').click().catch(() => { });
    await page.waitForTimeout(600);
  }
  const lien = page.locator('.sidebar a, .app-sidebar a, .sidebar button, .app-sidebar button')
    .filter({ hasText: new RegExp(nom, 'i') }).first();
  if (!(await lien.count())) return false;
  await lien.click({ timeout: 5000 }).catch(() => { });
  await page.waitForTimeout(2000);
  return true;
}

/**
 * Mesure les tableaux visibles de l'écran courant.
 * L'aperçu d'impression (.print-only) est exclu : il ne défile pas.
 */
const mesurerTableaux = page => page.evaluate(() => {
  const tables = [...document.querySelectorAll('.app-main table')]
    .filter(t => t.getBoundingClientRect().width > 0 && !t.closest('.print-only'));

  return {
    debordementPage: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    nb: tables.length,
    tableaux: tables.map((t, i) => {
      const c = t.parentElement;
      return {
        i,
        colonnes: t.querySelectorAll('thead th').length,
        overflowX: getComputedStyle(c).overflowX,
        scrollable: c.scrollWidth > c.clientWidth + 1,
        visible: c.clientWidth,
        reel: t.scrollWidth
      };
    })
  };
});

export default async function run(page) {
  const connecte = await preparerSession(page);
  if (!connecte) {
    return {
      connecte: false,
      motif: "l'ERP ne s'est pas ouvert — vérifier que le frontend tourne sur l'URL passée en argument"
    };
  }

  const rapport = { connecte: true, viewport: VIEWPORT, ecrans: {} };

  // Modules contenant des tableaux (noms tels qu'affichés dans le menu).
  const modules = ['Stock', 'Clients', 'Caisse', 'Transport', 'Mouvements', 'Dépenses'];

  for (const nom of modules) {
    const ouvert = await ouvrirModule(page, nom);
    rapport.ecrans[nom] = ouvert ? await mesurerTableaux(page) : 'module introuvable';
  }

  // Retour sur Stock : la capture d'écran finale montre un tableau réel.
  await ouvrirModule(page, 'Stock');
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('.app-main table')]
      .find(x => x.getBoundingClientRect().width > 0 && !x.closest('.print-only'));
    if (t) t.parentElement.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(800);

  // Verdict synthétique, lisible sans interpréter les chiffres.
  const ecrans = Object.values(rapport.ecrans).filter(v => typeof v === 'object');
  rapport.verdict = {
    debordementPageMax: Math.max(0, ...ecrans.map(e => e.debordementPage)),
    tableauxMesures: ecrans.reduce((n, e) => n + e.nb, 0),
    tableauxDefilables: ecrans.reduce(
      (n, e) => n + e.tableaux.filter(t => t.scrollable).length, 0
    )
  };

  return rapport;
}
