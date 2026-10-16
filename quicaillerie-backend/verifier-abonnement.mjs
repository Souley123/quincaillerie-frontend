/**
 * Vérifie l'état d'abonnement d'une entreprise dans MongoDB.
 * Usage : node verifier-abonnement.mjs [companyId]
 */
import mongoose from 'mongoose';
import 'dotenv/config';

const companyId = (process.argv[2] || 'MAQUINCAILLERIE').toUpperCase();

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const entreprise = await db.collection('entreprises').findOne({ companyId });
if (!entreprise) {
  console.log(`Aucune entreprise trouvee pour companyId=${companyId}`);
} else {
  const echeance = entreprise.abonnementEcheance ? new Date(entreprise.abonnementEcheance) : null;
  const maintenant = new Date();
  console.log('=== ETAT ENTREPRISE ===');
  console.log('companyId          :', entreprise.companyId);
  console.log('raisonSociale      :', entreprise.raisonSociale);
  console.log('palier             :', entreprise.palier);
  console.log('abonnementActif    :', entreprise.abonnementActif);
  console.log('abonnementEcheance :', echeance ? echeance.toISOString() : '(aucune)');
  console.log('maintenant         :', maintenant.toISOString());
  if (echeance) {
    const jours = Math.ceil((echeance.getTime() - maintenant.getTime()) / 86400000);
    console.log('=> Jours restants  :', jours, jours < 0 ? '(EXPIRE)' : '');
  }
}

await mongoose.disconnect();