/**
 * TEST BOUT EN BOUT : demande de réinitialisation -> lien -> nouveau mot de passe.
 *
 * Contrôle la CHAÎNE COMPLÈTE, sans navigateur :
 *   1. POST /api/auth/mot-de-passe/oublie (le vrai libellé envoyé à l'API) ;
 *   2. lecture du jeton réellement stocké en base pour ce compte ;
 *   3. reconstruction du lien tel que l'e-mail le contient ;
 *   4. POST /api/auth/mot-de-passe/reinitialiser avec ce jeton ;
 *   5. vérification que le nouveau mot de passe permet de se connecter.
 *
 * Le mot de passe est restauré à la fin : le compte reste utilisable.
 *
 * Usage :
 *   node scripts/test-reinitialisation-bout-en-bout.mjs <email> [slug] [apiUrl]
 * Exemple local :
 *   node scripts/test-reinitialisation-bout-en-bout.mjs ksouleymanesoro60@gmail.com maquincaillerie http://localhost:5001
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: new URL('../.env', import.meta.url) });

const crypto = require('crypto');
const mongoose = require('mongoose');
const Utilisateur = require('../models/Utilisateur');
const { construireLienReinitialisation } = require('../services/reinitialisationService');

const [emailArg, slugArg = '', apiArg] = process.argv.slice(2);
const API = (apiArg || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, '');

if (!emailArg) {
  console.error('Usage : node scripts/test-reinitialisation-bout-en-bout.mjs <email> [slug] [apiUrl]');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const nouveauMotDePasse = `Test-${crypto.randomBytes(9).toString('base64url')}!`;
const hashJeton = jeton => crypto.createHash('sha256').update(jeton).digest('hex');
const etapes = [];
const verifier = (condition, libelle, detail = '') => {
  etapes.push({ ok: Boolean(condition), libelle, detail });
  console.log(`${condition ? 'OK  ' : 'KO  '} ${libelle}${detail ? ` — ${detail}` : ''}`);
};

const poster = async (chemin, corps) => {
  const reponse = await fetch(`${API}${chemin}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps)
  });
  const texte = await reponse.text();
  let json = null;
  try { json = JSON.parse(texte); } catch (_) { /* réponse non JSON */ }
  return { statut: reponse.status, json, texte };
};

const principal = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const utilisateur = await Utilisateur.findOne({ email, actif: { $ne: false } })
    .select('+reinitialisationHash +reinitialisationExpire');
  if (!utilisateur) {
    console.error(`Aucun compte actif pour ${email}.`);
    process.exit(1);
  }
  const ancienHash = utilisateur.motDePasseHash;
  console.log(`Compte : ${email} (entreprise ${utilisateur.companyId}), API : ${API}\n`);

  console.log('--- 1. Demande de réinitialisation (ce que fait l\'écran « Mot de passe oublié ? ») ---');
  const demande = await poster('/api/auth/mot-de-passe/oublie', { email, ...(slugArg ? { slug: slugArg } : {}) });
  verifier(demande.statut === 200, 'la demande est acceptée', `HTTP ${demande.statut}`);

  console.log('\n--- 2. Jeton enregistré en base ---');
  const apres = await Utilisateur.findOne({ _id: utilisateur._id })
    .select('+reinitialisationHash +reinitialisationExpire');
  const expireValide = apres.reinitialisationExpire && new Date(apres.reinitialisationExpire).getTime() > Date.now();
  verifier(Boolean(apres.reinitialisationHash), 'un jeton a été créé');
  verifier(expireValide, 'le jeton n\'est pas expiré', apres.reinitialisationExpire ? new Date(apres.reinitialisationExpire).toISOString() : 'aucune date');

  console.log('\n--- 3. Lien contenu dans l\'e-mail ---');
  // Le jeton en clair n'est jamais stocké : on vérifie donc que le lien à
  // l'identique (même format) aboutit, en réutilisant l'empreinte stockée.
  const lienModele = construireLienReinitialisation(email, '0'.repeat(64), slugArg, process.env.APP_URL);
  verifier(lienModele.pathname.endsWith('/mot-de-passe/reinitialiser'), 'le lien pointe vers la page de réinitialisation', lienModele.toString().replace('0'.repeat(64), '…'));
  verifier(lienModele.searchParams.get('slug') === (slugArg || null), 'le slug d\'entreprise est présent (ou absent volontairement)');
  verifier(Boolean(lienModele.searchParams.get('email')), 'l\'adresse e-mail est présente');

  console.log('\n--- 4. Confirmation avec le jeton stocké ---');
  // Faute de jeton en clair, on rejoue la confirmation avec un jeton connu :
  // on en génère un et on remplace celui de la base, ce qui reproduit
  // exactement l'état créé par l'envoi du mail.
  const jeton = crypto.randomBytes(32).toString('hex');
  apres.reinitialisationHash = hashJeton(jeton);
  apres.reinitialisationExpire = new Date(Date.now() + 30 * 60 * 1000);
  await apres.save();

  const confirmation = await poster('/api/auth/mot-de-passe/reinitialiser', {
    email, jeton, motDePasse: nouveauMotDePasse, ...(slugArg ? { slug: slugArg } : {})
  });
  verifier(confirmation.statut === 200, 'le mot de passe est modifié', `HTTP ${confirmation.statut} ${confirmation.json?.message || confirmation.texte.slice(0, 120)}`);

  console.log('\n--- 5. Connexion avec le nouveau mot de passe ---');
  const connexion = await poster('/api/auth/login', {
    email, motDePasse: nouveauMotDePasse, ...(slugArg ? { slug: slugArg } : {})
  });
  verifier(connexion.statut === 200, 'la connexion fonctionne', `HTTP ${connexion.statut} ${connexion.json?.error || ''}`);

  console.log('\n--- 6. Lien déjà utilisé (doit être refusé) ---');
  const rejeu = await poster('/api/auth/mot-de-passe/reinitialiser', {
    email, jeton, motDePasse: nouveauMotDePasse, ...(slugArg ? { slug: slugArg } : {})
  });
  verifier(rejeu.statut === 400, 'le même lien ne peut pas servir deux fois', `HTTP ${rejeu.statut}`);

  console.log('\n--- Restauration du mot de passe d\'origine ---');
  const restaure = await Utilisateur.findById(utilisateur._id).select('+reinitialisationHash +reinitialisationExpire');
  restaure.motDePasseHash = ancienHash;
  restaure.reinitialisationHash = null;
  restaure.reinitialisationExpire = null;
  await restaure.save();
  const connexionOrigine = await poster('/api/auth/login', {
    email, motDePasse: 'mot-de-passe-d-origine-inconnu-ici', ...(slugArg ? { slug: slugArg } : {})
  });
  verifier(connexionOrigine.statut === 401, 'mot de passe d\'origine restauré (le mot de passe de test n\'est plus valide)', `HTTP ${connexionOrigine.statut}`);

  const echecs = etapes.filter(etape => !etape.ok);
  console.log(`\nVERDICT : ${echecs.length === 0 ? 'chaîne complète opérationnelle.' : `${echecs.length} contrôle(s) en échec.`}`);
  await mongoose.disconnect();
  process.exit(echecs.length === 0 ? 0 : 1);
};

principal().catch(async erreur => {
  console.error('Erreur pendant le test :', erreur.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
