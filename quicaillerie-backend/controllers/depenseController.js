const Depense = require('../models/Depense');
const { CompanyId } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : DÉPENSES & CHARGES
 * Enregistrement des charges fixes et variables de l'entreprise.
 */

// GET /api/depenses
const lister = async (req, res) => {
  try {
    const depenses = await Depense.find({ companyId: CompanyId(req), actif: true }).sort({ date: -1 });
    res.json(depenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/depenses/:id
const afficher = async (req, res) => {
  try {
    const depense = await Depense.findOne({ _id: req.params.id, companyId: CompanyId(req) });
    if (!depense) return res.status(404).json({ error: 'Dépense non trouvée.' });
    res.json(depense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/depenses
const creer = async (req, res) => {
  try {
    const { libelle, montant } = req.body || {};

    if (!libelle || !String(libelle).trim()) {
      return res.status(400).json({ error: 'Le libellé de la dépense est obligatoire.' });
    }
    if (montant === undefined || montant === null || Number(montant) < 0) {
      return res.status(400).json({ error: 'Un montant valide est obligatoire.' });
    }

    const depense = await Depense.create({
      ...req.body,
      companyId: CompanyId(req),
      montant: Number(montant)
    });

    res.status(201).json(depense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/depenses/:id
const modifier = async (req, res) => {
  try {
    const { companyId: _ignore, ...champs } = req.body || {};
    if (champs.montant !== undefined) champs.montant = Number(champs.montant);

    const depense = await Depense.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: champs },
      { new: true, runValidators: true }
    );

    if (!depense) return res.status(404).json({ error: 'Dépense non trouvée.' });
    res.json(depense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/depenses/:id
const supprimer = async (req, res) => {
  try {
    const depense = await Depense.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: { actif: false } },
      { new: true }
    );

    if (!depense) return res.status(404).json({ error: 'Dépense non trouvée.' });
    res.json({ message: 'Dépense supprimée.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { lister, afficher, creer, modifier, supprimer };
