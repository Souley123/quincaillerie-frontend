/* MESURE de la largeur de la Caisse & Transactions (lecture seule).

   Objectif : quantifier « c'est trop large » sur ordinateur. On mesure, à
   plusieurs largeurs d'écran, la largeur des cartes de la caisse et la place
   réellement occupée par leur contenu, puis on en déduit la zone morte.

   Usage :
     node tests/qa-mobile/_mesure-caisse-largeur.mjs
   Sortie : un rapport JSON sur la sortie standard, une ligne par largeur. */
import { chromium } from 'playwright';

const ARGUMENTS = process.argv.slice(2);
/* L'URL est le premier argument qui n'est PAS une option (--capture). */
const URL_APP = ARGUMENTS.find(arg => !arg.startsWith('--')) || 'http://localhost:3000/';
const CAPTURE = ARGUMENTS.includes('--capture');
const HAUTEUR = 900;
const LARGEURS = [1366, 1600, 1832, 1920];

const UTILISATEUR = { nom: 'QA', email: 'demo@skys-erp.com', role: 'Administrateur' };
const ENTREPRISE = {
  nom: 'Quincaillerie QA',
  slug: 'demo',
  abonnementActif: true,
  companyId: 'qa0000000000000000000001'
};

const PRODUITS = Array.from({ length: 6 }, (_, i) => ({
  _id: `qa-${i}`,
  ref: `QA-${i}`,
  nom: `Article QA ${i + 1}`,
  famille: 'Plomberie',
  quantiteStock: 10,
  minStock: 2,
  prixVente: 1000,
  prixAchat: 800,
  unite: 'pièce',
  stockParDepot: {}
}));

/* Mesure faite DANS la page, sur le DOM réel : ce que l'utilisateur voit. */
const mesurer = () => {
  const grille = document.querySelector('.caisse-grille');
  if (!grille) return { erreur: 'grille de la caisse absente' };

  const rectGrille = grille.getBoundingClientRect();
  const cartes = [...grille.children].map(carte => {
    const r = carte.getBoundingClientRect();
    const style = getComputedStyle(carte);
    const interieur = [...carte.children]
      .map(enfant => enfant.getBoundingClientRect())
      .filter(x => x.width > 0 && x.height > 0);
    const hautContenu = interieur.length ? Math.min(...interieur.map(x => x.top)) : r.top;
    const basContenu = interieur.length ? Math.max(...interieur.map(x => x.bottom)) : r.bottom;

    return {
      largeur: Math.round(r.width),
      hauteur: Math.round(r.height),
      /* Écart entre le bas du contenu et le bas de la carte : un chiffre
         élevé signifie « carte étirée, vide en dessous ». */
      videEnBas: Math.round(r.bottom - parseFloat(style.paddingBottom) - basContenu),
      videEnHaut: Math.round(hautContenu - r.top - parseFloat(style.paddingTop))
    };
  });

  const titreModule = document.querySelector('.caisse-titre');

  return {
    ecran: window.innerWidth,
    colonnesGrille: getComputedStyle(grille).gridTemplateColumns,
    grilleLargeur: Math.round(rectGrille.width),
    grilleMargeGauche: Math.round(rectGrille.left),
    grilleMargeDroite: Math.round(window.innerWidth - rectGrille.right),
    /* Le module ne doit PAS réafficher son titre : l'en-tête le porte déjà. */
    titreModuleEnDouble: Boolean(titreModule && titreModule.offsetParent !== null),
    cartes
  };
};

const navigateur = await chromium.launch({ channel: 'chrome' });
const rapport = {};

for (const largeur of LARGEURS) {
  const page = await (await navigateur.newContext({
    viewport: { width: largeur, height: HAUTEUR },
    locale: 'fr-FR'
  })).newPage();

  await page.addInitScript(([u, e]) => {
    localStorage.setItem('skys_erp_jeton', 'jeton-qa-mobile');
    localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: u, entreprise: e }));
  }, [UTILISATEUR, ENTREPRISE]);

  await page.route('**/api/auth/moi', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ utilisateur: UTILISATEUR, entreprise: ENTREPRISE })
  }));

  await page.route(/\/api\/products(\?|$)/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(PRODUITS)
  }));

  await page.route(/\/api\/(?!products(\?|$)|auth\/moi)/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]'
  }));

  await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  /* OUVERTURE ROBUSTE DU MODULE
     ------------------------------------------------------------------
     Le seul libellé « Caisse & Transactions » n'est pas fiable pour
     désigner UN contrôle : il apparaît aussi dans le `<select>`
     « Catégories principales » et dans le plateau « Modules disponibles »
     de l'accueil. Cibler plusieurs familles de sélecteurs à la fois
     pouvait cliquer deux contrôles et produire une capture incohérente
     (deux modules visibles, barre latérale modifiée).

     On tente donc, DANS L'ORDRE, une seule source à la fois, et on vérifie
     après chaque essai que la grille de la caisse est réellement affichée. */
  const tentatives = [
    // 1. Lien de navigation de la barre latérale (libellé exact).
    page.locator('.sidebar a, .app-sidebar a')
      .filter({ hasText: /^\s*Caisse( & Transactions)?\s*$/i }),
    // 2. Bouton de navigation (et non un bouton quelconque du plateau).
    page.locator('.sidebar button, .app-sidebar button').filter({
      hasText: /^\s*Caisse( & Transactions)?\s*$/i
    }),
    // 3. Repli assumé : le sélecteur de catégories de l'accueil.
    page.locator('select#categorie-principale, select[name="categorie"]')
  ];

  for (const [index, cible] of tentatives.entries()) {
    if (!(await cible.count().catch(() => 0))) continue;

    if (index === tentatives.length - 1) {
      // Dernier repli : c'est un `<select>`, pas un clic.
      await cible.first().selectOption('transaction').catch(() => { });
    } else {
      await cible.first().click({ timeout: 5000 }).catch(() => { });
    }

    const affichee = await page.locator('.caisse-grille').first()
      .waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (affichee) break;
  }

  await page.waitForTimeout(1500);

  rapport[largeur] = await page.evaluate(mesurer);
  /* Témoin : le pied de la zone de contenu, où se trouvent les boutons
     d'action du panier (« Valider et Encaisser », « Payer », « Imprimer »).
     Sur une capture pleine page à 900 px, leur présence prouve que la
     rangée inférieure est bien visible, comme sur la capture de référence. */
  rapport[largeur].detail = await page.evaluate(() => {
    const bouton = [...document.querySelectorAll('button')]
      .find(b => /Valider et Encaisser/i.test(b.textContent || ''));
    return bouton
      ? { 'boutonsPresents': true, 'boutonsVisibles': bouton.getBoundingClientRect().bottom <= window.innerHeight }
      : { 'boutonsPresents': false };
  });
  if (CAPTURE) {
    await page.screenshot({ path: `./tests/qa-mobile/caisse-${largeur}.png` });
  }
  await page.context().close();
}

console.log(JSON.stringify(rapport, null, 2));
await navigateur.close();
