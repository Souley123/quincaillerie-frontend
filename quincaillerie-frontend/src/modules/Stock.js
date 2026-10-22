import React, { useState } from 'react';

/* Normalise une famille (catégorie) pour comparer sans se tromper : casse
   ignorée, accents retirés, espaces superflus supprimés. Indispensable car
   une même famille peut être saisie « matelas », « Matelas » ou « Matelas  ».
   Même règle que normaliserFamille() dans App.js, pour que l'affichage du
   tableau de bord et celui du catalogue concordent toujours. */
const normaliserFamille = valeur => String(valeur || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

/* Module « Gestion de Stock » (quincaillerie) — extrait de App.js.
   Composant présentationnel : l'état, les handlers et la persistance
   restent dans App et sont transmis via props.
   Présentation à onglets : Articles | Catégories | Sous-catégories. */
function Stock({
  t,
  bgColor,
  products,
  FAMILLES_PRODUITS,
  fournisseursServeur,
  selectedFamille,
  setSelectedFamille,
  totalValeurStock,
  prodForm,
  setProdForm,
  editingProdId,
  handleProductSubmit,
  resetProdForm,
  handleEditProd,
  handleDeleteProduct,
  sousCategories = [],
  categorieForm,
  setCategorieForm,
  sousCategorieForm,
  setSousCategorieForm,
  categoriesReference = [],
  ajouterCategorie,
  supprimerCategorie,
  ajouterSousCategorie,
  supprimerSousCategorie,
  DEPOTS_LISTE = ['Dépôt Principal']
}) {
  /* Onglet actif du module : « articles », « categories » ou « sousCategories ». */
  const [ongletActif, setOngletActif] = useState('articles');
  /* Filtre de 2e niveau : '' = toute la catégorie. Réinitialisé quand la
     catégorie change, sinon on garderait un filtre ne correspondant à rien. */
  const [sousFiltre, setSousFiltre] = useState('');
  /* Message d'erreur de la dernière opération sur un article (refus serveur :
     e-mail non vérifié, abonnement inactif, doublon…). Sans cet affichage, la
     création échouait sans rien montrer à l'utilisateur. */
  const [messageErreurArticle, setMessageErreurArticle] = useState('');

  /* Enveloppe la soumission : on attend son retour pour savoir si l'opération
     a réellement abouti. Aucune erreur n'était remontée auparavant. */
  const soumettreArticle = async e => {
    setMessageErreurArticle('');
    try {
      await handleProductSubmit(e);
    } catch (erreur) {
      setMessageErreurArticle(erreur?.message || "L'enregistrement a échoué.");
    }
  };

  const familleActive = normaliserFamille(selectedFamille);

  /* Articles de la famille sélectionnée : comparaison sur la forme
     normalisée (casse/accents/espaces ignorés) et non plus stricte, sinon
     un article dont la famille a été saisie différemment (« Matelas » vs
     « matelas ») disparaît du tableau. */
  const produitsDeLaFamille = products.filter(p => normaliserFamille(p.famille) === familleActive);
  const tousLesArticlesSontVides = products.length === 0;
  const categoriesReferenceUniques = [...new Set(categoriesReference)];

  /* Sous-catégories de la catégorie affichée, plus celles déjà utilisées par
     un article : une sous-catégorie ancienne (enregistrée avant la mise en
     place de cette liste) reste ainsi filtrable et réaffectée visuellement. */
  const sousCategoriesDeLaFamille = (() => {
    const vues = new Set();
    const resultat = [];
    [
      ...sousCategories.filter(item => normaliserFamille(item.categorie) === familleActive).map(item => item.nom),
      ...produitsDeLaFamille.map(p => (p.sousCategorie || '').trim())
    ].filter(Boolean).forEach(nom => {
      const cle = normaliserFamille(nom);
      if (cle && !vues.has(cle)) { vues.add(cle); resultat.push(nom); }
    });
    return resultat;
  })();

  const sousFiltreActif = normaliserFamille(sousFiltre);
  const produitsAffiches = sousFiltreActif
    ? produitsDeLaFamille.filter(p => normaliserFamille(p.sousCategorie) === sousFiltreActif)
    : produitsDeLaFamille;

  const sousCategoriesDuFormulaire = sousCategories.filter(
    item => normaliserFamille(item.categorie) === normaliserFamille(prodForm.famille)
  );

  const styleOnglet = actif => ({
    padding: '9px 18px',
    borderRadius: '7px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    backgroundColor: actif ? '#0284c7' : '#cbd5e1',
    color: actif ? 'white' : '#334155'
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <button type="button" onClick={() => setOngletActif('articles')} style={styleOnglet(ongletActif === 'articles')}>Articles</button>
        <button type="button" onClick={() => setOngletActif('categories')} style={styleOnglet(ongletActif === 'categories')}>Catégories</button>
        <button type="button" onClick={() => setOngletActif('sousCategories')} style={styleOnglet(ongletActif === 'sousCategories')}>Sous-catégories</button>
      </div>

      {ongletActif === 'articles' && (
      <div>
      <div className="filters-inline-container">
        <div className="filter-group">
          <label htmlFor="catégorie-articles">Catégorie :</label>
          <select
            id="catégorie-articles"
            value={selectedFamille}
            onChange={e => setSelectedFamille && setSelectedFamille(e.target.value)}
            style={{ minWidth: '300px' }}
          >
            <option value="">Toutes les catégories</option>
            {categoriesReferenceUniques.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        {/* Filtre de sous-catégorie : la chaîne Catégorie → Sous-catégorie →
            Article devient navigable sans passer par le formulaire.
            `htmlFor` + `id` : un clic sur le libellé ouvre bien la liste.
            `minWidth` et fond désactivé restent EN LIGNE (dimensions et état),
            la feuille `.filters-inline-container` / `.filter-group` fournit
            l'apparence commune (index.css). */}
        <div className="filter-group">
          <label htmlFor="sous-categorie-articles">Sous-catégories :</label>
          <select
            id="sous-categorie-articles"
            value={sousFiltre}
            onChange={e => setSousFiltre(e.target.value)}
            style={{ minWidth: '220px' }}
            title={sousCategoriesDeLaFamille.length
              ? 'Filtrer les articles par sous-catégorie'
              : 'Aucune sous-catégorie pour cette catégorie : le filtre reste sur « Toutes »'}
          >
            <option value="">Toutes les sous-catégories</option>
            {sousCategoriesDeLaFamille.map(nom => <option key={`filtre-${nom}`} value={nom}>{nom}</option>)}
          </select>
          {/* Le champ n'est JAMAIS désactivé.
              Avant : `disabled={!sousCategoriesDeLaFamille.length}`. Une
              catégorie sans sous-catégorie enregistrée — cas courant —
              affichait un champ gris impossible à ouvrir, alors qu'il contient
              l'option « Toutes les sous-catégories » qui doit rester
              sélectionnable. On informe sans bloquer. */}
          {sousCategoriesDeLaFamille.length === 0 && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Aucune sous-catégorie définie
            </span>
          )}
        </div>
      </div>

      {/* Le titre « Gestion de Stock - <catégorie> » a été retiré : le module
          est déjà nommé dans la navigation et la catégorie est rappelée par le
          filtre ci-dessus. La barre reste collante pour garder la valeur du
          stock visible pendant le défilement. */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: bgColor, padding: '6px 0 10px 0', zIndex: 10, display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', borderBottom: '1px solid #cbd5e1', marginBottom: '14px' }}>
        <div style={{ backgroundColor: '#16a34a', color: 'white', padding: '7px 11px', borderRadius: '7px', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
            {t.valeurStock} {totalValeurStock.toLocaleString()} FCFA
        </div>
      </div>

      <form onSubmit={soumettreArticle} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, color: '#0284c7' }}>{editingProdId ? "Modifier l'article" : "Créer une fiche article"}</h3>
        {/* Seul un refus de CETTE saisie s'affiche ici. L'erreur globale de
            chargement des données (ex. « Trop de requêtes. Réessayez... »
            venant du limiteur global /api/) n'était pas liée au formulaire :
            elle s'affichait en permanence au-dessus des champs et bloquait la
            saisie alors qu'aucune action n'avait été demandée. */}
        {messageErreurArticle && (
          <p role="alert" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '7px', padding: '9px 12px', margin: '0 0 12px', fontSize: '12.5px', fontWeight: 600 }}>
            {messageErreurArticle}
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Référence Unique" list="liste-refs-produits" value={prodForm.ref} onChange={e => setProdForm({ ...prodForm, ref: e.target.value })} required style={{ padding: '8px' }} />
          <datalist id="liste-refs-produits">
            {products.map((product, index) => <option key={`ref-${index}-${product._id || product.id || product.ref || ''}`} value={product.ref}>{product.nom}</option>)}
          </datalist>
          <input type="text" placeholder="Code-barres (EAN) — optionnel" list="liste-codes-barres" value={prodForm.codeBarre || ''} onChange={e => setProdForm({ ...prodForm, codeBarre: e.target.value })} style={{ padding: '8px' }} />
          <datalist id="liste-codes-barres">
            {products.filter(product => product.codeBarre).map((product, index) => <option key={`barcode-${index}-${product._id || product.id || product.codeBarre || ''}`} value={product.codeBarre} />)}
          </datalist>
          <input type="text" placeholder="Désignation" list="liste-designations" value={prodForm.nom} onChange={e => setProdForm({ ...prodForm, nom: e.target.value })} required style={{ padding: '8px' }} />
          <datalist id="liste-designations">
            {products.map((product, index) => <option key={`name-${index}-${product._id || product.id || product.nom || ''}`} value={product.nom} />)}
          </datalist>
          <input type="text" placeholder="Fournisseur" list="liste-fournisseurs" value={prodForm.fournisseur} onChange={e => setProdForm({ ...prodForm, fournisseur: e.target.value })} required style={{ padding: '8px' }} />
          <datalist id="liste-fournisseurs">
            {[...new Set([
              ...fournisseursServeur.map(f => f.nom),
              ...products.map(product => product.fournisseur)
            ].filter(Boolean))].map(fournisseur => <option key={fournisseur} value={fournisseur} />)}
          </datalist>
          {/* Changer de catégorie invalide la sous-catégorie choisie : garder
              « Marteaux » avec « Peinture » créerait un lien incohérent. */}
          <select value={prodForm.famille} onChange={e => setProdForm({ ...prodForm, famille: e.target.value, sousCategorie: '' })} required style={{ padding: '8px' }} title="Catégorie / famille de l’article" aria-label="Catégorie de l’article">
            {categoriesReferenceUniques.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select
            value={prodForm.sousCategorie || ''}
            onChange={e => setProdForm({ ...prodForm, sousCategorie: e.target.value })}
            disabled={!sousCategoriesDuFormulaire.length}
            style={{ padding: '8px' }}
            title={sousCategoriesDuFormulaire.length ? 'Sous-catégorie (optionnel)' : 'Aucune sous-catégorie pour cette catégorie : créez-en une dans l’onglet Sous-catégories'}
            aria-label="Sous-catégorie de l’article"
          >
            <option value="">
              {sousCategoriesDuFormulaire.length ? 'Sous-catégorie (optionnel)' : 'Aucune sous-catégorie définie'}
            </option>
            {sousCategoriesDuFormulaire.map((item, index) => <option key={`subcategory-${index}-${item.id || `${normaliserFamille(item.categorie)}-${normaliserFamille(item.nom)}`}`} value={item.nom}>{item.nom}</option>)}
          </select>
          <input type="number" placeholder="Prix d'Achat" value={prodForm.prixAchat} onChange={e => setProdForm({ ...prodForm, prixAchat: e.target.value })} required style={{ padding: '8px' }} />
          <input type="number" placeholder="Prix de Vente" value={prodForm.prix} onChange={e => setProdForm({ ...prodForm, prix: e.target.value })} required style={{ padding: '8px' }} />
          <input type="number" min="0" step="1" placeholder="Stock actuel (facultatif, défaut : 0)" value={prodForm.quantiteStock} onChange={e => setProdForm({ ...prodForm, quantiteStock: e.target.value })} style={{ padding: '8px' }} />
          <input type="number" placeholder="Seuil Min" value={prodForm.minStock} onChange={e => setProdForm({ ...prodForm, minStock: e.target.value })} required style={{ padding: '8px' }} />
          <input type="number" placeholder="Capacité Max" value={prodForm.maxStock} onChange={e => setProdForm({ ...prodForm, maxStock: e.target.value })} required style={{ padding: '8px' }} />
          {/* Dépôt de rattachement : le module Multi-dépôts et le tunnel
              Transport lisent cette valeur. Sans ce champ, tout article créé
              était implicitement rangé dans « Dépôt Principal » et
              apparaissait à zéro dans les autres dépôts. */}
          <select
            value={prodForm.depot || DEPOTS_LISTE[0]}
            onChange={e => setProdForm({ ...prodForm, depot: e.target.value })}
            style={{ padding: '8px' }}
            title="Dépôt où se trouve physiquement l’article"
            aria-label="Dépôt de rattachement de l’article"
          >
            {DEPOTS_LISTE.map(depot => <option key={depot} value={depot}>{depot}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button type="submit" style={{ backgroundColor: editingProdId ? '#eab308' : '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{editingProdId ? t.save : t.add}</button>
          {editingProdId && <button type="button" onClick={resetProdForm} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>{t.cancel}</button>}
        </div>
      </form>

      <div className="table-container-mobile">
        <table className="responsive-table" style={{ borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          {/* LARGEURS DE COLONNES EXPLICITES.
              Le style unifié des tableaux impose `table-layout: fixed` : sans
              <colgroup>, les 8 colonnes se partageaient la largeur en parts
              ÉGALES (« Réf » aussi large que « Désignation »), d'où un tableau
              mal organisé.

              TOTAL = 900 px, mesuré pour tenir dans le conteneur réel
              (960 px fenêtre 1280 − barre latérale 260 − padding).
              La version précédente totalisait 1155 px : le tableau débordait
              de 195 px et la colonne « Actions » sortait du cadre.

              Répartition MESURÉE (après rendu réel, 1280 px) : les 12 px de
              padding de chaque côté d'une cellule (style unifié) doivent être
              ajoutés aux 132 px prévus pour « Sous-catégorie », sinon
              l'en-tête était coupé (« Sous-catégo… »). On retire 10 px à
              Désignation et 5 px à Réf, dont les contenus tiennent
              largement. */}
          <colgroup>
            <col style={{ width: '70px' }} />
            <col style={{ width: '180px' }} />
            <col style={{ width: '112px' }} />
            <col style={{ width: '132px' }} />
            <col style={{ width: '104px' }} />
            <col style={{ width: '104px' }} />
            <col style={{ width: '62px' }} />
            <col style={{ width: '136px' }} />
          </colgroup>
          <thead>
            <tr style={{ color: 'white' }}>
              <th>Réf</th>
              <th>Désignation</th>
              <th>Catégorie</th>
              <th>Sous-catégorie</th>
              <th>Fournisseur</th>
              <th style={{ textAlign: 'right' }}>Prix Vente</th>
              <th style={{ textAlign: 'center' }}>Stock</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {produitsAffiches.length === 0 && (
              <tr>
                {/* Ligne de message : on impose la largeur minimale à la CELLULE
                    pour qu'un tableau défilant (largeur intrinsèque) ne l'étire
                    pas hors du cadre visible sur téléphone. */}
                <td colSpan={8} style={{ padding: '8px', color: '#64748b', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                  {produitsDeLaFamille.length === 0
                    ? tousLesArticlesSontVides
                      ? <>Aucun article enregistré. Votre catalogue est vierge : créez une fiche avec le formulaire ci-dessus pour commencer.</>
                      : <>Aucun article dans « {selectedFamille} ». Créez-en un avec le formulaire ci-dessus : il apparaîtra ici.</>
                    : <>Aucun article dans la sous-catégorie « {sousFiltre} » ({(produitsDeLaFamille.length)} article(s) dans la catégorie).</>}
                </td>
              </tr>
            )}
            {produitsAffiches.map((p, index) => (
              <tr key={`product-${index}-${p._id || p.id || p.ref || ''}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ fontWeight: 'bold' }}>{p.ref}</td>
                {/* Désignation : la seule colonne qui a le droit de s'enrouler
                    sur deux lignes (une longue désignation ne doit pas être
                    coupée par une ellipse). */}
                <td style={{ whiteSpace: 'normal' }} title={p.nom}>{p.nom}</td>
                <td>{p.famille}</td>
                <td style={{ color: p.sousCategorie ? '#0f172a' : '#94a3b8' }}>{p.sousCategorie || '—'}</td>
                <td>{p.fournisseur || '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{p.prix.toLocaleString()} FCFA</td>
                <td style={{ textAlign: 'center', color: p.quantiteStock <= p.minStock ? '#ef4444' : '#16a34a', fontWeight: 'bold' }}>{p.quantiteStock}</td>
                {/* Actions : `display: flex` sur une <td> la sortait du mode
                    « cellule de tableau » ; la ligne prenait une hauteur
                    irrégulière et la colonne ne respectait plus sa largeur.
                    Les boutons sont donc dans un conteneur interne. */}
                <td>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'nowrap' }}>
                    <button onClick={() => handleEditProd(p)} title={t.edit} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '4px 7px', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '12px' }}>{t.edit}</button>
                    <button type="button" onClick={() => handleDeleteProduct(p._id)} title="Retirer l’article de la gestion de stock" style={{ backgroundColor: '#fff', color: '#b91c1c', border: '1px solid #fecaca', padding: '4px 7px', minHeight: '28px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '12px' }}>Retirer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
      )}

      {ongletActif === 'categories' && (
        <div>
          <form onSubmit={ajouterCategorie} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, color: '#0284c7' }}>Créer une catégorie</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <input type="text" placeholder="Nom de la catégorie" value={categorieForm?.nom || ''} onChange={e => setCategorieForm({ ...categorieForm, nom: e.target.value })} required style={{ padding: '8px' }} />
              <input type="text" placeholder="Description (optionnel)" value={categorieForm?.description || ''} onChange={e => setCategorieForm({ ...categorieForm, description: e.target.value })} style={{ padding: '8px' }} />
            </div>
            <div style={{ marginTop: '15px' }}>
              <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter la catégorie</button>
            </div>
          </form>

          <div className="table-container-mobile">
            <table className="responsive-table" style={{ borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                  <th style={{ padding: '5px 8px' }}>Catégorie</th>
                  <th style={{ padding: '5px 8px' }}>Description</th>
                  <th style={{ padding: '5px 8px' }}>Articles</th>
                  <th style={{ padding: '5px 8px' }}>Sous-catégories</th>
                  <th style={{ padding: '5px 8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categoriesReferenceUniques.map((cat, index) => (
                  <tr key={`category-${index}-${cat}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{cat}</td>
                    <td style={{ padding: '8px' }}>{FAMILLES_PRODUITS.includes(cat) ? 'Famille de référence' : 'Catégorie personnalisée'}</td>
                    {/* Nombre d'articles rattachés à cette catégorie : même calcul
                        que le sélecteur du tableau de bord, pour que les deux
                        affichages concordent toujours. */}
                    <td style={{ padding: '8px' }}>{products.filter(p => normaliserFamille(p.famille) === normaliserFamille(cat)).length} article(s)</td>
                    <td style={{ padding: '8px' }}>{sousCategories.filter(item => normaliserFamille(item.categorie) === normaliserFamille(cat)).length}</td>
                    <td style={{ padding: '5px 8px' }}>
                      {FAMILLES_PRODUITS.includes(cat) ? (
                        <button
                          type="button"
                          disabled
                          title="Catégorie de référence livrée avec l’application : elle ne peut pas être supprimée."
                          style={{ backgroundColor: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', padding: '5px 9px', borderRadius: '6px', cursor: 'not-allowed', fontWeight: 600, fontSize: '11px' }}
                        >Référence</button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => supprimerCategorie(cat)}
                          title="Supprimer cette catégorie personnalisée"
                          style={{ backgroundColor: '#fff', color: '#b91c1c', border: '1px solid #fecaca', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '11px' }}
                        >Supprimer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ongletActif === 'sousCategories' && (
        <div>
          <form onSubmit={ajouterSousCategorie} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, color: '#0284c7' }}>Créer une sous-catégorie</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <select value={sousCategorieForm?.categorie || ''} onChange={e => setSousCategorieForm({ ...sousCategorieForm, categorie: e.target.value })} required style={{ padding: '8px' }}>
                <option value="">-- Catégorie parente --</option>
                {categoriesReferenceUniques.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="text" placeholder="Nom de la sous-catégorie" value={sousCategorieForm?.nom || ''} onChange={e => setSousCategorieForm({ ...sousCategorieForm, nom: e.target.value })} required style={{ padding: '8px' }} />
              <input type="text" placeholder="Description (optionnel)" value={sousCategorieForm?.description || ''} onChange={e => setSousCategorieForm({ ...sousCategorieForm, description: e.target.value })} style={{ padding: '8px' }} />
            </div>
            <div style={{ marginTop: '15px' }}>
              <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter la sous-catégorie</button>
            </div>
          </form>

          <div className="table-container-mobile">
            <table className="responsive-table" style={{ borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                  <th style={{ padding: '6px 8px' }}>Sous-catégorie</th>
                  <th style={{ padding: '6px 8px' }}>Catégorie parente</th>
                  <th style={{ padding: '6px 8px' }}>Articles</th>
                  <th style={{ padding: '6px 8px' }}>Description</th>
                  <th style={{ padding: '6px 8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sousCategories.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '8px', color: '#64748b' }}>Aucune sous-catégorie enregistrée.</td></tr>
                )}
                {sousCategories.map((item, index) => (
                  <tr key={`subcategory-${index}-${item.id || `${normaliserFamille(item.categorie)}-${normaliserFamille(item.nom)}`}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{item.nom}</td>
                    <td style={{ padding: '6px 8px' }}>{item.categorie}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {products.filter(p => normaliserFamille(p.famille) === normaliserFamille(item.categorie)
                        && normaliserFamille(p.sousCategorie) === normaliserFamille(item.nom)).length}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{item.description || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <button type="button" onClick={() => supprimerSousCategorie(item.id)} style={{ backgroundColor: '#fff', color: '#b91c1c', border: '1px solid #fecaca', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stock;
