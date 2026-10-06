const Client = require('../models/Client');
const { CompanyId } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : CLIENTS
 * Inscrire un nouveau client ou retrouver ses coordonnées.
 */

// GET /api/clients
const lister = async (req, res) => {
  try {
    const { recherche } = req.query;
    const filtre = { companyId: CompanyId(req), actif: true };

    if (recherche) {
      const motif = new RegExp(String(recherche).trim(), 'i');
      filtre.$or = [{ nom: motif }, { email: motif }, { telephone: motif }, { ville: motif }];
    }

    const clients = await Client.find(filtre).sort({ nom: 1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/clients/:id
const afficher = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, companyId: CompanyId(req) });
    if (!client) return res.status(404).json({ error: 'Client non trouvé.' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/clients
const creer = async (req, res) => {
  try {
    const { nom, email, telephone, region, ville, district, soldeDu } = req.body || {};

    if (!nom || !String(nom).trim()) {
      return res.status(400).json({ error: 'Le nom du client est obligatoire.' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }

    const client = await Client.create({
      companyId: CompanyId(req),
      nom, email, telephone, region, ville, district,
      soldeDu: Number(soldeDu) || 0
    });

    res.status(201).json(client);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/clients/:id
const modifier = async (req, res) => {
  try {
    // companyId n'est jamais modifiable : il détermine le tenant.
    const { companyId: _ignore, ...champs } = req.body || {};

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: champs },
      { new: true, runValidators: true }
    );

    if (!client) return res.status(404).json({ error: 'Client non trouvé.' });
    res.json(client);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/clients/:id
const supprimer = async (req, res) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: { actif: false } },
      { new: true }
    );

    if (!client) return res.status(404).json({ error: 'Client non trouvé.' });
    res.json({ message: `Client « ${client.nom} » désactivé.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { lister, afficher, creer, modifier, supprimer };