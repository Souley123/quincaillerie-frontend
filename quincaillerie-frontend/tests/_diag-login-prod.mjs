import axios from 'axios';

const API = 'https://gestion-de-stocks-5lv3.onrender.com';

const interroger = async (libelle, config) => {
  try {
    const r = await axios({ ...config, timeout: 60000, validateStatus: () => true });
    console.log(`${libelle} → HTTP ${r.status} | ${JSON.stringify(r.data).slice(0, 220)}`);
  } catch (e) {
    console.log(`${libelle} → ÉCHEC ${e.message}`);
  }
};

await interroger('IMAGE (mdp faux)', {
  method: 'post', url: `${API}/api/auth/login`,
  data: { email: 'ksouleymanesoro60@gmail.com', motDePasse: 'MotDePasseTotalementFaux999!', slug: 'maquincaillerie' },
  headers: { Origin: 'https://souley123.github.io' }
});

await interroger('IMAGE (sans slug)', {
  method: 'post', url: `${API}/api/auth/login`,
  data: { email: 'ksouleymanesoro60@gmail.com', motDePasse: 'MotDePasseTotalementFaux999!' },
  headers: { Origin: 'https://souley123.github.io' }
});
