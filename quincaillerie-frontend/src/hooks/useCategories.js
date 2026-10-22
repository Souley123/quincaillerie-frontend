import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listerCategories,
  creerCategorie,
  supprimerCategorie as supprimerCategorieApi,
  ajouterSousCategorie as ajouterSousCategorieApi,
  supprimerSousCategorie as supprimerSousCategorieApi,
  messageErreur
} from '../services/api';
import { cleIsolee } from '../services/stockageCompte';
import { enregistrerStockageLocal } from '../services/persistance';
import { confirmer } from '../services/dialogues';
import { normaliserFamille } from '../data/familles';

export const CATEGORIE_REPLI = 'Divers';

/**
 * Référentiel des catégories et sous-catégories.
 * Le SERVEUR fait foi : les états ici ne sont que le reflet de ses réponses.
 *
 * @param {object} params
 * @param {boolean} params.isAuthenticated
 * @param {Array}   params.products           articles (pour rattacher les familles)
 * @param {Array}   params.FAMILLES_PRODUITS  familles de référence
 * @param {string}  params.selectedFamille
 * @param {(nom: string) => void} params.setSelectedFamille
 * @param {(id: string, donnees: object) => Promise<{ok: boolean, erreur?: string}>} params.modifierProduit
 */
export default function useCategories({
  isAuthenticated,
  products,
  FAMILLES_PRODUITS,
  selectedFamille,
  setSelectedFamille,
  modifierProduit
}) {
  const [categorieForm, setCategorieForm] = useState({ nom: '', description: '' });
  const [sousCategorieForm, setSousCategorieForm] = useState({ nom: '', categorie: '', description: '' });
  const [categoriesServeur, setCategoriesServeur] = useState([]);
  const [chargementCategories, setChargementCategories] = useState(false);
  const [erreurCategories, setErreurCategories] = useState('');
  const categorieRechargeEnCours = useRef(false);

  const rechargerCategories = useCallback(async () => {
    if (!isAuthenticated || categorieRechargeEnCours.current) return;
    categorieRechargeEnCours.current = true;
    setChargementCategories(true);
    try {
      const liste = await listerCategories();
      setCategoriesServeur(Array.isArray(liste) ? liste : []);
      setErreurCategories('');
    } catch (erreur) {
      setErreurCategories(messageErreur(erreur));
    } finally {
      setChargementCategories(false);
      categorieRechargeEnCours.current = false;
    }
  }, [isAuthenticated]);

  /* Migration, une seule fois par compte : l'ancien référentiel local est
     envoyé au serveur, puis oublié LOCALEMENT. On ne l'efface QUE si tous les
     envois ont réussi (les doublons renvoyant 409 sont considérés comme déjà
     présents) : sinon, une coupure réseau ferait perdre les catégories. */
  const migrationCategoriesEnCours = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || migrationCategoriesEnCours.current) return undefined;
    if (localStorage.getItem(cleIsolee('categoriesMigrees')) === 'true') return undefined;
    migrationCategoriesEnCours.current = true;

    (async () => {
      let anciennes = [];
      let anciennesSous = [];
      try { anciennes = JSON.parse(localStorage.getItem(cleIsolee('categoriesAjoutees')) || '[]') || []; } catch { /* ignoré */ }
      try { anciennesSous = JSON.parse(localStorage.getItem(cleIsolee('sousCategories')) || '[]') || []; } catch { /* ignoré */ }
      if (!anciennes.length && !anciennesSous.length) {
        enregistrerStockageLocal('categoriesMigrees', 'true');
        return;
      }

      let toutEnvoye = true;
      const parNom = {};
      for (const categorie of anciennes) {
        if (!categorie?.nom) continue;
        const resultat = await creerCategorie({ nom: categorie.nom, description: categorie.description || '' });
        // 409 = déjà présente sur le serveur : ce n'est pas un échec.
        if (!resultat.ok && !/existe déjà/i.test(resultat.erreur || '')) toutEnvoye = false;
      }

      const serveur = await listerCategories().catch(() => null);
      (serveur || []).forEach(c => { parNom[normaliserFamille(c.nom)] = c; });
      for (const sous of anciennesSous) {
        if (!sous?.nom || !sous?.categorie) continue;
        const parent = parNom[normaliserFamille(sous.categorie)];
        if (!parent) continue;
        const resultat = await ajouterSousCategorieApi(parent._id, {
          nom: sous.nom,
          description: sous.description || ''
        });
        if (!resultat.ok && !/existe déjà/i.test(resultat.erreur || '')) toutEnvoye = false;
      }

      if (toutEnvoye) {
        try {
          localStorage.removeItem(cleIsolee('categoriesAjoutees'));
          localStorage.removeItem(cleIsolee('sousCategories'));
        } catch { /* stockage indisponible */ }
        enregistrerStockageLocal('categoriesMigrees', 'true');
      }
      await rechargerCategories();
    })();
    return undefined;
  }, [isAuthenticated, rechargerCategories]);

  /* Aplatit le référentiel serveur en deux listes attendues par Stock.js. */
  const categoriesAjoutees = useMemo(
    () => categoriesServeur.map(c => ({ id: c._id, nom: c.nom, description: c.description || '' })),
    [categoriesServeur]
  );

  const sousCategories = useMemo(() => (
    categoriesServeur.flatMap(c => (c.sousCategories || []).map(sous => ({
      id: sous._id,
      nom: sous.nom,
      categorie: c.nom,
      description: sous.description || '',
      categorieId: c._id
    })))
  ), [categoriesServeur]);

  /* Les catégories disponibles = familles de référence + catégories
     personnalisées + familles RÉELLEMENT présentes sur un article. */
  const categoriesReference = useMemo(() => {
    const vues = new Set();
    const resultat = [];
    [
      ...FAMILLES_PRODUITS,
      ...categoriesAjoutees.map(c => c.nom).filter(Boolean),
      ...products.map(p => (p.famille || '').trim())
    ]
      .filter(Boolean)
      .forEach(famille => {
        const cle = normaliserFamille(famille);
        if (cle && !vues.has(cle)) {
          vues.add(cle);
          resultat.push(famille);
        }
      });
    return resultat;
  }, [categoriesAjoutees, products, FAMILLES_PRODUITS]);

  /* Familles réellement exploitables ; dédoublonnées sur la forme normalisée. */
  const famillesDashboard = useMemo(() => {
    const vues = new Set();
    const resultat = [];
    [...categoriesReference, ...products.map(p => (p.famille || '').trim())]
      .filter(Boolean)
      .forEach(famille => {
        const cle = normaliserFamille(famille);
        if (cle && !vues.has(cle)) {
          vues.add(cle);
          resultat.push(famille);
        }
      });
    return resultat;
  }, [categoriesReference, products]);

  /* Familles qui contiennent RÉELLEMENT au moins un article. */
  const famillesDisponibles = useMemo(() => famillesDashboard.filter(famille =>
    products.some(produit => normaliserFamille(produit.famille) === normaliserFamille(famille))
  ), [famillesDashboard, products]);

  useEffect(() => {
    // Si aucune famille ne contient d'article, on retombe sur les familles de
    // référence ; sinon on garde la famille courante si elle est valide.
    const liste = famillesDisponibles.length ? famillesDisponibles : famillesDashboard;
    if (!liste.length) return;
    const cleActive = normaliserFamille(selectedFamille);
    if (!liste.some(famille => normaliserFamille(famille) === cleActive)) {
      setSelectedFamille(liste[0]);
    }
  }, [famillesDisponibles, famillesDashboard, selectedFamille, setSelectedFamille]);

  /* Ajouter une catégorie personnalisée (hors familles de référence). */
  const ajouterCategorie = async e => {
    e.preventDefault();
    const nom = categorieForm.nom.trim();
    if (!nom) { alert('Indiquez le nom de la catégorie.'); return; }
    if (categoriesReference.some(c => normaliserFamille(c) === normaliserFamille(nom))) {
      alert('Cette catégorie existe déjà.'); return;
    }
    if (!isAuthenticated) {
      alert('Connectez-vous pour créer une catégorie : elles sont partagées par toute l’entreprise.');
      return;
    }
    const resultat = await creerCategorie({ nom, description: categorieForm.description.trim() });
    if (!resultat.ok) { alert(resultat.erreur); return; }
    setCategorieForm({ nom: '', description: '' });
    await rechargerCategories();
  };

  /* Suppression d'une catégorie : les articles rattachés basculent sur « Divers ». */
  const supprimerCategorie = async nom => {
    const cle = normaliserFamille(nom);
    const categorieServeur = categoriesServeur.find(c => normaliserFamille(c.nom) === cle);

    /* Une famille de référence se RÉ-AFFICHE toujours (elle vient du code). */
    if (FAMILLES_PRODUITS.some(famille => normaliserFamille(famille) === cle)) {
      alert(
        `« ${nom} » est une famille de référence fournie avec l'application : elle ne peut pas être supprimée. `
        + 'Vous pouvez la laisser vide, elle ne gêne pas.'
      );
      return;
    }

    const concernes = products.filter(p => normaliserFamille(p.famille) === cle);
    const paragraphe = concernes.length
      ? `${concernes.length} article(s) de « ${nom} » seront déplacés vers « ${CATEGORIE_REPLI} » (le stock et les ventes sont conservés).`
      : 'Aucun article n’est rattaché à cette catégorie.';
    const confirme = await confirmer(
      `Supprimer la catégorie « ${nom} » et ses sous-catégories ? ${paragraphe}`,
      'Supprimer la catégorie'
    );
    if (!confirme) return;

    /* Catégorie absente du serveur : on la crée d'abord, sinon le DELETE
       répond 404 — cas fréquent pour une catégorie locale jamais migrée. */
    let serveur = categorieServeur;
    if (!serveur) {
      await creerCategorie({ nom, description: '' }).catch(() => null);
      try {
        const liste = await listerCategories();
        setCategoriesServeur(Array.isArray(liste) ? liste : []);
        serveur = (Array.isArray(liste) ? liste : [])
          .find(c => normaliserFamille(c.nom) === cle) || null;
      } catch {
        serveur = null;
      }
    }

    if (!serveur) {
      /* Dernier recours : la catégorie n'existe QUE sur des articles. */
      if (!concernes.length) {
        alert(`La catégorie « ${nom} » n’a pas pu être retrouvée. Rechargez la page puis réessayez.`);
        return;
      }
      let deplaces = 0;
      for (const article of concernes) {
        if (!article._id) continue;
        try {
          /* `?.` : si un jour le contrat de modifierProduit change encore,
             on ne compte pas un article comme déplacé au hasard. */
          const resultat = await modifierProduit(article._id, { famille: CATEGORIE_REPLI, sousCategorie: '' });
          if (resultat?.ok) deplaces += 1;
        } catch { /* article conservé : on continue les autres */ }
      }
      await rechargerCategories();
      setSelectedFamille(CATEGORIE_REPLI);
      if (deplaces < concernes.length) {
        alert(
          `${deplaces} article(s) sur ${concernes.length} ont pu être déplacés vers « ${CATEGORIE_REPLI} ». `
          + 'Les autres n’ont pas pu être enregistrés : vérifiez votre connexion puis réessayez.'
        );
      }
      return;
    }

    const resultat = await supprimerCategorieApi(serveur._id, CATEGORIE_REPLI);
    if (!resultat.ok) {
      alert(resultat.erreur || 'Suppression impossible pour le moment.');
      return;
    }

    if (concernes.length) setSelectedFamille(CATEGORIE_REPLI);
    await rechargerCategories();

    /* Vérification APRÈS suppression : si la ligne subsiste, c'est qu'un
       article porte encore cette famille (donnée locale non synchronisée). */
    const restants = products.filter(p => normaliserFamille(p.famille) === cle).length;
    if (restants > 0) {
      alert(
        `Catégorie supprimée sur le serveur, mais ${restants} article(s) de cet appareil portent encore « ${nom} » : `
        + 'la ligne reste affichée. Ouvrez chaque article concerné et changez sa famille.'
      );
    }
  };

  /* Ajouter une sous-catégorie rattachée à la catégorie parente choisie. */
  const ajouterSousCategorie = async e => {
    e.preventDefault();
    const nom = sousCategorieForm.nom.trim();
    if (!sousCategorieForm.categorie) { alert('Choisissez d’abord la catégorie parente.'); return; }
    if (!nom) { alert('Indiquez le nom de la sous-catégorie.'); return; }

    /* Garde-fous : pas de doublon dans la catégorie, pas d'homonyme de catégorie. */
    const cleNom = normaliserFamille(nom);
    const cleParent = normaliserFamille(sousCategorieForm.categorie);
    if (sousCategories.some(item => normaliserFamille(item.nom) === cleNom
      && normaliserFamille(item.categorie) === cleParent)) {
      alert('Cette sous-catégorie existe déjà dans cette catégorie.'); return;
    }
    if (categoriesReference.some(c => normaliserFamille(c) === cleNom)) {
      alert('Ce nom est déjà celui d’une catégorie : choisissez un nom différent.'); return;
    }

    const parent = categoriesServeur.find(
      c => normaliserFamille(c.nom) === normaliserFamille(sousCategorieForm.categorie)
    );
    if (!parent) {
      alert('Les sous-catégories ne peuvent être ajoutées qu’à une catégorie créée par l’entreprise.');
      return;
    }
    const resultat = await ajouterSousCategorieApi(parent._id, {
      nom,
      description: sousCategorieForm.description.trim()
    });
    if (!resultat.ok) { alert(resultat.erreur); return; }
    setSousCategorieForm({ nom: '', categorie: sousCategorieForm.categorie, description: '' });
    await rechargerCategories();
  };

  /* Suppression d'une sous-catégorie : on détache d'abord les articles. */
  const supprimerSousCategorie = async id => {
    const cible = sousCategories.find(item => item.id === id);
    if (!cible) {
      alert('Sous-catégorie introuvable. Rechargez la page puis réessayez.');
      return;
    }
    if (!cible.categorieId) {
      alert(
        `« ${cible.nom} » n’est pas enregistrée sur le serveur (sous-catégorie locale). `
        + 'Elle disparaîtra après avoir retiré ce nom des articles concernés.'
      );
      return;
    }
    const cleCategorie = normaliserFamille(cible.categorie);
    const cleNom = normaliserFamille(cible.nom);
    const concernes = products.filter(p => normaliserFamille(p.famille) === cleCategorie
      && normaliserFamille(p.sousCategorie) === cleNom);

    if (concernes.length) {
      const confirme = await confirmer(
        `${concernes.length} article(s) de la sous-catégorie « ${cible.nom} » resteront dans « ${cible.categorie} » sans sous-catégorie. Continuer ?`,
        'Supprimer la sous-catégorie'
      );
      if (!confirme) return;
      for (const article of concernes) {
        const resultat = await modifierProduit(article._id || article.id, { sousCategorie: '' });
        if (!resultat?.ok) {
          alert(`« ${article.nom} » n’a pas pu être détaché : ${resultat?.erreur || 'réponse inattendue du serveur.'}`);
          return;
        }
      }
    }

    const resultat = await supprimerSousCategorieApi(cible.categorieId, cible.id);
    if (!resultat.ok) {
      alert(resultat.erreur || 'Suppression de la sous-catégorie impossible pour le moment.');
      return;
    }
    await rechargerCategories();
  };

  return {
    categorieForm,
    setCategorieForm,
    sousCategorieForm,
    setSousCategorieForm,
    categoriesServeur,
    chargementCategories,
    erreurCategories,
    rechargerCategories,
    categoriesAjoutees,
    sousCategories,
    categoriesReference,
    famillesDashboard,
    famillesDisponibles,
    ajouterCategorie,
    supprimerCategorie,
    ajouterSousCategorie,
    supprimerSousCategorie,
    /* Exposé pour relancer la lecture du référentiel à l'ouverture du module
       Gestion de stock : sans cela, un échec réseau ou un refus 429 au
       démarrage restait définitivement affiché. */
    rechargerCategories
  };
}
