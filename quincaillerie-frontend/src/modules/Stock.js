import React from 'react';

/* Module « Gestion de Stock » (quincaillerie) — extrait de App.js.
   Composant présentationnel : l'état, les handlers et la persistance
   restent dans App et sont transmis via props. */
function Stock({
  t,
  bgColor,
  products,
  FAMILLES_PRODUITS,
  fournisseursServeur,
  selectedFamille,
  totalValeurStock,
  prodForm,
  setProdForm,
  editingProdId,
  handleProductSubmit,
  resetProdForm,
  handleEditProd,
  handleDeleteProduct
}) {
  return (
    <div>
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
          <><input type="text" list="suggestions-familles-stock" placeholder="Catégorie / famille (saisie libre)" value={prodForm.famille} onChange={e => setProdForm({ ...prodForm, famille: e.target.value })} required style={{ padding: '8px' }} />
            <datalist id="suggestions-familles-stock">{FAMILLES_PRODUITS.map(f => <option key={f} value={f} />)}</datalist></>
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
            {products.filter(p => p.famille === selectedFamille).map(p => (
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
  );
}

export default Stock;
