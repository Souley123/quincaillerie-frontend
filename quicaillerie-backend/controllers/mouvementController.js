const mongoose = require('mongoose');
const Mouvement = require('../models/Mouvement');
const { CompanyId, ObjectIdValide } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : MOUVEMENTS DE STOCK
 * Journal en lecture seule : les écritures passent par le service
 * stock (POST /api/products/:id/stock) ou par la caisse, afin que
 * chaque variation soit tracée.
 */

// GET /api/mouvements → journal filtré par entreprise
const lister = async (req, res) => {
  try {
    const { limite, type, produitId, depuis, jusqua } = req.query;
    const filtre = { companyId: CompanyId(req) };

    if (type) filtre.type = type;
    if (produitId) filtre.produitId = produitId;
    if (depuis || jusqua) {
      filtre.date = {};
      if (depuis) filtre.date.$gte = new Date(depuis);
      if (jusqua) filtre.date.$lte = new Date(jusqua);
    }

    const mouvements = await Mouvement.find(filtre)
      .sort({ date: -1 })
      .limit(Math.min(Number(limite) || 200, 1000));

    res.json(mouvements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/mouvements/:id → détail d'un mouvement
const afficher = async (req, res) => {
  try {
    if (!ObjectIdValide(req.params.id)) {
      return res.status(404).json({ error: 'Mouvement introuvable.' });
    }

    const mouvement = await Mouvement.findOne({
      _id: req.params.id,
      companyId: CompanyId(req)
    });

    if (!mouvement) return res.status(404).json({ error: 'Mouvement introuvable.' });
    res.json(mouvement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { lister, afficher };