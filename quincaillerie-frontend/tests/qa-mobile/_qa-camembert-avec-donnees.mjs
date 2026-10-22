/* Preuve visuelle du bloc camembert RESTAURÉ (légende de familles, « Autres »
   dépliable, sélecteur, bloc « Remplacer »).

   Aucune modification de l'application ni de la base : seules les réponses
   `GET /api/auth/moi` et `GET /api/products` sont simulées DANS le navigateur
   pour fournir un catalogue de familles. */
const UTILISATEUR = { nom: 'QA', email: 'demo@skys-erp.com', role: 'Administrateur' };
/* `companyId` est requis par useDonneesServeur pour déclencher le chargement. */
const ENTREPRISE = { nom: 'Quincaillerie QA', slug: 'demo', abonnementActif: true, companyId: 'qa0000000000000000000001' };

const FAMILLES = [
  ['Plomberie', 6], ['Électricité', 5], ['Peinture', 4], ['Quincaillerie', 3],
  ['Outillage', 2], ['Sanitaire', 2], ['Jardin', 1], ['Divers', 1]
];

const PRODUITS = FAMILLES.flatMap(([famille, nombre], f) =>
  Array.from({ length: nombre }, (_, i) => ({
    _id: `qa-${f}-${i}`,
    ref: `QA-${f}-${i}`,
    nom: `${famille} ${i + 1}`,
    famille,
    quantiteStock: 10,
    minStock: 2,
    prixVente: 1000,
    prixAchat: 800,
    unite: 'pièce',
    stockParDepot: {}
  }))
);

export default async function run(page) {
  await page.setViewportSize({ width: 1366, height: 900 });

  // Diagnostic : URLs produit réellement demandées.
  const urlsProduits = [];
  page.on('request', req => {
    if (req.url().includes('/api/products')) urlsProduits.push(req.url());
  });

  await page.addInitScript(([u, e]) => {
    localStorage.setItem('skys_erp_jeton', 'jeton-qa-mobile');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: u, entreprise: e }));
  }, [UTILISATEUR, ENTREPRISE]);

  // Le serveur de développement ne sert le module de session qu'APRÈS le
  // premier affichage : on recharge une fois les interceptations en place.
  await page.route('**/api/auth/moi', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ utilisateur: UTILISATEUR, entreprise: ENTREPRISE })
  }));

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  await page.route(/\/api\/products(\?|$)/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(PRODUITS)
  }));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  // L'app rouvre le dernier module : retour explicite au tableau de bord.
  await page.locator('.sidebar a, .app-sidebar a, .sidebar button, .app-sidebar button')
    .filter({ hasText: /Tableau de [Bb]ord/ }).first()
    .click({ timeout: 5000 }).catch(() => { });
  await page.waitForTimeout(2500);

  // Ouvre la liste déroulante « Autres » de la légende, comme sur la capture
  // de référence camembert-remplacer.png.
  const details = page.locator('.app-main details').first();
  await details.evaluate(el => { el.open = true; }).catch(() => { });
  await page.waitForTimeout(400);

  // Déroule aussi le bloc « Remplacer une famille affichée ».
  await page.evaluate(() => {
    [...document.querySelectorAll('details')]
      .find(d => /Remplacer une famille/.test(d.textContent))
      ?.setAttribute('open', '');
  });
  await page.waitForTimeout(400);

  return { ...(await page.evaluate(() => ({
    camembert: Boolean(document.querySelector('svg[aria-label*="Répartition"]')),
    selecteurFamilles: Boolean(document.getElementById('nb-familles-camembert')),
    legendeAutresDepliable: [...document.querySelectorAll('details summary')]
      .some(el => /^Autres \(\d+\)/.test(el.textContent.trim())),
    blocRemplacer: document.body.innerText.includes('Remplacer une famille affichée'),
    nombreTableaux: document.querySelectorAll('.app-main table').length
  }))), urlsProduits: urlsProduits.slice(0, 4), produitsSimules: PRODUITS.length };
}
