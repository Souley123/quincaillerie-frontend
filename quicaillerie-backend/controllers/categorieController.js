const Categorie = require('../models/Categorie');
const Product = require('../models/Product');
const { CompanyId } = require('../middleware/tenant');

/**
 * CONTRÔLEUR : CATÉGORIES ET SOUS-CATÉGORIES
 * ------------------------------------------------------------
 * Garde-fous de cohérence avec les ARTICLES (product.famille et
 * product.sousCategorie) :
 *   - on ne supprime jamais une catégorie qui contient encore des articles ;
 *   - on ne supprime jamais une sous-catégorie qui contient encore des
 *     articles ;
 *   - on ne crée pas de doublon, casse et accents ignorés.
 *
 * L'interface peut choisir de réaffecter les articles AVANT d'appeler la
 * suppression : appeler PUT /api/categories/:id (famille cible) est alors
 * fait par le frontend article par article, puis DELETE réussit.
 */

const CATEGORIE_REPLI = 'Divers';

/* Même règle de normalisation que App.js/Stock.js : minuscules, sans
   accents, espaces superflus supprimés. */
const normaliser = valeur => String(valeur || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
  .slice(0, 80);

const echapperRegex = texte => String(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compterArticles = async (companyId, filtre) => Product.countDocuments({
  companyId,
  actif: true,
  ...filtre
});

/* Article → catégorie : comparaison insensible à la casse et aux accents,
   exactement comme l'affichage (normaliserFamille). */
const filtrerParFamille = nom => ({
  famille: new RegExp(`^\\s*${echapperRegex(nom)}\\s*$`, 'i')
});

// GET /api/categories
const lister = async (req, res) => {
  try {
    const categories = await Categorie.find({ companyId: CompanyId(req) }).sort({ nom: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/categories  { nom, description }
const creer = async (req, res) => {
  try {
    const nom = String(req.body?.nom || '').trim();
    if (!nom) return res.status(400).json({ error: 'Le nom de la catégorie est obligatoire.' });

    const entreprise = CompanyId(req);
    const categorie = await Categorie.create({
      companyId: entreprise,
      nom,
      nomNormalise: normaliser(nom),
      description: String(req.body?.description || '').trim()
    });
    res.status(201).json(categorie);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Cette catégorie existe déjà.' });
    }
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/categories/:id  { nom?, description? }
const modifier = async (req, res) => {
  try {
    const entreprise = CompanyId(req);
    const categorie = await Categorie.findOne({ _id: req.params.id, companyId: entreprise });
    if (!categorie) return res.status(404).json({ error: 'Catégorie introuvable.' });

    if (req.body?.nom !== undefined) {
      const nom = String(req.body.nom).trim();
      if (!nom) return res.status(400).json({ error: 'Le nom de la catégorie est obligatoire.' });

      const nouveauNormalise = normaliser(nom);
      const ancienNom = categorie.nom;
      const renommage = nouveauNormalise !== categorie.nomNormalise;

      /* Renommer une catégorie doit suivre les articles : sans cela ils
         resteraient rattachés à l'ancien nom et disparaîtraient du filtre. */
      if (renommage) {
        await Product.updateMany(
          { companyId: entreprise, ...filtrerParFamille(ancienNom) },
          { $set: { famille: nom } }
        );
      }
      categorie.nom = nom;
      categorie.nomNormalise = nouveauNormalise;
    }
    if (req.body?.description !== undefined) {
      categorie.description = String(req.body.description).trim();
    }

    await categorie.save();
    res.json(categorie);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Une catégorie porte déjà ce nom.' });
    }
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/categories/:id?reaffecter=Divers
const supprimer = async (req, res) => {
  try {
    const entreprise = CompanyId(req);
    const categorie = await Categorie.findOne({ _id: req.params.id, companyId: entreprise });
    if (!categorie) return res.status(404).json({ error: 'Catégorie introuvable.' });

    const articles = await compterArticles(entreprise, filtrerParFamille(categorie.nom));
    const cible = String(req.query.reaffecter || '').trim();

    if (articles > 0) {
      if (!cible) {
        return res.status(409).json({
          error: `« ${categorie.nom} » contient encore ${articles} article(s) actif(s).`,
          code: 'CATEGORIE_NON_VIDE',
          articles,
          suggestion: `Repasser ?reaffecter=${CATEGORIE_REPLI} pour les déplacer.`
        });
      }
      if (normaliser(cible) === categorie.nomNormalise) {
        return res.status(400).json({ error: 'La catégorie de repli doit être différente de celle supprimée.' });
      }
      /* Les articles changent de catégorie ; leur sous-catégorie n'a plus
         de parent et est vidée pour ne pas pointer dans le vide. */
      const resultat = await Product.updateMany(
        { companyId: entreprise, ...filtrerParFamille(categorie.nom) },
        { $set: { famille: cible, sousCategorie: '' } }
      );
      await Categorie.deleteOne({ _id: categorie._id, companyId: entreprise });
      return res.json({
        message: `Catégorie « ${categorie.nom} » supprimée. ${resultat.modifiedCount || 0} article(s) déplacé(s) vers « ${cible} ».`,
        articlesDeplaces: resultat.modifiedCount || 0
      });
    }

    await Categorie.deleteOne({ _id: categorie._id, companyId: entreprise });
    res.json({ message: `Catégorie « ${categorie.nom} » supprimée.`, articlesDeplaces: 0 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// POST /api/categories/:id/sous-categories  { nom, description }
const ajouterSousCategorie = async (req, res) => {
  try {
    const entreprise = CompanyId(req);
    const categorie = await Categorie.findOne({ _id: req.params.id, companyId: entreprise });
    if (!categorie) return res.status(404).json({ error: 'Catégorie introuvable.' });

    const nom = String(req.body?.nom || '').trim();
    if (!nom) return res.status(400).json({ error: 'Le nom de la sous-catégorie est obligatoire.' });

    const cle = normaliser(nom);
    if (categorie.sousCategories.some(item => normaliser(item.nom) === cle)) {
      return res.status(409).json({ error: 'Cette sous-catégorie existe déjà dans cette catégorie.' });
    }
    if (cle === categorie.nomNormalise) {
      return res.status(409).json({ error: 'Une sous-catégorie ne peut pas porter le nom de sa catégorie.' });
    }

    categorie.sousCategories.push({ nom, description: String(req.body?.description || '').trim() });
    await categorie.save();
    res.status(201).json(categorie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/categories/:id/sous-categories/:sousId  { nom?, description? }
const modifierSousCategorie = async (req, res) => {
  try {
    const entreprise = CompanyId(req);
    const categorie = await Categorie.findOne({ _id: req.params.id, companyId: entreprise });
    if (!categorie) return res.status(404).json({ error: 'Catégorie introuvable.' });

    const sousCategorie = categorie.sousCategories.id(req.params.sousId);
    if (!sousCategorie) return res.status(404).json({ error: 'Sous-catégorie introuvable.' });

    if (req.body?.nom !== undefined) {
      const nom = String(req.body.nom).trim();
      if (!nom) return res.status(400).json({ error: 'Le nom de la sous-catégorie est obligatoire.' });
      const cle = normaliser(nom);
      const doublon = categorie.sousCategories.some(
        item => item._id.toString() !== sousCategorie._id.toString() && normaliser(item.nom) === cle
      );
      if (doublon) return res.status(409).json({ error: 'Cette sous-catégorie existe déjà dans cette catégorie.' });

      /* Le renommage doit suivre les articles, comme pour les catégories. */
      if (cle !== normaliser(sousCategorie.nom)) {
        await Product.updateMany(
          {
            companyId: entreprise,
            ...filtrerParFamille(categorie.nom),
            sousCategorie: new RegExp(`^\\s*${echapperRegex(sousCategorie.nom)}\\s*$`, 'i')
          },
          { $set: { sousCategorie: nom } }
        );
      }
      sousCategorie.nom = nom;
    }
    if (req.body?.description !== undefined) {
      sousCategorie.description = String(req.body.description).trim();
    }

    await categorie.save();
    res.json(categorie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/categories/:id/sous-categories/:sousId
const supprimerSousCategorie = async (req, res) => {
  try {
    const entreprise = CompanyId(req);
    const categorie = await Categorie.findOne({ _id: req.params.id, companyId: entreprise });
    if (!categorie) return res.status(404).json({ error: 'Catégorie introuvable.' });

    const sousCategorie = categorie.sousCategories.id(req.params.sousId);
    if (!sousCategorie) return res.status(404).json({ error: 'Sous-catégorie introuvable.' });

    const articles = await compterArticles(entreprise, {
      ...filtrerParFamille(categorie.nom),
      sousCategorie: new RegExp(`^\\s*${echapperRegex(sousCategorie.nom)}\\s*$`, 'i')
    });
    if (articles > 0) {
      return res.status(409).json({
        error: `La sous-catégorie « ${sousCategorie.nom} » contient encore ${articles} article(s). Détachez-les d'abord.`,
        code: 'SOUS_CATEGORIE_NON_VIDE',
        articles
      });
    }

    sousCategorie.deleteOne();
    await categorie.save();
    res.json({ message: `Sous-catégorie « ${sousCategorie.nom} » supprimée.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  lister,
  creer,
  modifier,
  supprimer,
  ajouterSousCategorie,
  modifierSousCategorie,
  supprimerSousCategorie,
  normaliser,
  CATEGORIE_REPLI
};
