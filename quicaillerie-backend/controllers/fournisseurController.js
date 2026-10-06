const Fournisseur = require('../models/Fournisseur');
const { listerAlertesStock } = require('../services/stockService');
const Commande = require('../models/Commande');
const Product = require('../models/Product');
const { CompanyId } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : FOURNISSEURS
 * Référentiel fournisseurs + génération automatique des bons de commande.
 */

// GET /api/fournisseurs
const lister = async (req, res) => {
  try {
    const fournisseurs = await Fournisseur.find({ companyId: CompanyId(req), actif: true }).sort({ nom: 1 });
    res.json(fournisseurs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/fournisseurs/:id
const afficher = async (req, res) => {
  try {
    const fournisseur = await Fournisseur.findOne({ _id: req.params.id, companyId: CompanyId(req) });
    if (!fournisseur) return res.status(404).json({ error: 'Fournisseur non trouvé.' });
    res.json(fournisseur);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/fournisseurs
const creer = async (req, res) => {
  try {
    const { nom } = req.body || {};

    if (!nom || !String(nom).trim()) {
      return res.status(400).json({ error: 'Le nom du fournisseur est obligatoire.' });
    }

    const fournisseur = await Fournisseur.create({ ...req.body, companyId: CompanyId(req) });
    res.status(201).json(fournisseur);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Ce fournisseur existe déjà.' });
    }
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/fournisseurs/:id
const modifier = async (req, res) => {
  try {
    const { companyId: _ignore, ...champs } = req.body || {};

    const fournisseur = await Fournisseur.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: champs },
      { new: true, runValidators: true }
    );

    if (!fournisseur) return res.status(404).json({ error: 'Fournisseur non trouvé.' });
    res.json(fournisseur);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/fournisseurs/:id
const supprimer = async (req, res) => {
  try {
    const fournisseur = await Fournisseur.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: { actif: false } },
      { new: true }
    );

    if (!fournisseur) return res.status(404).json({ error: 'Fournisseur non trouvé.' });
    res.json({ message: `Fournisseur « ${fournisseur.nom} » désactivé.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/fournisseurs/alertes/reappro → articles sous le seuil
const alertesReappro = async (req, res) => {
  try {
    const alertes = await listerAlertesStock(CompanyId(req));
    res.json(alertes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/fournisseurs/:id/commander → crée un bon de commande
const creerCommande = async (req, res) => {
  try {
    const fournisseur = await Fournisseur.findOne({ _id: req.params.id, companyId: CompanyId(req) });
    if (!fournisseur) return res.status(404).json({ error: 'Fournisseur non trouvé.' });

    const produits = Array.isArray(req.body?.produits) ? req.body.produits : [];

    if (produits.length === 0) {
      return res.status(400).json({ error: 'La commande doit contenir au moins un produit.' });
    }

    const lignes = [];
    let montantTotal = 0;

    for (const item of produits) {
      const produit = await Product.findOne({ _id: item.produitId || item._id, companyId: CompanyId(req) });
      if (!produit) continue;

      const quantite = Number(item.quantite) || 0;
      if (quantite <= 0) continue;

      const prixAchat = Number(item.prixAchat) || produit.prixAchat || 0;
      montantTotal += prixAchat * quantite;

      lignes.push({
        produitId: produit._id,
        ref: produit.ref,
        nom: produit.nom,
        quantite,
        prixAchat
      });
    }

    if (lignes.length === 0) {
      return res.status(400).json({ error: 'Aucune ligne valide dans la commande.' });
    }

    const commande = await Commande.create({
      companyId: CompanyId(req),
      reference: 'CMD-' + Date.now().toString(36).toUpperCase(),
      fournisseur: fournisseur.nom,
      fournisseurId: fournisseur._id,
      produits: lignes,
      montantTotal,
      mode: req.body?.mode || 'Manuelle',
      depot: req.body?.depot || 'Dépôt Principal',
      commentaire: req.body?.commentaire || ''
    });

    res.status(201).json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { lister, afficher, creer, modifier, supprimer, alertesReappro, creerCommande };