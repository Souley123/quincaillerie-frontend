const Transaction = require('../models/Transaction');
const Entreprise = require('../models/Entreprise');
const { CompanyId } = require('../middleware/tenant');
const kkiapay = require('../services/kkiapayService');

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
const PRIX_ABONNEMENTS = {
  Essai: 0,
  Standard: 5000,
  Pro: 15000,
  Enterprise: 25000,
  Transport: 5000
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
  const { transactionId, nature, montantAttendu, palier } = req.body || {};

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
        preuveVerification: transaction,
        alerteSecurite: 'Paiement non réussi chez le prestataire.'
      }).catch(() => {});
      return res.status(402).json({ error: 'Le paiement n\'a pas abouti.' });
    }

    // 3. Contrôle du montant (anti-falsification côté client).
    const montantReel = kkiapay.montantDe(transaction);
    let montantReference = Number(montantAttendu) || 0;

    if (nature === 'abonnement') {
      // Le prix est imposé par le serveur, jamais par le client.
      montantReference = PRIX_ABONNEMENTS[palier] ?? 0;
    }

    if (montantReference > 0 && montantReel < montantReference) {
      await Transaction.create({
        companyId,
        nature,
        reference: transactionId,
        montant: montantReel,
        beneficiaire: nature === 'abonnement' ? 'développeur' : 'commerçant',
        statut: 'falsifiee',
        preuveVerification: transaction,
        alerteSecurite: `Montant insuffisant : ${montantReel} < ${montantReference}.`
      }).catch(() => {});
      await journaliserFraude(companyId, `montant falsifié ${montantReel} < ${montantReference}`);
      return res.status(400).json({ error: 'Le montant payé est inférieur au montant attendu.' });
    }

    // 4. Enregistrement idempotent (l'index unique protège les cas concurrents).
    const enregistrement = await Transaction.create({
      companyId,
      nature,
      reference: transactionId,
      montant: montantReel,
      beneficiaire: nature === 'abonnement' ? 'développeur' : 'commerçant',
      statut: 'payee',
      preuveVerification: transaction,
      verifieLe: new Date()
    });

    // 5. Pour un abonnement, on prolonge la validité de l'entreprise.
    if (nature === 'abonnement') {
      const entreprise = await Entreprise.findOne({ companyId });
      if (entreprise) {
        entreprise.abonnementActif = true;
        const base = entreprise.abonnementEcheance && entreprise.abonnementEcheance > new Date()
          ? entreprise.abonnementEcheance
          : new Date();
        entreprise.abonnementEcheance = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (palier && PRIX_ABONNEMENTS[palier] !== undefined) entreprise.palier = palier;
        await entreprise.save();
      }
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
