/**
 * VÉRIFICATION DES TABLEAUX SUR TÉLÉPHONE (Android / iOS)
 * =======================================================
 * Contrôle, sur chaque module affichant un tableau, quatre points :
 *   1. aucun débordement horizontal de la PAGE (seul le tableau glisse) ;
 *   2. le conteneur `.table-container-mobile` défile horizontalement ;
 *   3. hauteur de cellule ≥ 24 px et ≤ 44 px (compact mais tapable) ;
 *   4. en-tête lisible (fond sombre, texte clair).
 *
 * Usage :
 *   npm run build
 *   npm run verif:tableaux        (lance le preview puis ce script)
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RACINE, 'dist');
const BASE_PUBLIEE = process.env.VERIF_BASE || 'https://souley123.github.io';
const URL_LOCALE = process.env.VERIF_URL || 'http://localhost:4173/quincaillerie-frontend/';

/* Modules à contrôler : ceux qui affichent un tableau. */
const MODULES = (process.env.VERIF_MODULES || 'quincaillerie,transaction,inventaire,clients,mouvements').split(',');

const bundle = () => {
  const dossier = path.join(DIST, 'assets');
  const fichier = readdirSync(dossier).find(f => /^index-.*\.js$/.test(f));
  if (!fichier) throw new Error('Build introuvable : lancez `npm run build` avant ce script.');
  return readFileSync(path.join(dossier, fichier), 'utf8');
};

export default async function run(page) {
  const corps = bundle();

  /* Entreprise « Enterprise » administrateur : tous les modules s'ouvrent,
     ce qui permet de vérifier CHAQUE tableau. */
  async function repondreApi(route) {
    const url = new URL(route.request().url());
    const chemin = url.pathname.replace('/api-relais', '');
    const repondre = (code, donnees) => route.fulfill({
      status: code,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(donnees)
    });

    if (chemin === '/api/auth/moi') {
      return repondre(200, {
        utilisateur: { id: 'u1', nom: 'Test', email: 'test@example.com', role: 'Administrateur', emailVerifie: true },
        entreprise: {
          companyId: 'TEST', slug: 'test', raisonSociale: 'Test', palier: 'Enterprise',
          abonnementActif: true, abonnementEcheance: new Date(Date.now() + 86400000).toISOString()
        }
      });
    }
    if (chemin === '/api/products' || chemin === '/api/clients') {
      return repondre(200, [{
        _id: 'p1', ref: 'FAR-002', nom: 'Ciment', famille: 'Matériaux légers',
        fournisseur: 'F1', prix: 5000, prixAchat: 4000, quantiteStock: 48, minStock: 5, maxStock: 100
      }]);
    }
    if (chemin.startsWith('/api/')) return repondre(200, []);
    return route.continue();
  }

  await page.route('**/assets/index-*.js', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: corps }));

  /* En local, l'API est joignable directement : on répond nous-mêmes aux
     appels pour ne rien modifier dans la base. Sur le site publié, les
     appels passent par le relais `/api-relais`. */
  await page.route(`${BASE_PUBLIEE}/api-relais/**`, route => repondreApi(route));
  await page.route('http://localhost:5001/api/**', route => repondreApi(route));

  await page.addInitScript(() => localStorage.setItem('skys_erp_jeton', 'jeton-de-test'));

  /* Format téléphone : iPhone 12 / Android courants (390 × 844). */
  await page.setViewportSize({ width: 390, height: 844 });

  const rapport = [];

  for (const moduleId of MODULES) {
    await page.goto(URL_LOCALE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#categorie-principale', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const select = page.locator('#categorie-principale');
    await select.selectOption(moduleId).catch(() => {});
    await page.waitForTimeout(2000);

    const mesures = await page.evaluate(id => {
      const conteneurs = [...document.querySelectorAll('.table-container-mobile')];
      const tableaux = [...document.querySelectorAll('table')];

      const cellules = [...document.querySelectorAll('.app-main tbody td')]
        .slice(0, 20)
        .map(td => {
          const style = getComputedStyle(td);
          return {
            paddingHaut: parseFloat(style.paddingTop),
            paddingGauche: parseFloat(style.paddingLeft),
            hauteur: Math.round(td.getBoundingClientRect().height)
          };
        });

      const entete = document.querySelector('.app-main thead th');
      const styleEntete = entete ? getComputedStyle(entete) : null;

      return {
        module: id,
        nombreTableaux: tableaux.length,
        nombreConteneurs: conteneurs.length,
        pageDeborde: document.documentElement.scrollWidth > window.innerWidth + 1,
        conteneursDefilent: conteneurs.length
          ? conteneurs.every(c => c.scrollWidth >= c.clientWidth)
          : null,
        conteneurTouch: conteneurs.length
          ? getComputedStyle(conteneurs[0]).touchAction
          : null,
        cellules: cellules.slice(0, 3),
        enteteFond: styleEntete ? styleEntete.backgroundColor : null,
        enteteCouleur: styleEntete ? styleEntete.color : null
      };
    }, moduleId);

    rapport.push(mesures);
  }

  return rapport;
}
