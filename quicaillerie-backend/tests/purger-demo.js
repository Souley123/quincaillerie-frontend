require('dotenv').config();
const mongoose = require('mongoose');

/* Purge les documents orphelins : ceux dont l'entreprise n'existe plus. */
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const entreprises = await db.collection('entreprises')
    .find({}, { projection: { companyId: 1 } }).toArray();
  const idsConnus = entreprises.map(e => e.companyId);

  for (const nom of ['utilisateurs', 'products', 'clients', 'ventes', 'mouvements',
    'fournisseurs', 'commandes', 'abonnements']) {
    const filtre = idsConnus.length ? { companyId: { $nin: idsConnus } } : {};
    const r = await db.collection(nom).deleteMany(filtre);
    if (r.deletedCount) console.log(`  ${nom.padEnd(14)} ${r.deletedCount} orphelin(s) supprimé(s)`);
  }

  console.log('');
  for (const nom of ['entreprises', 'utilisateurs', 'products', 'clients', 'ventes']) {
    console.log(`${nom.padEnd(13)} ${await db.collection(nom).countDocuments()}`);
  }

  await mongoose.disconnect();
})();