#!/usr/bin/env node
/**
 * Supprime tous les comptes non administrateurs, conserve les administrateurs
 * et invalide aussi leurs sessions pour les obliger à se reconnecter.
 * Exécution manuelle uniquement : MONGODB_URI et confirmation exacte requis.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const confirmation = process.argv[2];
if (confirmation !== 'SUPPRIMER-TOUS-SAUF-ADMIN') {
  console.error('Refusé. Confirmez explicitement avec : node scripts/revoquer-sessions.mjs SUPPRIMER-TOUS-SAUF-ADMIN');
  process.exit(2);
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI est absent. Aucune modification effectuée.');
  process.exit(2);
}

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const utilisateurs = mongoose.connection.collection('utilisateurs');
  const resultat = await utilisateurs.deleteMany({ role: { $ne: 'Administrateur' } });
  const sessions = await utilisateurs.updateMany(
    { role: 'Administrateur', actif: { $ne: false } },
    { $inc: { verrouillageVersion: 1 } }
  );
  console.log(`Comptes non administrateurs supprimés : ${resultat.deletedCount}. Sessions administrateur révoquées : ${sessions.modifiedCount}. Données métier conservées.`);
} catch (erreur) {
  console.error(`Échec de la révocation : ${erreur.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
