const Abonnement = require('../models/Abonnement');
const Entreprise = require('../models/Entreprise');
const { CompanyId } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : ABONNEMENTS
 * Palier souscrit par l'entreprise et historique des souscriptions.
 * Une souscription active le palier côté Entreprise (abonnementActif).
 */

const PALIERS_VALIDES = ['Essai', 'Standard', 'Pro', 'Enterprise', 'Transport'];

// GET /api/abonnements → historique de l'entreprise
const lister = async (req, res) => {
  try {
    const abonnements = await Abonnement.find({ companyId: CompanyId(req) }).sort({ createdAt: -1 });
    res.json(abonnements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/abonnements/actif → abonnement courant
const actif = async (req, res) => {
  try {
    const abonnement = await Abonnement.findOne({ companyId: CompanyId(req), actif: true }).sort({ createdAt: -1 });
    res.json(abonnement || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/abonnements → souscription / renouvellement
const souscrire = async (req, res) => {
  try {
    const { palier, prix, periode, moyenPaiement, referenceTransaction } = req.body || {};

    if (!PALIERS_VALIDES.includes(palier)) {
      return res.status(400).json({ error: 'Palier d\'abonnement inconnu.' });
    }

    const companyId = CompanyId(req);

    // Un seul abonnement actif à la fois : l'ancien est clôturé.
    await Abonnement.updateMany({ companyId, actif: true }, { $set: { actif: false } });

    const abonnement = await Abonnement.create({
      companyId,
      utilisateur: req.utilisateur?.nom || req.utilisateur?.email || 'Administrateur',
      email: req.utilisateur?.email || '',
      palier,
      prix: Number(prix) || 0,
      periode: periode === 'annuel' ? 'annuel' : 'mensuel',
      moyenPaiement: moyenPaiement || 'Mobile Money',
      referenceTransaction: referenceTransaction || '',
      actif: true
    });

    // L'abonnement de l'entreprise devient actif jusqu'à l'échéance.
    await Entreprise.updateOne(
      { companyId },
      { $set: { abonnementActif: true, palier, abonnementEcheance: abonnement.echeance } }
    );

    res.status(201).json(abonnement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { lister, actif, souscrire };
