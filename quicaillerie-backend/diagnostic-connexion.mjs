/**
 * Diagnostic de connexion — reproduit EXACTEMENT la requête du frontend.
 * Usage : node diagnostic-connexion.mjs <email> <motDePasse> [slug]
 */

const API = 'https://gestion-de-stocks-5lv3.onrender.com';
const ORIGINE = 'https://souley123.github.io';

const [email, motDePasse, slug = ''] = process.argv.slice(2);
if (!email || !motDePasse) {
  console.error('Usage : node diagnostic-connexion.mjs <email> <motDePasse> [slug]');
  process.exit(2);
}

const debut = Date.now();
try {
  const reponse = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGINE
    },
    body: JSON.stringify({ email, motDePasse, slug })
  });

  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  const texte = await reponse.text();

  console.log(`HTTP ${reponse.status} en ${duree}s`);
  console.log(`CORS Access-Control-Allow-Origin : ${reponse.headers.get('access-control-allow-origin') || '(absent)'}`);
  console.log('Corps :', texte.slice(0, 500));
} catch (erreur) {
  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  console.error(`ECHEC RESEAU en ${duree}s : ${erreur.name} — ${erreur.message}`);
  if (erreur.cause) console.error('Cause :', erreur.cause);
  process.exit(1);
}