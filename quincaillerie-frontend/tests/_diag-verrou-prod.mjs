import axios from 'axios';

const API = 'https://gestion-de-stocks-5lv3.onrender.com';

const essai = async (libelle, data) => {
  const r = await axios({
    method: 'post',
    url: `${API}/api/auth/login`,
    data,
    headers: { Origin: 'https://souley123.github.io' },
    timeout: 60000,
    validateStatus: () => true
  });
  console.log(`${libelle} → HTTP ${r.status} | ${JSON.stringify(r.data).slice(0, 200)}`);
  return r;
};

// 1. Verrou encore présent ?
await essai('sans slug (révèle un éventuel verrou)', {
  email: 'ksouleymanesoro60@gmail.com',
  motDePasse: 'MotDePasseTotalementFaux999!'
});

// 2. Compte de l'AUTRE entreprise.
await essai('slug maquincaillerie', {
  email: 'ksouleymanesoro60@gmail.com',
  motDePasse: 'MotDePasseTotalementFaux999!',
  slug: 'maquincaillerie'
});

await essai('slug maquincaillerie1', {
  email: 'ksouleymanesoro60@gmail.com',
  motDePasse: 'MotDePasseTotalementFaux999!',
  slug: 'maquincaillerie1'
});
