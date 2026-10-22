/**
 * TEST du parcours « mot de passe oublié » du PORTAIL CLIENT.
 *
 * Reproduit l'erreur 500 qui touchait TOUTES les réinitialisations client :
 * `motDePassePortailHash` a « select: false », il n'était pas demandé lors du
 * chargement du client, et l'affectation levait une erreur Mongoose
 * (« Chemins introuvables ») avant l'enregistrement.
 *
 * Le script crée un client de test, joue la demande + la confirmation, puis
 * SUPPRIME tout ce qu'il a créé. Rien ne reste en base.
 *
 * Usage : node scripts/test-portail-client.mjs [apiUrl]
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: new URL('../.env', import.meta.url) });

const crypto = require('crypto');
const mongoose = require('mongoose');
const Client = require('../models/Client');
const Entreprise = require('../models/Entreprise');
const { hacherMotDePasse } = require('../services/authService');

const API = (process.argv[2] || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, '');
const hashJeton = jeton => crypto.createHash('sha256').update(jeton).digest('hex');
const marque = Date.now().toString(36);
const emailTest = `test-portail-${marque}@exemple.ci`;

const etapes = [];
const verifier = (condition, libelle, detail = '') => {
  etapes.push(Boolean(condition));
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
  return { statut: reponse.status, json };
};

const principal = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const entreprise = await Entreprise.findOne({ actif: true }).select('companyId slug').lean();
  if (!entreprise) throw new Error('Aucune entreprise active : impossible de créer un client de test.');

  const client = await Client.create({
    companyId: entreprise.companyId,
    nom: `Client de test ${marque}`,
    email: emailTest,
    telephone: `07${marque.slice(-8)}`,
    motDePassePortailHash: hacherMotDePasse(crypto.randomBytes(16).toString('hex')),
    comptePortailActif: true,
    actif: true
  });

  try {
    console.log(`Entreprise : ${entreprise.slug} — client de test : ${emailTest}\n`);

    console.log('--- 1. Demande de réinitialisation côté client ---');
    const jeton = crypto.randomBytes(32).toString('hex');
    // On pose directement le jeton que la demande aurait créé : cela évite
    // d'envoyer un vrai e-mail pendant le test.
    await Client.updateOne({ _id: client._id }, {
      reinitialisationPortailHash: hashJeton(jeton),
      reinitialisationPortailExpire: new Date(Date.now() + 30 * 60 * 1000)
    });

    console.log('--- 2. Confirmation avec le nouveau mot de passe ---');
    const nouveauMotDePasse = `Cli-${crypto.randomBytes(8).toString('base64url')}!`;
    const confirmation = await poster('/api/client-portal/mot-de-passe/reinitialiser', {
      slug: entreprise.slug, email: emailTest, jeton, motDePasse: nouveauMotDePasse
    });
    verifier(confirmation.statut === 200,
      'le mot de passe client est modifié',
      `HTTP ${confirmation.statut} ${confirmation.json?.message || confirmation.json?.error || ''}`);

    console.log('\n--- 3. Connexion client avec le nouveau mot de passe ---');
    const connexion = await poster('/api/client-portal/connexion', {
      slug: entreprise.slug, identifiant: emailTest, motDePasse: nouveauMotDePasse
    });
    verifier(connexion.statut === 200,
      'le client peut se connecter',
      `HTTP ${connexion.statut} ${connexion.json?.error || ''}`);

    console.log('\n--- 4. Rejeu du même lien ---');
    const rejeu = await poster('/api/client-portal/mot-de-passe/reinitialiser', {
      slug: entreprise.slug, email: emailTest, jeton, motDePasse: nouveauMotDePasse
    });
    verifier(rejeu.statut === 400, 'le lien ne peut pas resservir', `HTTP ${rejeu.statut}`);
  } finally {
    await Client.deleteOne({ _id: client._id });
    console.log('\nClient de test supprimé.');
  }

  const echecs = etapes.filter(etape => !etape).length;
  console.log(`\nVERDICT : ${echecs === 0 ? 'réinitialisation client opérationnelle.' : `${echecs} contrôle(s) en échec.`}`);
  await mongoose.disconnect();
  process.exit(echecs === 0 ? 0 : 1);
};

principal().catch(async erreur => {
  console.error('Erreur pendant le test :', erreur.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
