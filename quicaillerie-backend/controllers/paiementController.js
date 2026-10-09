const Transaction = require('../models/Transaction');
const Vente = require('../models/Vente');
const Product = require('../models/Product');
const Mouvement = require('../models/Mouvement');
const { CompanyId } = require('../middleware/tenant');
const kkiapay = require('../services/kkiapayService');
const mongoose = require('mongoose');
const crypto = require('crypto');
const empreintePreuve = valeur => crypto.createHash('sha256').update(JSON.stringify(valeur)).digest('hex');

/**
 * CONTRÔLEUR : PAIEMENTS EN LIGNE (KKIAPAY)
 * ------------------------------------------------------------
 * Seul endroit où un paiement devient « payé ». Le frontend ne peut pas
 * déclencher cette validation : il doit fournir une référence de
 * transaction que le serveur va vérifier directement chez Kkiapay.
 *
 * Sécurité appliquée :
 *   - la référence est vérifiée chez le prestataire (jamais crue sur parole) ;
 *   - le montant encaissé est comparé au montant attendu (anti-falsification) ;
 *   - une référence ne peut servir qu'une seule fois (anti-rejeu) ;
 *   - le paiement d'abonnement ne peut viser que le compte de l'éditeur ;
 *   - tout écart est journalisé comme tentative de fraude.
 */

/* Montants de référence des abonnements (source de vérité serveur).
   Le frontend ne décide JAMAIS du prix : il ne fait que demander un palier. */
const PRIX_ABONNEMENTS = Object.freeze({
  Essai: 0,
  Standard: 10000,
  Pro: 25000,
  Enterprise: 45000,
  Transport: 5000
});

const deviseKkiapay = String(process.env.KKIAPAY_DEVISE || 'XOF').toUpperCase();
const transactionRequise = (transaction, attendu) => {
  const reference = String(transaction?.transactionId || transaction?.id || transaction?.reference || '');
  const montant = kkiapay.montantDe(transaction);
  const devise = String(transaction?.currency || transaction?.devise || deviseKkiapay).toUpperCase();
  const candidatAttendu = String(attendu).trim();
  return reference === candidatAttendu && Number.isFinite(montant) && montant > 0 && devise === deviseKkiapay;
};

/** Enregistre une tentative suspecte sans jamais lever d'exception. */
const journaliserFraude = async (companyId, detail) => {
  try {
    console.warn(`[PAIEMENT SUSPECT] ${companyId || 'inconnu'} : ${detail}`);
  } catch {
    /* La journalisation ne doit jamais casser la réponse. */
  }
};

/**
 * POST /api/paiements/verifier
 * Vérifie une transaction et, si tout est conforme, la marque payée.
 * Corps attendus :
 *   { transactionId, nature: 'vente'|'abonnement', montantAttendu?, palier? }
 */
