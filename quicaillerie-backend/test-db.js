const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error(' MONGODB_URI absent du fichier .env');
  process.exit(1);
}

console.log("Connexion à MongoDB Atlas en cours...");

mongoose.connect(uri)
  .then(async () => {
    console.log(" SUCCESS: Connecté à MongoDB Atlas avec succès !");
    console.log(` Base de donnees : ${mongoose.connection.name} | Host : ${mongoose.connection.host}`);
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error(" ERROR: Échec de connexion :", err.message);
    process.exit(1);
  });