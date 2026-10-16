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
  supprimerSousCategorie
}) {
  /* Onglet actif du module : « articles », « categories » ou « sousCategories ». */
  const [ongletActif, setOngletActif] = useState('articles');

  const familleActive = normaliserFamille(selectedFamille);

  /* Articles de la famille sélectionnée : comparaison sur la forme
     normalisée (casse/accents/espaces ignorés) et non plus stricte, sinon
     un article dont la famille a été saisie différemment (« Matelas » vs
     « matelas ») disparaît du tableau. */
  const produitsDeLaFamille = products.filter(p => normaliserFamille(p.famille) === familleActive);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <label htmlFor="catégorie-articles" style={{ fontWeight: 'bold', fontSize: '14px' }}>Catégorie, :</label>
        <select
          id="catégorie-articles"
          value={selectedFamille}
          onChange={e => setSelectedFamille && setSelectedFamille(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #94a3b8', minWidth: '320px', fontSize: '14px', backgroundColor: '#fff', cursor: 'pointer' }}
        >
          {categoriesReference.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      <div style={{ position: 'sticky', top: 0, backgroundColor: bgColor, padding: '6px 0 10px 0', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', marginBottom: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>
          {t.stock} - <span style={{ color: '#0284c7' }}>{selectedFamille}</span>
        </h2>

        <div style={{ backgroundColor: '#16a34a', color: 'white', padding: '7px 11px', borderRadius: '7px', fontWeight: 'bold', fontSize: '13px' }}>
            {t.valeurStock} {totalValeurStock.toLocaleString()} FCFA
        </div>
      </div>

      <form onSubmit={handleProductSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, color: '#0284c7' }}>{editingProdId ? "Modifier l'article" : "Créer une fiche article"}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Référence Unique" list="liste-refs-produits" value={prodForm.ref} onChange={e => setProdForm({ ...prodForm, ref: e.target.value })} required style={{ padding: '8px' }} />
          <datalist id="liste-refs-produits">
            {products.map(product => <option key={product._id} value={product.ref}>{product.nom}</option>)}
          </datalist>
          <input type="text" placeholder="Code-barres (EAN) — optionnel" list="liste-codes-barres" value={prodForm.codeBarre || ''} onChange={e => setProdForm({ ...prodForm, codeBarre: e.target.value })} style={{ padding: '8px' }} />
          <datalist id="liste-codes-barres">
            {products.filter(product => product.codeBarre).map(product => <option key={product._id} value={product.codeBarre} />)}
          </datalist>
          <input type="text" placeholder="Désignation" list="liste-designations" value={prodForm.nom} onChange={e => setProdForm({ ...prodForm, nom: e.target.value })} required style={{ padding: '8px' }} />
          <datalist id="liste-designations">
            {products.map(product => <option key={product._id} value={product.nom} />)}
          </datalist>
          <input type="text" placeholder="Fournisseur" list="liste-fournisseurs" value={prodForm.fournisseur} onChange={e => setProdForm({ ...prodForm, fournisseur: e.target.value })} required style={{ padding: '8px' }} />
          <datalist id="liste-fournisseurs">
            {[...new Set([
              ...fournisseursServeur.map(f => f.nom),
              ...products.map(product => product.fournisseur)
            ].filter(Boolean))].map(fournisseur => <option key={fournisseur} value={fournisseur} />)}
          </datalist>
          <select value={prodForm.famille} onChange={e => setProdForm({ ...prodForm, famille: e.target.value })} required style={{ padding: '8px' }} title="Catégorie / famille de l’article">
            {categoriesReference.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={prodForm.sousCategorie || ''} onChange={e => setProdForm({ ...prodForm, sousCategorie: e.target.value })} style={{ padding: '8px' }} title="Sous-catégorie (optionnel)">
            <option value="">Sous-catégorie (optionnel)</option>
            {sousCategories.filter(item => normaliserFamille(item.categorie) === normaliserFamille(prodForm.famille)).map(item => <option key={item.id} value={item.nom}>{item.nom}</option>)}
          </select>
          <input type="number" placeholder="Prix d'Achat" value={prodForm.prixAchat} onChange={e => setProdForm({ ...prodForm, prixAchat: e.target.value })} required style={{ padding: '8px' }} />
          <input type="number" placeholder="Prix de Vente" value={prodForm.prix} onChange={e => setProdForm({ ...prodForm, prix: e.target.value })} required style={{ padding: '8px' }} />
          <input type="number" min="0" step="1" placeholder="Stock actuel (facultatif, défaut : 0)" value={prodForm.quantiteStock} onChange={e => setProdForm({ ...prodForm, quantiteStock: e.target.value })} style={{ padding: '8px' }} />
          <input type="number" placeholder="Seuil Min" value={prodForm.minStock} onChange={e => setProdForm({ ...prodForm, minStock: e.target.value })} required style={{ padding: '8px' }} />
          <input type="number" placeholder="Capacité Max" value={prodForm.maxStock} onChange={e => setProdForm({ ...prodForm, maxStock: e.target.value })} required style={{ padding: '8px' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button type="submit" style={{ backgroundColor: editingProdId ? '#eab308' : '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{editingProdId ? t.save : t.add}</button>
          {editingProdId && <button type="button" onClick={resetProdForm} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>{t.cancel}</button>}
        </div>
      </form>

      <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
              <th style={{ padding: '12px' }}>Réf</th>
              <th style={{ padding: '12px' }}>Désignation</th>
              <th style={{ padding: '12px' }}>Fournisseur</th>
              <th style={{ padding: '12px' }}>Prix Vente</th>
              <th style={{ padding: '12px' }}>Stock</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {produitsDeLaFamille.map(p => (
              <tr key={p._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.ref}</td>
                <td style={{ padding: '12px' }}>{p.nom}</td>
                <td style={{ padding: '12px' }}>{p.fournisseur}</td>
                <td style={{ padding: '12px' }}>{p.prix.toLocaleString()} FCFA</td>
                <td style={{ padding: '12px', color: p.quantiteStock <= p.minStock ? '#ef4444' : '#16a34a', fontWeight: 'bold' }}>{p.quantiteStock}</td>
                <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEditProd(p)} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>{t.edit}</button>
                  <button type="button" onClick={() => handleDeleteProduct(p._id)} title="Retirer l’article de la gestion de stock" style={{ backgroundColor: '#fff', color: '#b91c1c', border: '1px solid #fecaca', padding: '7px 12px', minHeight: '36px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>Retirer l’article</button>
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

          <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                  <th style={{ padding: '8px' }}>Catégorie</th>
                  <th style={{ padding: '8px' }}>Description</th>
                  <th style={{ padding: '8px' }}>Articles</th>
                  <th style={{ padding: '8px' }}>Sous-catégories</th>
                  <th style={{ padding: '8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categoriesReference.map(cat => (
                  <tr key={cat} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{cat}</td>
                    <td style={{ padding: '8px' }}>{FAMILLES_PRODUITS.includes(cat) ? 'Famille de référence' : 'Catégorie personnalisée'}</td>
                    {/* Nombre d'articles rattachés à cette catégorie : même calcul
                        que le sélecteur du tableau de bord, pour que les deux
                        affichages concordent toujours. */}
                    <td style={{ padding: '8px' }}>{products.filter(p => normaliserFamille(p.famille) === normaliserFamille(cat)).length} article(s)</td>
                    <td style={{ padding: '8px' }}>{sousCategories.filter(item => normaliserFamille(item.categorie) === normaliserFamille(cat)).length}</td>
                    <td style={{ padding: '8px' }}>
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
                {categoriesReference.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="text" placeholder="Nom de la sous-catégorie" value={sousCategorieForm?.nom || ''} onChange={e => setSousCategorieForm({ ...sousCategorieForm, nom: e.target.value })} required style={{ padding: '8px' }} />
              <input type="text" placeholder="Description (optionnel)" value={sousCategorieForm?.description || ''} onChange={e => setSousCategorieForm({ ...sousCategorieForm, description: e.target.value })} style={{ padding: '8px' }} />
            </div>
            <div style={{ marginTop: '15px' }}>
              <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter la sous-catégorie</button>
            </div>
          </form>

          <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                  <th style={{ padding: '12px' }}>Sous-catégorie</th>
                  <th style={{ padding: '12px' }}>Catégorie parente</th>
                  <th style={{ padding: '12px' }}>Description</th>
                  <th style={{ padding: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sousCategories.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '12px', color: '#64748b' }}>Aucune sous-catégorie enregistrée.</td></tr>
                )}
                {sousCategories.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.nom}</td>
                    <td style={{ padding: '12px' }}>{item.categorie}</td>
                    <td style={{ padding: '12px' }}>{item.description || '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <button type="button" onClick={() => supprimerSousCategorie(item.id)} style={{ backgroundColor: '#fff', color: '#b91c1c', border: '1px solid #fecaca', padding: '7px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Supprimer</button>
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
