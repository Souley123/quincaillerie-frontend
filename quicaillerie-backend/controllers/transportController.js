const Transport = require('../models/Transport');
const { CompanyId } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : TRANSPORT & LOGISTIQUE
 * Planification des livraisons / expéditions.
 */

// GET /api/transports
const lister = async (req, res) => {
  try {
    const transports = await Transport.find({ companyId: CompanyId(req), actif: true }).sort({ date: -1 });
    res.json(transports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/transports/:id
const afficher = async (req, res) => {
  try {
    const transport = await Transport.findOne({ _id: req.params.id, companyId: CompanyId(req) });
    if (!transport) return res.status(404).json({ error: 'Expédition non trouvée.' });
    res.json(transport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/transports
const creer = async (req, res) => {
  try {
    const { nomResponsable } = req.body || {};

    if (!nomResponsable || !String(nomResponsable).trim()) {
      return res.status(400).json({ error: 'Le nom du responsable est obligatoire.' });
    }

    const transport = await Transport.create({
      ...req.body,
      companyId: CompanyId(req),
      nombreVoyage: Number(req.body?.nombreVoyage) || 1,
      frais: Number(req.body?.frais) || 0
    });

    res.status(201).json(transport);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/transports/:id
const modifier = async (req, res) => {
  try {
    const { companyId: _ignore, ...champs } = req.body || {};

    const transport = await Transport.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: champs },
      { new: true, runValidators: true }
    );

    if (!transport) return res.status(404).json({ error: 'Expédition non trouvée.' });
    res.json(transport);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/transports/:id
const supprimer = async (req, res) => {
  try {
    const transport = await Transport.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: { actif: false } },
      { new: true }
    );

    if (!transport) return res.status(404).json({ error: 'Expédition non trouvée.' });
    res.json({ message: 'Expédition supprimée.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { lister, afficher, creer, modifier, supprimer };