const verifierPaiement = async (req, res) => {
  const companyId = CompanyId(req);
  const { transactionId, nature, palier } = req.body || {};
  let venteId = null;
  let montantReference = 0;
  let sessionVente = null;

  if (!transactionId || typeof transactionId !== 'string' || transactionId.length > 128) {
    return res.status(400).json({ error: 'Référence de transaction invalide.' });
  }

  if (!['vente', 'abonnement'].includes(nature)) {
    return res.status(400).json({ error: 'Nature de paiement invalide.' });
  }

  if (!kkiapay.estConfigure()) {
    return res.status(503).json({
      error: 'Vérification de paiement indisponible : les clés Kkiapay ne sont pas configurées sur le serveur.'
    });
  }

  try {
    // 1. Anti-rejeu : une référence déjà utilisée ne vaut rien.
    const deja = await Transaction.findOne({
      companyId,
      reference: transactionId
    });
    if (deja) {
      await journaliserFraude(companyId, `référence rejouée ${transactionId}`);
      return res.status(409).json({
        error: 'Cette transaction a déjà été utilisée. Un paiement ne peut servir qu\'une fois.'
      });
    }

    // 2. Vérification réelle chez le prestataire.
    const transaction = await kkiapay.verifierTransaction(transactionId);

    if (!transaction) {
      await Transaction.create({
        companyId,
        nature,
        reference: transactionId,
        montant: 0,
        beneficiaire: nature === 'abonnement' ? 'développeur' : 'commerçant',
        statut: 'echouee',
        alerteSecurite: 'Transaction introuvable chez le prestataire.'
      }).catch(() => {});
      return res.status(402).json({ error: 'Paiement introuvable ou non confirmé par le prestataire.' });
    }

    if (!kkiapay.estReussie(transaction)) {
      await Transaction.create({
        companyId,
        nature,
        reference: transactionId,
        montant: kkiapay.montantDe(transaction),
        beneficiaire: nature === 'abonnement' ? 'développeur' : 'commerçant',
        statut: 'echouee',
        preuveVerification: { empreinte: empreintePreuve(transaction) },
        alerteSecurite: 'Paiement non réussi chez le prestataire.'
      }).catch(() => {});
      return res.status(402).json({ error: 'Le paiement n\'a pas abouti.' });
    }

    // 3. Contrôle du montant (anti-falsification côté client).
    const montantReel = kkiapay.montantDe(transaction);

    if (!transactionRequise(transaction, transactionId)) {
      await journaliserFraude(companyId, 'Réponse prestataire incohérente (référence, montant ou devise).');
      return res.status(402).json({ error: 'Les détails du paiement ne correspondent pas à la transaction.' });
    }

    try {
      if (nature === 'abonnement') {
        montantReference = PRIX_ABONNEMENTS[palier] ?? 0;
      if (palier === 'Essai') return res.status(400).json({ error: 'Aucun paiement n’est requis pour le palier Essai.' });
      if (montantReference <= 0) {
        return res.status(400).json({ error: 'Palier payant invalide.' });
      }
      sessionVente = await mongoose.startSession();
    } else {
      venteId = String(req.body?.venteId || '');
      if (!mongoose.Types.ObjectId.isValid(venteId)) {
        return res.status(400).json({ error: 'La vente à régler est obligatoire.' });
      }
      sessionVente = await mongoose.startSession();
      const vente = await Vente.findOne({ _id: venteId, companyId }).session(sessionVente);
      if (!vente || vente.statut === 'Annulee') {
        return res.status(404).json({ error: 'Vente introuvable ou déjà annulée.' });
      }
      if (vente.moyenPaiement !== 'Kkiapay' || vente.statutPaiement === 'payee') {
        return res.status(409).json({ error: 'Cette vente ne peut pas être réglée en ligne ou est déjà payée.' });
      }
      montantReference = Number(vente.total);
    }

    if (montantReel < montantReference) {
      await Transaction.create({
        companyId,
        nature,
        reference: transactionId,
        montant: montantReel,
        beneficiaire: nature === 'abonnement' ? 'développeur' : 'commerçant',
        statut: 'falsifiee',
        preuveVerification: { empreinte: empreintePreuve(transaction) },
        alerteSecurite: `Montant insuffisant : ${montantReel} < ${montantReference}.`
      }).catch(() => {});
      await journaliserFraude(companyId, `montant falsifié ${montantReel} < ${montantReference}`);
      return res.status(400).json({ error: 'Le montant payé est inférieur au montant attendu.' });
    }

    // 4. Enregistrement idempotent (l'index unique protège les cas concurrents).
    const transactionDonnees = {
      companyId,
      nature,
      reference: transactionId,
      montant: montantReel,
      beneficiaire: nature === 'abonnement' ? 'développeur' : 'commerçant',
      statut: 'payee',
      venteId: nature === 'vente' ? venteId : null,
      palier: nature === 'abonnement' ? palier : '',
      preuveVerification: { empreinte: empreintePreuve(transaction) },
      verifieLe: new Date()
    };

    let enregistrement;
    try {
      await sessionVente.withTransaction(async () => {
        if (nature === 'vente') {
          const vente = await Vente.findOne({
            _id: venteId, companyId, statut: 'Enregistree', statutPaiement: 'en_attente'
          }).session(sessionVente);
          if (!vente) {
            const conflit = new Error('La vente a déjà été payée ou modifiée.');
            conflit.code = 'SALE_ALREADY_PAID';
            throw conflit;
          }

          for (const ligne of vente.lignes) {
            const produit = await Product.findOneAndUpdate(
              { _id: ligne.produitId, companyId, quantiteStock: { $gte: ligne.quantite } },
              { $inc: { quantiteStock: -ligne.quantite } },
              { new: true, session: sessionVente }
            );
            if (!produit) {
              const stockError = new Error(`Stock insuffisant pour « ${ligne.nom} » lors de la confirmation du paiement.`);
              stockError.code = 'STOCK_INSUFFISANT';
              throw stockError;
            }
            await Mouvement.create([{
              companyId,
              type: 'SORTIE',
              produitId: produit._id,
              ref: produit.ref,
              nom: produit.nom,
              quantite: ligne.quantite,
              stockAvant: produit.quantiteStock + ligne.quantite,
              stockApres: produit.quantiteStock,
              motif: `Vente Kkiapay ${vente.reference}`,
              depot: vente.depot,
              operateur: vente.operateur,
              venteReference: vente.reference
            }], { session: sessionVente });
          }

          vente.statutPaiement = 'payee';
          vente.transactionPaiement = transactionId;
          await vente.save({ session: sessionVente });
          transactionDonnees.venteId = venteId;
        }
        [enregistrement] = await Transaction.create([transactionDonnees], { session: sessionVente });
      });
    } catch (err) {
      if (err.code === 'SALE_ALREADY_PAID') return res.status(409).json({ error: err.message });
      if (err.code === 'STOCK_INSUFFISANT') return res.status(409).json({ error: err.message });
      throw err;
    }

    return res.json({
      message: 'Paiement vérifié et enregistré.',
      transaction: {
        reference: enregistrement.reference,
        nature: enregistrement.nature,
        montant: enregistrement.montant,
        beneficiaire: enregistrement.beneficiaire,
        statut: enregistrement.statut,
        verifieLe: enregistrement.verifieLe
      }
    });
    } finally {
      if (sessionVente) await sessionVente.endSession();
    }
  } catch (err) {
    // Violation d'unicité : deux requêtes simultanées avec la même référence.
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Cette transaction a déjà été utilisée.' });
    }
    return res.status(500).json({ error: 'Vérification du paiement impossible.' });
  }
};

/** GET /api/paiements → historique des paiements de l'entreprise. */
const listerPaiements = async (req, res) => {
  try {
    const paiements = await Transaction.find({ companyId: CompanyId(req) })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(paiements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/paiements/config → clés publiques utilisables côté client. */
const configPaiement = async (_req, res) => {
  res.json({
    abonnement: {
      beneficiaire: 'développeur',
      cleKkiapay: process.env.KKIAPAY_PUBLIC || ''
    },
    prestataireConfigure: kkiapay.estConfigure(),
    prixAbonnements: PRIX_ABONNEMENTS
  });
};

module.exports = { verifierPaiement, listerPaiements, configPaiement, PRIX_ABONNEMENTS };
