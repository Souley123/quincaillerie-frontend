import React from 'react';
import ScannerHtml5 from '../components/ScannerHtml5';
import { Icone } from '../components/Icones';
import { construireMentionsLegales } from '../services/mentionsLegales';
import { estApplicationNative } from '../services/dialogues';

/* Module « Caisse & Transactions » — extrait de App.js.
   Composant présentationnel : l'état, les handlers et la persistance
   restent dans App et sont transmis via props. */
function Caisse({
  t,
  headerConfig,
  recuConfig,
  storeInfo,
  selectedClientTx,
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  MOYENS_PAIEMENT,
  panier,
  totalPanier,
  handleBarcodeScan,
  scannerInputRef,
  barcodeInput,
  barcodeInputRef,
  setBarcodeInput,
  traiterEntreeDouchette,
  setCameraOpen,
  cameraOpen,
  cameraError,
  setCameraError,
  traiterCodeScanne,
  scanResult,
  preparerArticleDepuisCode,
  products,
  selectedPosCatalogItem,
  setSelectedPosCatalogItem,
  ajouterAuPanier,
  reduireQuantitePanier,
  retirerDuPanier,
  validerTransaction,
  lancerPaiementKkiapay,
  imprimerRecuFacture
}) {
  return (
    <div className="caisse-module">
      <h2 className="no-print caisse-titre" style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.transaction}</h2>

      {/* Reçu professionnel : visible uniquement à l'impression. */}
      <div className="print-only" style={{ color: '#0f172a', padding: '10px 0' }}>
        <div style={{ borderBottom: `3px solid ${recuConfig.couleur || '#0f172a'}`, paddingBottom: '10px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', color: recuConfig.couleur || '#0f172a' }}>{storeInfo.nomMagasin}</h1>
            <p style={{ margin: '2px 0 0', fontSize: '11px' }}>{storeInfo.motto}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px' }}>
            {recuConfig.afficherContact && <p style={{ margin: 0 }}>{storeInfo.adresse}</p>}
            {recuConfig.afficherContact && <p style={{ margin: 0 }}>Tél : {storeInfo.telephone} · {storeInfo.email}</p>}
            {recuConfig.afficherRccm && <p style={{ margin: 0 }}>RCCM : {storeInfo.rccm}</p>}
          </div>
        </div>
        <h2 style={{ textAlign: 'center', fontSize: '15px', letterSpacing: '2px', margin: '0 0 10px', color: recuConfig.couleur || '#0f172a' }}>REÇU / FACTURE</h2>
        <p style={{ fontSize: '11px', margin: '0 0 8px' }}>
          Date : <strong>{new Date().toLocaleString('fr-FR')}</strong>
          {selectedClientTx ? ` · Client : ${selectedClientTx}` : ''}
          {' · '}Règlement : <strong>{selectedPaymentMethod}</strong>
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: recuConfig.couleur || '#0f172a', color: '#fff' }}>
              <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'left' }}>Article</th>
              <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'center', width: '60px' }}>Qté</th>
              <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'right', width: '100px' }}>Prix unit.</th>
              <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'right', width: '110px' }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {panier.map(item => (
              <tr key={item._id}>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{item.nom}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>{item.qteVente}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right' }}>{Number(item.prix).toLocaleString()} FCFA</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{(item.prix * item.qteVente).toLocaleString()} FCFA</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3" style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: recuConfig.couleur || '#0f172a' }}>{totalPanier.toLocaleString()} FCFA</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ marginTop: '14px', fontSize: '11px', textAlign: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{recuConfig.piedDePage}</p>
          {recuConfig.mentionLegale && <p style={{ margin: '4px 0 0', color: '#475569' }}>{recuConfig.mentionLegale}</p>}
        </div>
        {/* Mentions légales obligatoires — réglementation ivoirienne */}
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '9.5px', color: '#475569', textAlign: 'center', lineHeight: '1.5' }}>
          {construireMentionsLegales(storeInfo).map((ligne, i) => (
            <p key={i} style={{ margin: '2px 0' }}>{ligne}</p>
          ))}
        </div>
      </div>

      <form className="no-print scan-bar" onSubmit={handleBarcodeScan} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          title="Ouvrir la caméra pour scanner"
          style={{ padding: '10px 12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '18px' }}
        >
          <Icone nom="camera" taille={18} />
        </button>
        <input id="saisie-manuelle-code" ref={scannerInputRef} type="text" placeholder="Douchette USB ou saisie manuelle : référence / code-barres / QR..." value={barcodeInput} onChange={e => { barcodeInputRef.current = e.target.value; setBarcodeInput(e.target.value); }} onKeyDown={traiterEntreeDouchette} style={{ flex: '1 1 200px', minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
        <button type="submit" style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter au panier</button>
      </form>

      {scanResult && (
        <div style={{ backgroundColor: scanResult.trouvé ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (scanResult.trouvé ? '#bbf7d0' : '#fecaca'), borderRadius: '8px', padding: '9px 12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex' }}>{scanResult.trouvé ? <Icone nom="succes" taille={16} couleur="#16a34a" /> : <Icone nom="fermer" taille={16} couleur="#dc2626" />}</span>
          <span style={{ fontSize: '12px', color: '#334155' }}>Code <strong>{scanResult.code}</strong> :</span>
          {scanResult.trouvé ? (
            <span style={{ fontSize: '12px', color: '#166534' }}>
              <strong>{scanResult.produit.nom}</strong> — Prix auto : <strong>{Number(scanResult.produit.prix).toLocaleString()} FCFA</strong> (stock : {scanResult.produit.quantiteStock})
            </span>
          ) : (
            <>
              <span style={{ fontSize: '12px', color: '#991b1b' }}>inconnu — ajoutez-le au catalogue ou saisissez la référence manuellement.</span>
              <button
                type="button"
                onClick={() => preparerArticleDepuisCode(scanResult.code)}
                style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer' }}
              >
                ＋ Créer cet article au catalogue
              </button>
            </>
          )}
        </div>
      )}

      {cameraOpen && (
        <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          {cameraError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 10px' }}>{cameraError}</p>}
          <ScannerHtml5
            onScan={code => {
              // 1 seule lecture par ouverture : on ferme des la premiere detection
              if (traiterCodeScanne(code, { ajouter: true })) {
                setCameraOpen(false);
              }
            }}
            onError={setCameraError}
            onStop={() => {
              setCameraOpen(false);
              setCameraError('');
            }}
          />
        </div>
      )}

      <div className="caisse-grille" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', minWidth: 0 }}>
          <h3>Articles du catalogue</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            <select value={selectedPosCatalogItem} onChange={e => setSelectedPosCatalogItem(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="">-- Sélectionner un article --</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.nom} (Stock: {p.quantiteStock})</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { const prod = products.find(p => p._id === selectedPosCatalogItem); if(prod) ajouterAuPanier(prod); }} style={{ flex: 1, backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter au panier</button>
              <button onClick={() => { const prod = products.find(p => p._id === selectedPosCatalogItem); reduireQuantitePanier(prod); }} title="Réduire d'une unité" style={{ flex: 1, backgroundColor: '#eab308', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Icone nom="retirer" taille={14} /> Réduire</button>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', minWidth: 0 }}>
          <h3>Panier Actuel</h3>
          {panier.length === 0 ? <p style={{ color: '#64748b' }}>Panier vide.</p> : (
            <div style={{ minWidth: 0 }}>
              {/* Défilement DANS le tableau : sur 320 px, quatre colonnes ne
                  tiennent pas. Le cadre ne dépasse jamais la carte. */}
              <div className="caisse-table-defile">
                <table className="caisse-table-panier" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Article</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '70px' }}>Nombre</th>
                    <th style={{ padding: '8px', textAlign: 'right', width: '120px' }}>Montant</th>
                    <th style={{ padding: '8px', width: '70px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {panier.map(item => (
                    <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{item.nom}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{item.qteVente}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>{(item.prix * item.qteVente).toLocaleString()} FCFA</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <button onClick={() => retirerDuPanier(item._id)} title="Retirer l'article" style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><Icone nom="retirer" taille={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <h3 className="caisse-total" style={{ marginTop: '15px', textAlign: 'right', color: '#0f172a' }}>Total : {totalPanier.toLocaleString()} FCFA</h3>
              {/* Liste déroulante classique et professionnelle des moyens de paiement */}
              <div style={{ marginTop: '10px' }}>
                <label htmlFor="paiement-panier" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                  Moyen de paiement
                </label>
                <select
                  id="paiement-panier"
                  value={selectedPaymentMethod}
                  onChange={e => setSelectedPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                >
                  {MOYENS_PAIEMENT.map(moyen => <option key={moyen} value={moyen}>{moyen}</option>)}
                </select>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>Mode de règlement enregistré sur le reçu : <strong>{selectedPaymentMethod}</strong></p>
              </div>
              <div className="caisse-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button onClick={validerTransaction} style={{ flex: '1 1 160px', backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Valider et Encaisser</button>
                <button type="button" onClick={lancerPaiementKkiapay} style={{ flex: '1 1 160px', backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                <Icone nom="paiements" taille={15} /> Payer — {selectedPaymentMethod}
                </button>
                <button onClick={imprimerRecuFacture} title={estApplicationNative() ? 'Impression disponible sur ordinateur' : 'Imprimer le reçu'} style={{ flex: '1 1 140px', backgroundColor: '#475569', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{t.printReceipt}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Caisse;
