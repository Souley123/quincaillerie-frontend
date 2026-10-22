/**
 * QA : le verrou « essai expiré » ne doit plus emprisonner l'utilisateur.
 *
 * Reproduit exactement le cas signalé :
 *   1. le navigateur garde `erp_trial_expire` dans le passé et
 *      `erp_abonnement_expire = true` (reliquat d'un ancien 402) ;
 *   2. l'utilisateur se connecte avec des identifiants valides ;
 *   3. il doit arriver DANS l'ERP, pas sur l'écran d'abonnement.
 *
 * L'API est simulée : login valide + abonnement actif côté serveur.
 *
 * Usage : node tests/_qa-verrou-abonnement.mjs [urlFront]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });

const abonnementValide = {
  entreprise: {
    companyId: 'MAQUINCAILLERIE', slug: 'maquincaillerie', raisonSociale: 'Ma Quincaillerie',
    devise: 'FCFA', tauxTva: 18, palier: 'Essai',
    abonnementActif: true,
    abonnementEcheance: new Date(Date.now() + 5 * 86400000).toISOString()
  },
  utilisateur: { id: 'u1', nom: 'Test', email: 'ksouleymanesoro60@gmail.com', role: 'Administrateur', emailVerifie: true }
};

await page.route('**/api/**', route => {
  const url = route.request().url();
  if (url.includes('/api/auth/login')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...abonnementValide, jeton: 'jeton-de-test' })
    });
  }
  if (url.includes('/api/auth/moi')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(abonnementValide) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

await page.goto(BASE, { waitUntil: 'networkidle' });

// 1. On pose le verrou exact laissé par un ancien 402.
// Les clés de l'application sont PRÉFIXÉES par le compte
// (« skys_<companyId>__<email>__<cle> ») : les écrire sans préfixe n'aurait
// aucun effet, et le test ne prouverait rien.
await page.evaluate(() => {
  const prefixe = 'skys__maquincaillerie__ksouleymanesoro60@gmail.com__';
  const ecrire = (cle, valeur) => localStorage.setItem(prefixe + cle, valeur);
  ecrire('erp_trial_expire', String(Date.now() - 86400000)); // échéance dépassée
  ecrire('erp_abonnement_expire', 'true');                    // 402 mémorisé
  ecrire('erp_essai_consomme', 'true');
  ecrire('erp_subscribed', 'false');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const texte = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const avant = await texte();
console.log('Avant connexion — écran de blocage affiché :', /période d.essai est expirée|abonnement a expiré/i.test(avant));

// 2. Connexion avec des identifiants valides.
await page.locator('#login-email').fill('ksouleymanesoro60@gmail.com');
await page.locator('#login-password').fill('MotDePasse123456!');
await page.locator('form.login-form button[type="submit"]').click();
await page.waitForTimeout(2500);

// 3. Résultat.
const apres = await texte();
const ecranAbonnement = /Votre période d.essai est expirée|Votre abonnement a expiré/i.test(apres);
const dansErp = /Tableau de bord|Bienvenue|Modules|Tableau/i.test(apres);
console.log('\nAprès connexion :');
console.log('  écran d\'abonnement :', ecranAbonnement);
console.log('  ERP affiché        :', dansErp);
console.log('  extrait            :', apres.slice(0, 120));

await page.screenshot({ path: 'tests/qa-mobile/verrou-abonnement.png', fullPage: true });
console.log(`\nVERDICT ${!ecranAbonnement ? 'OK' : 'KO'} : ${!ecranAbonnement ? 'la connexion réussie lève le verrou local.' : 'l’écran d’abonnement bloque encore.'}`);

await navigateur.close();
process.exit(!ecranAbonnement ? 0 : 1);
