/**
 * QA : l'écran « essai expiré » ne doit JAMAIS bloquer un visiteur déconnecté.
 *
 * Cas réel signalé : un verrou local (reliquat d'un ancien 402) affichait
 * l'écran d'abonnement AVANT la connexion, sans aucun moyen d'en sortir
 * (l'utilisateur ne peut pas manipuler le stockage).
 *
 * Usage : node tests/_qa-verrou-deconnecte.mjs [urlFront]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ locale: 'fr-FR' });

await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

await page.goto(BASE, { waitUntil: 'networkidle' });

// On reproduit un verrou hérité, sous les DEUX formes (globale et isolée).
await page.evaluate(() => {
  const passe = String(Date.now() - 86400000);
  localStorage.setItem('skys_erp_trial_expire', passe);
  localStorage.setItem('skys_erp_abonnement_expire', 'true');
  localStorage.setItem('skys_erp_subscribed', 'false');
  localStorage.setItem('skys_erp_essai_consomme', 'true');
  const isole = 'skys__maquincaillerie__ksouleymanesoro60@gmail.com__';
  localStorage.setItem(`${isole}erp_trial_expire`, passe);
  localStorage.setItem(`${isole}erp_subscribed`, 'false');
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const texte = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const connexion = /Adresse Email ou Login/i.test(texte);
const abonnement = /période d.essai est expirée|abonnement a expiré/i.test(texte);

console.log('Écran de connexion affiché :', connexion);
console.log('Écran d\'abonnement affiché :', abonnement);
console.log('Champ mot de passe présent :', await page.locator('#login-password').count() > 0);

await page.screenshot({ path: 'tests/qa-mobile/verrou-deconnecte.png', fullPage: true });
console.log(`\nVERDICT ${connexion && !abonnement ? 'OK' : 'KO'} : un visiteur déconnecté doit voir la connexion, jamais un blocage d'abonnement.`);

await navigateur.close();
process.exit(connexion && !abonnement ? 0 : 1);
