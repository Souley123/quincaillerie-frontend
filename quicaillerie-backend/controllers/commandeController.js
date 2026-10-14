const Commande = require('../models/Commande');
const Product = require('../models/Product');
const { entrerStock } = require('../services/stockService');
const { CompanyId, ObjectIdValide } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : COMMANDES D'ACHAT (bons de commande fournisseurs)
 * ------------------------------------------------------------
 * Source de vérité du module « Achats & Fournisseurs » côté client.
 * Toutes les requêtes sont cloisonnées par le middleware multi-tenant :
 * chaque document porte un `companyId` et n'est jamais visible hors de
 * l'entreprise propriétaire.
 */

/* Statuts acceptés par le schéma Commande. */
const STATUTS = ['À commander', 'Commandée', 'Réceptionnée', 'Annulée'];
const MODES = ['Manuelle', 'Automatique', 'Pré-remplie'];

/* Référence lisible et unique : CMD-<horodatage base36>-<aléa>. */
const genererReference = () =>
  `CMD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// GET /api/commandes?limite=&statut=
const lister = async (req, res) => {
  try {
    const { limite, statut } = req.query;
    const filtre = { companyId: CompanyId(req) };
    if (statut) filtre.statut = statut;

    const commandes = await Commande.find(filtre)
      .sort({ date: -1 })
      .limit(Math.min(Number(limite) || 300, 1000));

    res.json(commandes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/commandes/:id
const afficher = async (req, res) => {
  try {
    if (!ObjectIdValide(req.params.id)) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }
    const commande = await Commande.findOne({ _id: req.params.id, companyId: CompanyId(req) });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable.' });
    res.json(commande);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Construit les lignes de commande à partir du corps de la requête.
 * Accepte deux formats :
 *   - `produits` : lignes déjà détaillées (produitId, ref, nom, quantite, prixAchat) ;
 *   - `lignes`  : lignes minimales ({ ref } ou { produitId }) résolues en base.
 * Renvoie { lignes, montantTotal } ou lève une erreur de validation.
 */
const construireLignes = async (req) => {
  const corps = req.body || {};
  const produitsFournis = Array.isArray(corps.produits)
    ? corps.produits
    : (Array.isArray(corps.lignes) ? corps.lignes : []);

  if (produitsFournis.length === 0) {
    const erreur = new Error('La commande doit contenir au moins un produit.');
    erreur.statut = 400;
    throw erreur;
  }

  const lignes = [];
  let montantTotal = 0;

  for (const item of produitsFournis) {
    const quantite = Number(item.quantite) || 0;
    if (quantite <= 0) continue;

    /* Résolution du produit : par identifiant Mongo, sinon par référence. */
    const identifiant = item.produitId || item._id;
    let produit = null;
    if (identifiant && ObjectIdValide(identifiant)) {
      produit = await Product.findOne({ _id: identifiant, companyId: CompanyId(req) });
    }
    if (!produit && item.ref) {
      produit = await Product.findOne({ ref: item.ref, companyId: CompanyId(req) });
    }
    if (!produit) continue;

    const prixAchat = Number(item.prixAchat) || produit.prixAchat || 0;
    montantTotal += prixAchat * quantite;

    lignes.push({
      produitId: produit._id,
      ref: produit.ref,
      nom: item.nom || produit.nom,
      quantite,
      prixAchat
    });
  }

  if (lignes.length === 0) {
    const erreur = new Error('Aucune ligne valide dans la commande.');
    erreur.statut = 400;
    throw erreur;
  }

  return { lignes, montantTotal };
};

// POST /api/commandes
const creer = async (req, res) => {
  try {
    const corps = req.body || {};
    const fournisseur = String(corps.fournisseur || '').trim();
    if (!fournisseur) {
      return res.status(400).json({ error: 'Le fournisseur est obligatoire.' });
    }

    const { lignes, montantTotal } = await construireLignes(req);

    const commande = await Commande.create({
      companyId: CompanyId(req),
      reference: corps.reference || genererReference(),
      fournisseur,
      fournisseurId: corps.fournisseurId && ObjectIdValide(corps.fournisseurId) ? corps.fournisseurId : null,
      produits: lignes,
      montantTotal,
      mode: MODES.includes(corps.mode) ? corps.mode : 'Manuelle',
      statut: STATUTS.includes(corps.statut) ? corps.statut : 'À commander',
      depot: corps.depot || 'Dépôt Principal',
      commentaire: corps.commentaire || ''
    });

    res.status(201).json(commande);
  } catch (err) {
    res.status(err.statut || 400).json({ error: err.message });
  }
};

// PUT /api/commandes/:id
const modifier = async (req, res) => {
  try {
    const { companyId: _ignore, produits, ...champs } = req.body || {};

    if (champs.statut && !STATUTS.includes(champs.statut)) {
      return res.status(400).json({ error: 'Statut de commande invalide.' });
    }
    if (champs.mode && !MODES.includes(champs.mode)) {
      return res.status(400).json({ error: 'Mode de commande invalide.' });
    }

    if (Array.isArray(produits)) {
      const { lignes, montantTotal } = await construireLignes(req);
      champs.produits = lignes;
      champs.montantTotal = montantTotal;
    }

    /* Réception : on horodate automatiquement si ce n'est pas déjà fait. */
    if (champs.statut === 'Réceptionnée' && !champs.dateReception) {
      champs.dateReception = new Date();
    }

    const commande = await Commande.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: champs },
      { new: true, runValidators: true }
    );

    if (!commande) return res.status(404).json({ error: 'Commande introuvable.' });
    res.json(commande);
  } catch (err) {
    res.status(err.statut || 400).json({ error: err.message });
  }
};

// PATCH /api/commandes/:id/statut → transition rapide (Commandée, Réceptionnée…)
const changerStatut = async (req, res) => {
  try {
    const statut = req.body?.statut;
    if (!STATUTS.includes(statut)) {
      return res.status(400).json({ error: 'Statut de commande invalide.' });
    }

    if (!ObjectIdValide(req.params.id)) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    /* Réception : opération ATOMIQUE et IDEMPOTENTE.
       On ne passe à « Réceptionnée » que si la commande ne l'était pas
       déjà (filtre `statut: { $ne: 'Réceptionnée' }`), sinon un double clic
       ou un rejeu de requête incrémenterait le stock deux fois.
       La mise à jour de statut est faite EN PREMIER, puis le stock est
       incrémenté ligne par ligne : si l'incrément échoue, on annule le
       passage à « Réceptionnée » pour ne pas laisser un état mensonger. */
    if (statut === 'Réceptionnée') {
      const commande = await Commande.findOneAndUpdate(
        {
          _id: req.params.id,
          companyId: CompanyId(req),
          statut: { $ne: 'Réceptionnée' }
        },
        { $set: { statut, dateReception: new Date() } },
        { new: true, runValidators: true }
      );

      /* Déjà réceptionnée (ou inexistante) : on renvoie l'état courant sans
         toucher au stock. Réponse 200 idempotente pour un simple rejeu. */
      if (!commande) {
        const existante = await Commande.findOne({
          _id: req.params.id,
          companyId: CompanyId(req)
        });
        if (!existante) return res.status(404).json({ error: 'Commande introuvable.' });
        return res.json(existante);
      }

      /* Incrémente le stock de chaque ligne et journalise le mouvement.
         On conserve la commande en base : le statut reste « Réceptionnée »
         même si un produit a été supprimé entre-temps (ligne ignorée). */
      try {
        for (const ligne of commande.produits) {
          const produit = await Product.findOne({
            _id: ligne.produitId,
            companyId: CompanyId(req)
          });
          if (!produit) continue;

          await entrerStock({
            companyId: CompanyId(req),
            produitId: ligne.produitId,
            quantite: ligne.quantite,
            type: 'RECEPTION',
            motif: `Réception commande ${commande.reference}`,
            operateur: req.utilisateur?.email || '',
            depot: commande.depot || 'Dépôt Principal'
          });
        }
      } catch (errStock) {
        /* Échec de mise à jour du stock : on restaure le statut précédent
           pour que l'utilisateur puisse réessayer la réception. */
        await Commande.updateOne(
          { _id: commande._id, companyId: CompanyId(req), statut: 'Réceptionnée' },
          { $set: { statut: 'Commandée', dateReception: null } }
        ).catch(() => {});
        return res.status(400).json({
          error: `Réception impossible (stock non mis à jour) : ${errStock.message}`
        });
      }

      return res.json(commande);
    }

    const champs = { statut };
    if (statut === 'À commander') champs.dateReception = null;

    const commande = await Commande.findOneAndUpdate(
      { _id: req.params.id, companyId: CompanyId(req) },
      { $set: champs },
      { new: true, runValidators: true }
    );

    if (!commande) return res.status(404).json({ error: 'Commande introuvable.' });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/commandes/:id → suppression réelle (un bon annulé n'a pas à rester)
const supprimer = async (req, res) => {
  try {
    const commande = await Commande.findOneAndDelete({
      _id: req.params.id,
      companyId: CompanyId(req)
    });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable.' });
    res.json({ message: `Commande « ${commande.reference} » supprimée.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { lister, afficher, creer, modifier, changerStatut, supprimer };
