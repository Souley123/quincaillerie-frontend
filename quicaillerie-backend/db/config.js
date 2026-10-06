const mongoose = require('mongoose');

/**
 * Connexion à MongoDB Atlas.
 * L'URI provient du fichier .env (MONGODB_URI).
 */
const connecterMongo = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI absent du fichier .env : copiez .env.example vers .env puis completez la valeur.'
    );
  }

  await mongoose.connect(uri);

  console.log('✅ Connecté à MongoDB Atlas pour SKYS ERP Solution !');
  return mongoose.connection;
};

const mongooseEstPret = () => mongoose.connection.readyState === 1;

module.exports = { connecterMongo, mongooseEstPret };