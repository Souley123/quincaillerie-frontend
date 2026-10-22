/**
 * VÉRIFICATION DE LA CLÉ BREVO (sans envoyer d'e-mail)
 *
 * Contrôle d'abord la FORME de la clé, puis son AUTHENTICITÉ auprès de Brevo.
 * Cela évite de chercher un problème de code alors que la clé est refusée.
 *
 * Usage : node scripts/verifier-cle-brevo.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: new URL('../.env', import.meta.url) });

const cle = process.env.BREVO_API_KEY || '';

const masquer = valeur => `${valeur.slice(0, 10)}…${valeur.slice(-6)}`;
const analyserForme = () => {
  const problemes = [];
  if (!cle) problemes.push('Aucune clé : BREVO_API_KEY est vide dans .env.');
  if (cle !== cle.trim()) problemes.push('La clé commence ou finit par un espace.');
  if (/[\s"']/.test(cle)) problemes.push('La clé contient un espace ou un guillemet.');
  if (cle && !cle.startsWith('xkeysib-')) problemes.push('Une clé API Brevo v3 commence toujours par « xkeysib- ».');
  if (cle.length && cle.length < 60) problemes.push(`La clé semble tronquée (${cle.length} caractères).`);
  return problemes;
};

const interroger = async (chemin) => {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 15000);
  try {
    const reponse = await fetch(`https://api.brevo.com/v3/${chemin}`, {
      headers: { accept: 'application/json', 'api-key': cle },
      signal: controleur.signal
    });
    const texte = await reponse.text();
    return { statut: reponse.status, texte };
  } finally {
    clearTimeout(minuteur);
  }
};

const principal = async () => {
  console.log(`Clé : ${cle ? masquer(cle) : '(vide)'}  —  ${cle.length} caractères\n`);

  const problemes = analyserForme();
  if (problemes.length) {
    console.log('Problèmes de FORME :');
    problemes.forEach(probleme => console.log(`  ✗ ${probleme}`));
  } else {
    console.log('Forme de la clé : correcte (préfixe xkeysib-, pas d’espace).');
  }

  console.log('\nAuthentification auprès de Brevo…');
  const compte = await interroger('account');
  console.log(`  GET /v3/account → HTTP ${compte.statut}${compte.statut === 200 ? ' (clé VALIDE)' : ''}`);
  if (compte.statut !== 200) {
    const reponse = (() => { try { return JSON.parse(compte.texte); } catch { return {}; } })();
    // Le message Brevo termine l'adresse par un point (« 160.155.213.164. »).
    const ip = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(reponse.message || '')?.[1];

    /* CAS LE PLUS FRÉQUENT : la clé est bonne, mais l'IP du serveur ne l'est pas.
       Brevo répond 401 avec « unrecognised IP address », ce qui fait croire à
       tort que la clé est invalide. */
    if (/unrecognised IP|unauthori[sz]ed IP|authorised_ips/i.test(compte.texte)) {
      console.log(`\nVERDICT : la clé est VALIDE, mais Brevo refuse cette adresse IP${ip ? ` (${ip})` : ''}.`);
      console.log('Le compte Brevo n’accepte que des adresses IP déclarées (option « IP autorisées »).');
      console.log('Correction rapide :');
      console.log('  1. Ouvrez https://app.brevo.com/security/authorised_ips');
      console.log(`  2. Ajoutez l’IP affichée${ip ? ` (${ip})` : ''} — ou désactivez la restriction.`);
      console.log('  ⚠ Sur Render, l’IP change à chaque déploiement/redémarrage :');
      console.log('    l’option est donc inadaptée à cet hébergement. Désactivez-la, ou');
      console.log('    passez au SMTP (port 587) sur un hébergement qui l’autorise.');
      process.exit(1);
    }

    console.log(`  Réponse : ${String(reponse.message || compte.texte).slice(0, 200)}`);
    console.log('\nVERDICT : la clé est REFUSÉE par Brevo.');
    console.log('Elle a probablement été révoquée, régénérée, ou copiée partiellement.');
    console.log('Étapes : Brevo → menu utilisateur → « SMTP & API » → onglet « API Keys »');
    console.log('          → générer/copier la clé COMPLÈTE (elle n’est affichée qu’une fois).');
    process.exit(1);
  }

  const expediteurs = await interroger('senders');
  const liste = (() => { try { return JSON.parse(expediteurs.texte).senders || []; } catch { return []; } })();
  console.log(`  GET /v3/senders → ${liste.length} expéditeur(s) validé(s)`);
  liste.forEach(expediteur => console.log(`    • ${expediteur.email}${expediteur.active ? '' : ' (inactif)'}`));

  const voulu = (process.env.SMTP_FROM || '').match(/<([^>]+)>/)?.[1] || process.env.SMTP_FROM || '';
  const valide = liste.some(expediteur => expediteur.email && expediteur.email.toLowerCase() === voulu.toLowerCase());
  console.log(`\nExpéditeur configuré (SMTP_FROM) : ${voulu || '(vide)'}`);
  if (!voulu) {
    console.log('  ✗ Aucun expéditeur configuré : Brevo refusera l’envoi.');
    process.exit(1);
  }
  if (!valide) {
    console.log('  ✗ CETTE ADRESSE N’EST PAS VALIDÉE dans Brevo.');
    console.log('    Brevo répond alors 400 « sender not valid » et n’envoie RIEN.');
    console.log('    Étapes : Brevo → « Senders, Domains & IPs » → « Senders » → « Add a sender »,');
    console.log('    puis validez le code reçu dans la boîte, ou utilisez une adresse du domaine vérifié.');
    process.exit(1);
  }
  console.log('  ✓ adresse validée chez Brevo.');

  console.log('\nVERDICT : clé valide et expéditeur autorisé — l’envoi peut fonctionner.');
};

principal().catch(erreur => {
  console.error('Erreur inattendue :', erreur.message);
  process.exitCode = 1;
});
