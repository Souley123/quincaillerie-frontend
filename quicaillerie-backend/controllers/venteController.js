const mongoose = require('mongoose');
const Vente = require('../models/Vente');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Mouvement = require('../models/Mouvement');
const { CompanyId } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : VENTES
 * Enregistre chaque passage en caisse et décrémente
 * automatiquement le stock (collection products).
 */

const genererReference = () =>
  'VTE-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 90 + 10);

// GET /api/ventes
const lister = async (req, res) => {
  try {
    const { limite, clientId, depuis, jusqua } = req.query;
    const filtre = { companyId: CompanyId(req) };

    if (clientId) filtre.clientId = clientId;
    if (depuis || jusqua) {
      filtre.date = {};
      if (depuis) filtre.date.$gte = new Date(depuis);
      if (jusqua) filtre.date.$lte = new Date(jusqua);
    }

    const ventes = await Vente.find(filtre)
      .populate('clientId', 'nom telephone ville')
      .sort({ date: -1 })
      .limit(Math.min(Number(limite) || 100, 1000));

    res.json(ventes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/ventes/:id
const afficher = async (req, res) => {
  try {
    const vente = await Vente.findOne({ _id: req.params.id, companyId: CompanyId(req) })
      .populate('clientId', 'nom telephone ville');

    if (!vente) return res.status(404).json({ error: 'Vente non trouvée.' });
    res.json(vente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/ventes → encaisser une vente
const creer = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      clientId, clientNom,
      lignes: lignesRecues,
      remise = 0,
      tva = 0,
      moyenPaiement = 'Espèces',
      operateur = '',
      depot = 'Dépôt Principal'
    } = req.body || {};

    const companyId = CompanyId(req);

    if (!Array.isArray(lignesRecues) || lignesRecues.length === 0) {
      return res.status(400).json({ error: 'Le panier doit contenir au moins un article.' });
    }

    let vente;

    // Transaction : si une ligne échoue, rien n'est décrémenté.
    await session.withTransaction(async () => {
      const lignes = [];
      let sousTotal = 0;

      for (const ligne of lignesRecues) {
        const produitId = ligne.produitId || ligne._id;
        const quantite = Number(ligne.quantite);

        if (!produitId || !Number.isFinite(quantite) || quantite <= 0) {
          throw new Error('Chaque ligne doit indiquer un produit et une quantité valide.');
        }

        const produit = await Product.findOne({ _id: produitId, companyId }).session(session);
        if (!produit) throw new Error(`Produit introuvable : ${produitId}`);

        const prixUnitaire = Number.isFinite(Number(ligne.prixUnitaire))
          ? Number(ligne.prixUnitaire)
          : produit.prix;

        const total = prixUnitaire * quantite;
        sousTotal += total;

        // Décrément atomique du stock (collection products)
        const maj = await Product.findOneAndUpdate(
          { _id: produitId, companyId, quantiteStock: { $gte: quantite } },
          { $inc: { quantiteStock: -quantite } },
          { new: true, session }
        );

        if (!maj) {
          const erreur = new Error(
            `Stock insuffisant pour « ${produit.nom} » : ${produit.quantiteStock} disponible(s), ${quantite} demandé(s).`
          );
          erreur.code = 'STOCK_INSUFFISANT';
          throw erreur;
        }

        lignes.push({
          produitId: produit._id,
          ref: produit.ref,
          nom: produit.nom,
          quantite,
          prixUnitaire,
          total
        });

        await Mouvement.create([{
          companyId,
          type: 'SORTIE',
          produitId: produit._id,
          ref: produit.ref,
          nom: produit.nom,
          quantite,
          stockAvant: produit.quantiteStock,
          stockApres: maj.quantiteStock,
          motif: `Vente comptoir - ${clientNom || 'Client Comptoir'}`,
          depot,
          operateur
        }], { session });
      }

      const montantRemise = sousTotal * (Number(remise) / 100);
      const baseHT = sousTotal - montantRemise;
      const montantTVA = baseHT * (Number(tva) / 100);
      const total = baseHT + montantTVA;

      // Encours client si paiement différé / crédit
      const estCredit = ['Crédit', 'Paiement à 30 jours', 'Paiement échelonné / Crédit']
        .includes(moyenPaiement);

      if (clientId && estCredit) {
        await Client.findOneAndUpdate(
          { _id: clientId, companyId },
          { $inc: { soldeDu: total } },
          { session }
        );
      }

      const reference = genererReference();

      [vente] = await Vente.create([{
        companyId,
        reference,
        clientId: clientId || null,
        clientNom: clientNom || 'Client Comptoir',
        lignes,
        sousTotal,
        remise: Number(remise),
        tva: Number(tva),
        total,
        moyenPaiement,
        operateur,
        depot,
        statut: 'Enregistree'
      }], { session });

      vente.lignes.forEach(l => { l.venteReference = reference; });
      vente.mouvementsLiees = lignes.length;
    });

    res.status(201).json(vente);
  } catch (err) {
    const code = err.code === 'STOCK_INSUFFISANT' ? 409 : 400;
    res.status(code).json({ error: err.message });
  } finally {
    await session.endSession();
  }
};

// POST /api/ventes/:id/annuler → annuler une vente et restituer le stock
const annuler = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const vente = await Vente.findOne({ _id: req.params.id, companyId: CompanyId(req) }).session(session);
      if (!vente) throw new Error('Vente non trouvée.');
      if (vente.statut === 'Annulee') throw new Error('Cette vente est déjà annulée.');

      for (const ligne of vente.lignes) {
        const produit = await Product.findOneAndUpdate(
          { _id: ligne.produitId, companyId: CompanyId(req) },
          { $inc: { quantiteStock: ligne.quantite } },
          { new: true, session }
        );

        if (produit) {
          await Mouvement.create([{
            companyId: CompanyId(req),
            type: 'ANNULATION',
            produitId: produit._id,
            ref: produit.ref,
            nom: produit.nom,
            quantite: ligne.quantite,
            stockAvant: produit.quantiteStock - ligne.quantite,
            stockApres: produit.quantiteStock,
            motif: `Annulation vente ${vente.reference}`,
            venteReference: vente.reference
          }], { session });
        }
      }

      vente.statut = 'Annulee';
      await vente.save({ session });
    });

    res.json({ message: `Vente annulée, stock restitué.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  } finally {
    await session.endSession();
  }
};

// GET /api/ventes/stats/:periode → chiffre d'affaires
const statistiques = async (req, res) => {
  try {
    const periodes = { jour: 1, semaine: 7, mois: 30, annee: 365 };
    const jours = periodes[req.params.periode] || 30;
    const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);
    const companyId = CompanyId(req);

    const resultat = await Vente.aggregate([
      { $match: { companyId, statut: 'Enregistree', date: { $gte: depuis } } },
      {
        $group: {
          _id: '$moyenPaiement',
          nombre: { $sum: 1 },
          chiffreAffaires: { $sum: '$total' }
        }
      },
      { $sort: { chiffreAffaires: -1 } }
    ]);

    const total = await Vente.aggregate([
      { $match: { companyId, statut: 'Enregistree', date: { $gte: depuis } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
    ]);

    res.json({
      periode: req.params.periode || 'mois',
      depuis,
      total: total[0]?.total || 0,
      nombreVentes: total[0]?.count || 0,
      parMoyenPaiement: resultat
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { lister, afficher, creer, annuler, statistiques };