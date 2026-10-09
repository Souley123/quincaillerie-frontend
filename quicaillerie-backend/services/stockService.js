const mongoose = require('mongoose');
const Product = require('../models/Product');
const Mouvement = require('../models/Mouvement');

const avecTransaction = async operation => {
  const session = await mongoose.startSession();
  try {
    let resultat;
    await session.withTransaction(async () => {
      resultat = await operation(session);
    });
    return resultat;
  } finally {
    await session.endSession();
  }
};

/**
 * SERVICE STOCK
 * Centralise toutes les entrées / sorties de stock.
 * Utilise une mise à jour ATOMIQUE ($inc avec filtre conditionnel) afin
 * d'éviter les écritures concurrentes perdues (deux caisses en même temps).
 */

/**
 * Décrémente le stock d'un produit et journalise le mouvement.
 * @returns {Promise<Object|null>} le produit mis à jour, ou null si stock insuffisant
 */
const sortirStock = async ({ companyId, produitId, quantite, motif = 'Sortie', operateur = '', venteReference = '', depot = 'Dépôt Principal' }) => {
  const qte = Number(quantite);

  if (!companyId) {
    throw new Error('companyId manquant : opération multi-tenant refusée.');
  }

  if (!Number.isFinite(qte) || qte <= 0) {
    throw new Error('La quantité à sortir doit être un nombre strictement positif.');
  }

  return avecTransaction(async session => {
    // Lecture et écriture dans la même transaction que le mouvement.
    const avant = await Product.findOne({ _id: produitId, companyId })
      .select('quantiteStock ref nom').session(session).lean();
    if (!avant) throw new Error('Produit introuvable.');

    // Mise à jour atomique : n'applique que si le stock est suffisant.
    const produit = await Product.findOneAndUpdate(
      { _id: produitId, companyId, quantiteStock: { $gte: qte } },
      { $inc: { quantiteStock: -qte } },
      { new: true, session }
    );

    if (!produit) {
      const erreur = new Error(
        `Stock insuffisant pour « ${avant.nom} » : ${avant.quantiteStock} disponible(s), ${qte} demandé(s).`
      );
      erreur.code = 'STOCK_INSUFFISANT';
      erreur.disponible = avant.quantiteStock;
      throw erreur;
    }

    await Mouvement.create([{
      companyId,
      type: 'SORTIE',
      produitId: produit._id,
      ref: produit.ref,
      nom: produit.nom,
      quantite: qte,
      stockAvant: avant.quantiteStock,
      stockApres: produit.quantiteStock,
      motif,
      depot,
      operateur,
      venteReference
    }], { session });

    return produit;
  });
};

/**
 * Incrémente le stock d'un produit et journalise le mouvement.
 */
const entrerStock = async ({ companyId, produitId, quantite, type = 'ENTREE', motif = 'Entrée de stock', operateur = '', depot = 'Dépôt Principal' }) => {
  const qte = Number(quantite);

  if (!companyId) {
    throw new Error('companyId manquant : opération multi-tenant refusée.');
  }

  if (!Number.isFinite(qte) || qte <= 0) {
    throw new Error('La quantité à entrer doit être un nombre strictement positif.');
  }

  return avecTransaction(async session => {
    const avant = await Product.findOne({ _id: produitId, companyId })
      .select('quantiteStock ref nom').session(session).lean();
    if (!avant) throw new Error('Produit introuvable.');

    const produit = await Product.findOneAndUpdate(
      { _id: produitId, companyId },
      { $inc: { quantiteStock: qte } },
      { new: true, session }
    );
    if (!produit) throw new Error('Produit introuvable.');

    await Mouvement.create([{
      companyId,
      type,
      produitId: produit._id,
      ref: produit.ref,
      nom: produit.nom,
      quantite: qte,
      stockAvant: avant.quantiteStock,
      stockApres: produit.quantiteStock,
      motif,
      depot,
      operateur
    }], { session });

    return produit;
  });
};

/**
 * Remplace le stock par une valeur constatée (inventaire physique)
 * et journalise l'écart.
 */
const ajusterStock = async ({ companyId, produitId, stockPhysique, motif = 'Inventaire physique', operateur = '' }) => {
  const stock = Number(stockPhysique);

  if (!companyId) {
    throw new Error('companyId manquant : opération multi-tenant refusée.');
  }

  if (!Number.isFinite(stock) || stock < 0) {
    throw new Error('Le stock physique doit être un nombre positif ou nul.');
  }

  return avecTransaction(async session => {
    const avant = await Product.findOne({ _id: produitId, companyId })
      .select('quantiteStock ref nom').session(session).lean();
    if (!avant) throw new Error('Produit introuvable.');

    const produit = await Product.findOneAndUpdate(
      { _id: produitId, companyId },
      { $set: { quantiteStock: stock } },
      { new: true, session }
    );
    if (!produit) throw new Error('Produit introuvable.');

    const ecart = stock - avant.quantiteStock;

    await Mouvement.create([{
      companyId,
      type: 'INVENTAIRE',
      produitId: produit._id,
      ref: produit.ref,
      nom: produit.nom,
      quantite: Math.abs(ecart),
      stockAvant: avant.quantiteStock,
      stockApres: stock,
      motif: `${motif} — écart ${ecart > 0 ? '+' : ''}${ecart}`,
      operateur
    }], { session });

    return { produit, ecart };
  });
};

/**
 * Liste les articles sous le seuil d'alerte (réapprovisionnement).
 * Le companyId est obligatoire : les alertes d'un tenant ne doivent
 * jamais apparaître chez un autre.
 */
const listerAlertesStock = async companyId => {
  if (!companyId) {
    throw new Error('companyId manquant : lecture multi-tenant refusée.');
  }

  return Product.find({
    companyId,
    actif: true,
    $expr: { $lte: ['$quantiteStock', '$minStock'] }
  })
    .select('ref nom quantiteStock minStock maxStock prixAchat fournisseur')
    .sort({ quantiteStock: 1 })
    .lean();
};

module.exports = { sortirStock, entrerStock, ajusterStock, listerAlertesStock };