require('dotenv').config();
const mongoose = require('mongoose');

/* Vide les données métier d'un tenant (garde le compte et l'entreprise). */
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  for (const nom of [
    'products', 'clients', 'ventes', 'mouvements',
    'fournisseurs', 'commandes', 'abonnements'
  ]) {
    const r = await db.collection(nom).deleteMany({ companyId: 'QUINCAILLERIE_TEST' });
    if (r.deletedCount) console.log(`  ${nom.padEnd(14)} ${r.deletedCount}`);
  }

  for (const nom of ['products', 'clients', 'ventes']) {
    console.log(`${nom.padEnd(13)} ${await db.collection(nom).countDocuments()}`);
  }

  await mongoose.disconnect();
})();