const Product = require('../models/Product');
const { sortirStock } = require('../services/stockService');
const { CompanyId } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : PRODUITS (catalogue)
 * Afficher le catalogue, ajouter un outil, mettre à jour le stock.
 */

// GET /api/products        → catalogue complet (filtres : famille, recherche)
const lister = async (req, res) => {
  try {
    const { famille, recherche, limite } = req.query;
    const filtre = { companyId: CompanyId(req), actif: true };

    if (famille) filtre.famille = famille;
    if (recherche) {
      const motif = new RegExp(String(recherche).trim(), 'i');
      filtre.$or = [{ nom: motif }, { ref: motif }, { fournisseur: motif }, { codeBarre: motif }];
    }

    const produits = await Product.find(filtre)
      .sort({ nom: 1 })
      .limit(Math.min(Number(limite) || 500, 2000));

    res.json(produits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/products/:id
const afficher = async (req, res) => {
  try {
    const produit = await Product.findOne({ _id: req.params.id, companyId: CompanyId(req) });
    if (!produit) return res.status(404).json({ error: 'Produit non trouvé.' });
    res.json(produit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/products/code/:code   → recherche par code-barres ou référence (scanner)
const rechercherParCode = async (req, res) => {
  try {
    const normalise = valeur =>
      String(valeur || '').toLowerCase().replace(/[\s-_]/g, '');

    const cible = normalise(req.params.code);
    if (!cible) return res.status(400).json({ error: 'Code manquant.' });

    const produit = await Product.findOne({
      companyId: CompanyId(req),
      actif: true,
      $or: [
        { ref: normalise(req.params.code).toUpperCase() },
        { codeBarre: req.params.code },
        { ref: new RegExp('^' + cible, 'i') },
        { nom: new RegExp(cible, 'i') }
      ]
    });

    if (!produit) {
      return res.status(404).json({
        error: 'Code non reconnu. Ajoutez-le au catalogue ou saisissez la référence manuellement.',
        suggestion: 'Créez la fiche article dans le module Catalogue.'
      });
    }

    res.json(produit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/products       → ajouter un outil / article
const creer = async (req, res) => {
  try {
    const {
      ref, nom, codeBarre, famille, fournisseur,
      prixAchat, prix, quantiteStock, minStock, maxStock,
      depot, zone, classe
    } = req.body || {};

    const champsRequis = { ref, nom, famille };
    const manquant = Object.entries(champsRequis).find(([, valeur]) => !valeur);

    if (manquant) {
      return res.status(400).json({ error: `Le champ « ${manquant[0]} » est obligatoire.` });
    }

    if (prix === undefined || Number(prix) < 0) {
      return res.status(400).json({ error: 'Le prix de vente est obligatoire et doit être positif.' });
    }

    const doublon = await Product.findOne({ companyId: CompanyId(req), ref: String(ref).toUpperCase() });
    if (doublon) {
      return res.status(409).json({ error: `La référence ${String(ref).toUpperCase()} existe déjà.` });
    }

    const produit = await Product.create({
      companyId: CompanyId(req),
      ref, nom, codeBarre, famille, fournisseur,
      prixAchat: Number(prixAchat) || 0,
      prix: Number(prix),
      quantiteStock: Number(quantiteStock) || 0,
      minStock: Number(minStock) || 0,
      maxStock: Number(maxStock) || 0,
      depot, zone, classe
    });

    res.status(201).json(produit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/products/:id   → modifier un article
const modifier = async (req, res) => {
  try {
    const { quantiteStock, companyId: _ignore, ...autres } = req.body || {};

    // Le stock ne se modifie jamais directement : il passe par le service
    // pour rester journalisé dans les mouvements.
    const produit = await Product.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: autres },
      { new: true, runValidators: true }
    );

    if (!produit) return res.status(404).json({ error: 'Produit non trouvé.' });

    if (quantiteStock !== undefined && Number(quantiteStock) !== produit.quantiteStock) {
      await require('../services/stockService').entrerStock({
        companyId: CompanyId(req),
        produitId: produit._id,
        quantite: Math.abs(Number(quantiteStock) - produit.quantiteStock),
        motif: 'Correction manuelle du stock',
        type: Number(quantiteStock) > produit.quantiteStock ? 'ENTREE' : 'SORTIE'
      });
    }

    res.json(await Product.findOne({ _id: produit._id, companyId: CompanyId(req) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/products/:id → retirer un article (soft delete)
const supprimer = async (req, res) => {
  try {
    const produit = await Product.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: { actif: false } },
      { new: true }
    );

    if (!produit) return res.status(404).json({ error: 'Produit non trouvé.' });

    res.json({ message: `Article « ${produit.nom} » retiré du catalogue.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/products/:id/stock   → mouvement manuel (entrée / sortie)
const bougerLeStock = async (req, res) => {
  try {
    const { type = 'ENTREE', quantite, motif = '' } = req.body || {};

    if (!['ENTREE', 'SORTIE'].includes(type)) {
      return res.status(400).json({ error: 'Le type doit être ENTREE ou SORTIE.' });
    }

    const service = require('../services/stockService');
    const produit = type === 'SORTIE'
      ? await sortirStock({ companyId: CompanyId(req), produitId: req.params.id, quantite, motif: motif || 'Sortie manuelle' })
      : await service.entrerStock({ companyId: CompanyId(req), produitId: req.params.id, quantite, motif: motif || 'Entrée manuelle' });

    res.json(produit);
  } catch (err) {
    const code = err.code === 'STOCK_INSUFFISANT' ? 409 : 400;
    res.status(code).json({ error: err.message, disponible: err.disponible });
  }
};

module.exports = { lister, afficher, rechercherParCode, creer, modifier, supprimer, bougerLeStock };