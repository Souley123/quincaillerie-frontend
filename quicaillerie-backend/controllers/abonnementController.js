const Abonnement = require('../models/Abonnement');
const Entreprise = require('../models/Entreprise');
const { CompanyId } = require('../middleware/tenant');
const { PRIX_ABONNEMENTS } = require('./paiementController');
const mongoose = require('mongoose');

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
    const { palier, periode, referenceTransaction, moyenPaiement } = req.body || {};

    if (!PALIERS_VALIDES.includes(palier)) {
      return res.status(400).json({ error: 'Palier d\'abonnement inconnu.' });
    }

    const prixOfficiel = PRIX_ABONNEMENTS[palier];
    if (prixOfficiel === undefined || prixOfficiel <= 0 || typeof referenceTransaction !== 'string' || !referenceTransaction.trim()) {
      return res.status(402).json({ error: 'Un paiement vérifié est requis pour souscrire à ce palier.' });
    }

    /* Moyens acceptés : le prestataire (Kkiapay) encaisse par carte ET par
       Mobile Money (Wave, Orange, MTN, Moov). Refuser le Mobile Money ici
       bloquait la souscription pour la quasi-totalité des clients en
       Côte d'Ivoire, alors que le frontend ne propose que ces moyens. */
    const MOYENS_PAIEMENT_VALIDES = [
      'Carte bancaire', 'Kkiapay', 'Mobile Money',
      'Wave', 'Orange Money', 'MTN Mobile Money', 'Moov Money'
    ];
    if (moyenPaiement && !MOYENS_PAIEMENT_VALIDES.includes(moyenPaiement)) {
      return res.status(400).json({ error: 'Moyen de paiement non reconnu.' });
    }

    const companyId = CompanyId(req);
    const Transaction = require('../models/Transaction');
    const paiement = await Transaction.findOne({
      companyId,
      reference: referenceTransaction.trim(),
      nature: 'abonnement',
      statut: 'payee',
      montant: { $gte: prixOfficiel }
    });
    if (!paiement || paiement.venteId || paiement.palier !== palier) {
      return res.status(402).json({ error: 'Paiement introuvable ou insuffisant pour ce palier.' });
    }

    const session = await mongoose.startSession();
    let abonnement;
    try {
      await session.withTransaction(async () => {
        // Réserver le paiement une seule fois sous transaction Mongo.
        const reserve = await Transaction.updateOne(
          { _id: paiement._id, companyId, nature: 'abonnement', statut: 'payee' },
          { $set: { statut: 'abonnement_applique' } },
          { session }
        );
        if (reserve.modifiedCount !== 1) {
          const conflit = new Error('Ce paiement a déjà été consommé.');
          conflit.code = 'PAYMENT_ALREADY_USED';
          throw conflit;
        }

        await Abonnement.updateMany(
          { companyId, actif: true },
          { $set: { actif: false } },
          { session }
        );
        [abonnement] = await Abonnement.create([{
          companyId,
          utilisateur: req.utilisateur?.nom || req.utilisateur?.email || 'Administrateur',
          email: req.utilisateur?.email || '',
          palier,
          prix: prixOfficiel,
          periode: periode === 'annuel' ? 'annuel' : 'mensuel',
          moyenPaiement,
          referenceTransaction: referenceTransaction.trim(),
          actif: true
        }], { session });
        await Entreprise.updateOne(
          { companyId },
          { $set: { abonnementActif: true, palier, abonnementEcheance: abonnement.echeance } },
          { session }
        );
      });
      res.status(201).json(abonnement);
    } finally {
      await session.endSession();
    }
  } catch (err) {
    const status = err.code === 'PAYMENT_ALREADY_USED' ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
};

module.exports = { lister, actif, souscrire };
