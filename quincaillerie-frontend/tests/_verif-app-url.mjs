/**
 * VÉRIFIE APP_URL EN PRODUCTION
 *
 * Une demande de réinitialisation construit le lien avec APP_URL. Si la
 * variable n'est pas appliquée, le serveur répond 503 ou le lien pointe
 * vers une adresse morte. On contrôle donc :
 *   1. la demande est acceptée (APP_URL validée au démarrage) ;
 *   2. le lien construit ouvre une VRAIE page (testé au navigateur plus loin).
 *
 * Usage : node tests/_verif-app-url.mjs [email]
 */
import axios from 'axios';

const API = 'https://gestion-de-stocks-5lv3.onrender.com';
const EMAIL = process.argv[2] || 'ksouleymanesoro60@gmail.com';

const r = await axios({
  method: 'post',
  url: `${API}/api/auth/mot-de-passe/oublie`,
  data: { email: EMAIL, slug: 'maquincaillerie' },
  headers: { Origin: 'https://souley123.github.io' },
  timeout: 60000,
  validateStatus: () => true
});

console.log('DEMANDE DE RÉINITIALISATION →', r.status, '|', JSON.stringify(r.data));
console.log(r.status === 200
  ? 'APP_URL est acceptée par le serveur (une URL invalide provoquerait un 503 au démarrage ou à cet appel).'
  : 'La demande a échoué : APP_URL est probablement absente ou invalide.');
