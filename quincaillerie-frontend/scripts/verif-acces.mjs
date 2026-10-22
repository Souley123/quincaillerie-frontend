/**
 * VÉRIFICATION DES ACCÈS — modules / rôles / abonnements
 * =======================================================
 * Rejoue SIX scénarios (rôle × palier) contre le build local et relit, pour
 * chacun, la liste exacte des modules proposés dans le menu.
 *
 * Prérequis :
 *   1. npm run build
 *   2. npm run verif:acces   (lance le preview puis ce script)
 *
 * Variables d'environnement :
 *   VERIF_URL   URL de l'application (défaut : http://localhost:4173/quincaillerie-frontend/)
 *   VERIF_BASE  préfixe servi par le site publié (défaut : https://souley123.github.io)
 *
 * Le script injecte le bundle LOCAL dans la page du site publié : l'API
 * n'autorise que cette origine (CORS), et les appels sont interceptés — aucun
 * compte réel n'est créé, aucune donnée n'est modifiée.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RACINE, 'dist');
const BASE_PUBLIEE = process.env.VERIF_BASE || 'https://souley123.github.io';
const URL_LOCALE = process.env.VERIF_URL || 'http://localhost:4173/quincaillerie-frontend/';

/* Les six scénarios de référence. */
const PARCOURS = [
  { role: 'Administrateur', palier: 'Standard' },
  { role: 'Administrateur', palier: 'Pro' },
  { role: 'Administrateur', palier: 'Enterprise' },
  { role: 'Gestionnaire', palier: 'Pro' },
  { role: 'Caissier', palier: 'Standard' },
  { role: 'Livreur', palier: 'Enterprise' }
];

/** Modules attendus — miroir des tests de src/access/matrice.test.js. */
const ATTENDUS = {
  'Administrateur|Standard': ['dashboard', 'quincaillerie', 'transaction', 'gaz', 'recherche', 'clients', 'aide'],
  'Administrateur|Enterprise': ['dashboard', 'quincaillerie', 'multiDepots', 'transaction', 'gaz', 'recherche', 'mouvements', 'reappro', 'achats', 'depenses', 'devis', 'inventaire', 'transport', 'clients', 'credits', 'dossiers', 'paiements', 'abonnements', 'comptabilite', 'reports', 'securite', 'tresorerie', 'parametresGeneraux', 'notes', 'versions', 'aide'],
  'Gestionnaire|Pro': ['dashboard', 'quincaillerie', 'multiDepots', 'recherche', 'mouvements', 'reappro', 'achats', 'inventaire', 'transport', 'clients', 'credits', 'notes', 'aide'],
  'Caissier|Standard': ['dashboard', 'transaction', 'gaz', 'recherche', 'clients', 'aide'],
  'Livreur|Enterprise': ['dashboard', 'mouvements', 'transport', 'aide']
};

const bundle = () => {
  const dossier = path.join(DIST, 'assets');
  const fichier = readdirSync(dossier).find(f => /^index-.*\.js$/.test(f));
  if (!fichier) throw new Error('Build introuvable : lancez `npm run build` avant ce script.');
  return readFileSync(path.join(dossier, fichier), 'utf8');
};

export default async function run(page) {
  const journal = [];
  const corps = bundle();
  let profil = PARCOURS[0];

  /* 1. Bundle local servi à la place du bundle publié. */
  await page.route('**/assets/index-*.js', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: corps }));

  /* 2. API simulée : le rôle et le palier viennent du scénario. */
  await page.route(`${BASE_PUBLIEE}/api-relais/**`, async route => {
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
        utilisateur: {
          id: 'u1', nom: 'Test', email: 'test@example.com',
          role: profil.role, emailVerifie: true
        },
        entreprise: {
          companyId: 'TEST', slug: 'test', raisonSociale: 'Test',
          palier: profil.palier, abonnementActif: true,
          abonnementEcheance: new Date(Date.now() + 86400000).toISOString()
        }
      });
    }
    if (chemin === '/api/abonnements/actif') return repondre(200, { palier: profil.palier, actif: true });
    if (chemin.startsWith('/api/')) return repondre(200, []);
    return route.continue();
  });

  /* 3. Jeton de session posé avant le démarrage de l'application. */
  await page.addInitScript(() => localStorage.setItem('skys_erp_jeton', 'jeton-de-test'));

  /* 4. Chaque scénario recharge l'application et relit le menu. */
  for (const scenario of PARCOURS) {
    profil = scenario;
    await page.goto(URL_LOCALE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    const modules = await page.evaluate(() =>
      [...document.querySelectorAll('#categorie-principale option')]
        .map(o => o.value).filter(Boolean));

    const cle = `${scenario.role}|${scenario.palier}`;
    const attendu = ATTENDUS[cle];
    journal.push({
      ...scenario,
      modules,
      ...(attendu ? { conforme: attendu.every(m => modules.includes(m)) && modules.every(m => attendu.includes(m)) } : {})
    });
  }

  return journal;
}
