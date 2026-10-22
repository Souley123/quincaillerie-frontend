/* MESURE de compacité du tableau de bord (lecture seule, ne modifie rien).

   Produit deux chiffres par bloc du tableau de bord, à 1366 × 900 :
     • largeurVisible : place réellement occupée par le CONTENU (donut + légende) ;
     • largeurDisponible : place offerte par la carte (panneau).
   Un écart important = zone morte, dont la capture de référence
   « camembert-restaure-avec-familles.png » ne montre aucune trace.

   Usage :
     node tests/qa-mobile/_mesure-dashboard-compacite.mjs
   Sortie : un rapport JSON sur la sortie standard (aucune capture écrite). */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:3000/';
const VIEWPORT = { width: 1366, height: 900 };

const UTILISATEUR = { nom: 'QA', email: 'demo@skys-erp.com', role: 'Administrateur' };
const ENTREPRISE = {
  nom: 'Quincaillerie QA',
  slug: 'demo',
  abonnementActif: true,
  companyId: 'qa0000000000000000000001'
};

/* Même catalogue que la capture de référence : 7 familles + « Autres ». */
const FAMILLES = [
  ['Plomberie', 6], ['Électricité', 5], ['Peinture', 4], ['Outillage', 3],
  ['Sanitaire', 2], ['Jardin', 2], ['Divers', 1], ['Quincaillerie', 1]
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

/* Mesure faite DANS la page, sur le DOM réel. */
const mesurer = () => {
  const carte = [...document.querySelectorAll('.dashboard-panel')]
    .find(panneau => /Articles par famille/i.test(panneau.innerText));
  if (!carte) return { erreur: 'carte « Articles par famille » introuvable' };

  const bloc = carte.querySelector('svg[aria-label*="Répartition"]')?.parentElement;
  const svg = bloc?.querySelector('svg');
  if (!svg) {
    return {
      erreur: 'carte sans camembert : données catalogue absentes',
      extrait: carte.innerText.replace(/\s+/g, ' ').slice(0, 120)
    };
  }
  const legende = bloc.nextElementSibling;

  const largeur = element => (element ? Math.round(element.getBoundingClientRect().width) : null);
  const style = element => (element ? getComputedStyle(element) : null);

  const innerGauche = carte.getBoundingClientRect().left + parseFloat(style(carte).paddingLeft);
  const innerDroite = carte.getBoundingClientRect().right - parseFloat(style(carte).paddingRight);

  const legendeStyle = style(legende);

  return {
    largeurCarte: largeur(carte),
    largeurInnerContenu: Math.round(innerDroite - innerGauche),
    largeurDonut: largeur(svg),
    largeurLegende: largeur(legende),
    colonnesLegende: legendeStyle ? legendeStyle.gridTemplateColumns : null,
    gouttiereContenu: bloc ? style(bloc).gap : null,
    svgLargeurAttribut: svg ? svg.getAttribute('width') + '×' + svg.getAttribute('height') : null,
    /* Vide à droite du camembert = largeur de la légende moins ses colonnes. */
    zoneMorteEstimee: legende
      ? Math.round(legende.getBoundingClientRect().right - (legende.lastElementChild?.getBoundingClientRect().right || 0))
      : null,
    hauteurCarte: Math.round(carte.getBoundingClientRect().height),
    /* Position du SECOND bloc : sur la capture de référence il commence dans
       le premier écran, donc entièrement visible à 900 px de hauteur. */
    /* Le second graphique n'est rendu qu'avec des articles : l'absence des
       deux champs ci-dessous indique qu'il manque sur l'écran mesuré. */
    secondBlocTop: (() => {
      const vue = [...document.querySelectorAll('.dashboard-panel')]
        .find(panneau => /Nombre d.articles par famille/i.test(panneau.innerText));
      return vue ? Math.round(vue.getBoundingClientRect().top) : null;
    })(),
    secondBlocVisibleEnEntier: (() => {
      const vue = [...document.querySelectorAll('.dashboard-panel')]
        .find(panneau => /Nombre d.articles par famille/i.test(panneau.innerText));
      return vue ? vue.getBoundingClientRect().bottom <= window.innerHeight : null;
    })(),
    hauteurPage: document.documentElement.scrollHeight,
    hauteurEcran: window.innerHeight,
    policeTitre: style(carte.querySelector('h3'))?.fontSize || null,
    paddingCarte: (function () {
      const s = style(carte);
      return `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`;
    })()
  };
};

/* Capture l'état MESURÉ (témoin avant/après), pas la capture de référence. */
const CAPTURE = process.env.CAPTURE || '';

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await (await navigateur.newContext({ viewport: VIEWPORT, locale: 'fr-FR' })).newPage();

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

/* Même quand l'API réelle répond, la base peut être absente : les autres
   lectures rendent une liste vide, ce qui n'affecte pas le camembert. */
await page.route(/\/api\/(?!products(\?|$)|auth\/moi)/, route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: '[]'
}));

await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

await page.locator('.sidebar a, .app-sidebar a, .sidebar button, .app-sidebar button')
  .filter({ hasText: /Tableau de [Bb]ord/ }).first()
  .click({ timeout: 5000 }).catch(() => { });
await page.waitForTimeout(2500);

/* On ouvre le détail « Autres » comme sur la capture de référence. */
await page.locator('.app-main details').first().evaluate(el => { el.open = true; }).catch(() => { });
await page.waitForTimeout(400);

console.log(JSON.stringify(await page.evaluate(mesurer), null, 2));
if (CAPTURE) await page.screenshot({ path: CAPTURE, fullPage: true });
await navigateur.close();
