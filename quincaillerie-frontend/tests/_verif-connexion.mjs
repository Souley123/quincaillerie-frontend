import axios from 'axios';

const API = 'https://gestion-de-stocks-5lv3.onrender.com';
const MOT_DE_PASSE = process.argv[2];

const r = await axios({
  method: 'post',
  url: `${API}/api/auth/login`,
  data: { email: 'ksouleymanesoro60@gmail.com', motDePasse: MOT_DE_PASSE, slug: 'maquincaillerie' },
  headers: { Origin: 'https://souley123.github.io' },
  timeout: 60000,
  validateStatus: () => true
});

console.log('CONNEXION → HTTP', r.status);
if (r.status === 200) {
  console.log('  utilisateur :', r.data.utilisateur.nom, '|', r.data.utilisateur.role);
  console.log('  entreprise  :', r.data.entreprise.raisonSociale, '(' + r.data.entreprise.slug + ')');
  console.log('  jeton reçu  :', r.data.jeton ? 'oui' : 'non');

  const moi = await axios({
    method: 'get',
    url: `${API}/api/auth/moi`,
    headers: { Origin: 'https://souley123.github.io', Authorization: `Bearer ${r.data.jeton}` },
    timeout: 60000,
    validateStatus: () => true
  });
  console.log('  session /moi →', moi.status, '| emailVerifie =', moi.data?.utilisateur?.emailVerifie,
    '| abonnementActif =', moi.data?.entreprise?.abonnementActif);
} else {
  console.log('  réponse :', JSON.stringify(r.data));
}
