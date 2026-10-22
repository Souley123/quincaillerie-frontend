/**
 * QA responsive téléphone (Android / iOS) — capture et mesurage.
 *
 * Ce script NE SE CONTENTE PAS de regarder : il mesure, dans un vrai
 * navigateur, les trois défauts signalés :
 *   1) débordement horizontal de la PAGE (les blocs sortent-ils à droite ?) ;
 *   2) éléments trop petits pour le doigt (< 40 px) ;
 *   3) bordure collée au bord de l'écran (trait visible en haut ou sur les côtés).
 *
 * Usage :
 *   node tests/_qa-mobile.mjs [url]
 * Produit : tests/qa-mobile/<appareil>.png et un rapport JSON.
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL_APP = process.argv[2] || 'http://127.0.0.1:3000/';
const CIBLES = [
  { nom: 'android-pixel5', appareil: devices['Pixel 5'] },
  { nom: 'iphone-12', appareil: devices['iPhone 12'] },
  { nom: 'iphone-se', appareil: devices['iPhone SE'] }
];

/* Mesure faite DANS la page : aucune supposition, que des valeurs réelles. */
const mesures = () => {
  const doc = document.documentElement;
  const largeurVue = window.innerWidth;

  const debordements = [];
  document.querySelectorAll('body *').forEach(element => {
    const style = getComputedStyle(element);
    if (style.position === 'fixed' || style.display === 'none' || style.visibility === 'hidden') return;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    // Un tableau large DOIT défiler dans son conteneur : il est ignoré ici.
    if (element.closest('[style*="overflowX"], .app-table-scroll')) return;
    if (rect.right > largeurVue + 1 || rect.left < -1) {
      debordements.push({
        balise: element.tagName.toLowerCase(),
        classes: element.className && typeof element.className === 'string' ? element.className : '',
        gauche: Math.round(rect.left),
        droite: Math.round(rect.right)
      });
    }
  });

  const tropPetits = [];
  document.querySelectorAll('button, input, select, textarea').forEach(element => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    if (rect.height < 40) {
      tropPetits.push({
        balise: element.tagName.toLowerCase(),
        type: element.type || '',
        texte: (element.textContent || element.placeholder || '').trim().slice(0, 40),
        hauteur: Math.round(rect.height)
      });
    }
  });

  const enTete = document.querySelector('.app-header');
  const styleEntete = enTete ? getComputedStyle(enTete) : null;
  const carte = document.querySelector('.login-card');

  return {
    largeurVue,
    defilementHorizontal: doc.scrollWidth > largeurVue + 1,
    scrollWidth: doc.scrollWidth,
    debordements: debordements.slice(0, 10),
    nombreDebordements: debordements.length,
    tropPetits: tropPetits.slice(0, 12),
    nombreTropPetits: tropPetits.length,
    bordureEntete: styleEntete ? styleEntete.borderBottomWidth : null,
    bordureCarte: carte ? getComputedStyle(carte).borderTopWidth : null,
    margeGaucheContenu: (() => {
      const principal = document.querySelector('.app-main');
      return principal ? getComputedStyle(principal).paddingLeft : null;
    })()
  };
};

await mkdir(new URL('./qa-mobile/', import.meta.url), { recursive: true });
/* On réutilise le Chrome installé sur le poste : cela évite le téléchargement
   de Chromium (~197 Mo), bloqué par le réseau sur cette machine. */
const navigateur = await chromium.launch({ channel: 'chrome' });
const rapport = {};

for (const cible of CIBLES) {
  const contexte = await navigateur.newContext({ ...cible.appareil, locale: 'fr-FR' });
  const page = await contexte.newPage();

  // L'appel au backend est simulé : on vérifie la mise en page, pas la données.
  await page.route('**/api/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]'
  }));

  await page.goto(URL_APP, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1200);

  const ecranConnexion = await page.evaluate(mesures);
  const dossier = new URL('./qa-mobile/', import.meta.url);
  await page.screenshot({
    path: decodeURIComponent(dossier.pathname).replace(/^\/(\w:)/, '$1') + `${cible.nom}-connexion.png`,
    fullPage: true
  });

  rapport[cible.nom] = ecranConnexion;
  await contexte.close();
}

await navigateur.close();
console.log(JSON.stringify(rapport, null, 2));
