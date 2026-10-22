import axios from 'axios';

const API = 'https://gestion-de-stocks-5lv3.onrender.com';

// Un e-mail INCONNU n'essaie jamais d'envoyer : le serveur répond 200 dans
// TOUS les cas (anti-énumération). Un 503 sur ce cas ne peut donc PAS venir
// de Brevo : il vient de la construction du lien (APP_URL) ou d'une panne.
const r = await axios({
  method: 'post',
  url: `${API}/api/auth/mot-de-passe/oublie`,
  data: { email: 'inexistant-verification@exemple.com' },
  headers: { Origin: 'https://souley123.github.io' },
  timeout: 60000,
  validateStatus: () => true
});

console.log('Adresse INCONNUE →', r.status, '|', JSON.stringify(r.data));
console.log(r.status === 200
  ? 'Le service répond normalement : APP_URL et la configuration générale sont acceptées.'
  : 'Le service échoue AVANT tout envoi : configuration serveur en cause (APP_URL, e-mail), pas Brevo.');
