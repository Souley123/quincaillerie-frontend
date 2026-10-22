import React from 'react';
import ScannerHtml5 from '../components/ScannerHtml5';
import { Icone } from '../components/Icones';
import { estApplicationNative } from '../services/dialogues';
import { construireMentionsLegales } from '../services/mentionsLegales';

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
  ajouterArticleCatalogueSelectionne,
  ajouterAuPanier,
  reduireQuantitePanier,
  retirerDuPanier,
  validerTransaction,
  lancerPaiementKkiapay,
  imprimerRecuFacture
}) {
  const [heureCourante, setHeureCourante] = React.useState(() => new Date());
  const catalogueSelectionneRef = React.useRef('');
  const ajouterArticleSelectionne = () => {
    if (typeof ajouterArticleCatalogueSelectionne === 'function') {
      const idAvantAjout = String(catalogueSelectionneRef.current || selectedPosCatalogItem || '');
      const resultat = ajouterArticleCatalogueSelectionne(idAvantAjout);
      if (resultat) catalogueSelectionneRef.current = idAvantAjout;
      return;
    }
    const id = String(catalogueSelectionneRef.current || selectedPosCatalogItem || '');
    const produit = products.find(article => String(article._id || article.id || '') === id);
    if (produit && typeof ajouterAuPanier === 'function') ajouterAuPanier(produit);
  };
  const reduireArticleSelectionne = () => {
    if (typeof reduireQuantitePanier === 'function') reduireQuantitePanier(selectedPosCatalogItem || undefined);
  };

  React.useEffect(() => {
    const intervalle = window.setInterval(() => setHeureCourante(new Date()), 60000);
    return () => window.clearInterval(intervalle);
  }, []);

  React.useEffect(() => {
    scannerInputRef.current?.focus();
  }, [scannerInputRef]);

  return (
    <div className="caisse-module pos-main-container">
      <div className="pos-header-card no-print">
        <div className="pos-title-area">
          <h2 className="pos-main-title">{t.transaction}</h2>
          <p className="pos-main-subtitle">Encaissement rapide et gestion du panier en temps réel</p>
        </div>
      </div>

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

      {/* Barre de scan PLEINE LARGEUR, au-dessus des deux colonnes.
          C'est sa place sur la maquette : le champ occupe le maximum de
          largeur, la caméra et le bouton restent groupés à droite. */}
      <section className="pos-scan-card no-print" onSubmit={event => event.preventDefault()}>
        <div className="pos-scan-ligne">
          <input
            className="pos-input-field"
            id="saisie-manuelle-code"
            ref={scannerInputRef}
            type="text"
            aria-label="Douchette USB ou saisie manuelle"
            placeholder="Saisir ou scanner un code-barres…"
            value={barcodeInput}
            onChange={e => { barcodeInputRef.current = e.target.value; setBarcodeInput(e.target.value); }}
            onKeyDown={traiterEntreeDouchette}
          />
          <button
            type="button"
            className="pos-btn-camera"
            onClick={() => setCameraOpen(true)}
            title="Ouvrir la caméra pour scanner"
            aria-label="Ouvrir la caméra pour scanner"
          >
            <Icone nom="camera" taille={22} />
          </button>
          <button
            type="button"
            className="pos-btn-scan-ajouter"
            onClick={() => handleBarcodeScan({ preventDefault() {} })}
            disabled={!barcodeInput.trim()}
            title={barcodeInput.trim() ? 'Rechercher le code puis ajouter l’article trouvé au panier' : 'Saisissez ou scannez d’abord un code-barres'}
          >
            Ajouter au panier
          </button>
        </div>
      </section>

      {/* Caméra : affichée AVANT le catalogue, donc au-dessus des deux colonnes. */}
      {cameraOpen && (
        <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          {cameraError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 10px' }}>{cameraError}</p>}
          <ScannerHtml5
            onScan={code => {
              // Après une lecture, on ferme la caméra même si le code n'existe
              // pas : la saisie du code reste alors disponible pour compléter la fiche.
              traiterCodeScanne(code, { ajouter: true });
              setCameraOpen(false);
            }}
            onError={setCameraError}
            onStop={() => {
              setCameraOpen(false);
              setCameraError('');
            }}
          />
        </div>
      )}

      <div className="pos-grid-layout no-print">
        {/* Colonne GAUCHE : catalogue. */}
        <div className="pos-left-column">
          <section className="pos-card">
            <h3 className="pos-card-titre-simple">Articles du catalogue</h3>
            <select
              className="pos-select-field"
              id="catalogSelect"
              aria-label="Sélectionner un article"
              value={selectedPosCatalogItem}
              onChange={e => {
                catalogueSelectionneRef.current = e.target.value;
                setSelectedPosCatalogItem(e.target.value);
              }}
            >
              <option value="">-- Sélectionner un article --</option>
              {products.length === 0 && <option value="" disabled>Aucun article dans le catalogue</option>}
              {products.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.nom} (Stock: {p.quantiteStock})</option>)}
            </select>
            <div className="pos-action-buttons-row">
              <button type="button" className="pos-btn-primary" disabled={!products.length || !(catalogueSelectionneRef.current || selectedPosCatalogItem)} onClick={ajouterArticleSelectionne}>Ajouter au panier</button>
              <button type="button" className="pos-btn-warning" disabled={!panier.length} onClick={reduireArticleSelectionne}><Icone nom="retirer" taille={16} /> Réduire</button>
            </div>
          </section>
        </div>

        {/* Colonne DROITE : panier actuel. */}
        <div className="pos-right-column">
          <section className="pos-card pos-cart-card">
            <h3 className="pos-card-titre-simple">Panier Actuel</h3>
            {panier.length === 0 ? (
              <div className="pos-panier-vide">
                <span className="pos-panier-vide-icone" aria-hidden="true"><Icone nom="commander" taille={26} /></span>
                <p className="pos-panier-vide-titre">Votre panier est vide.</p>
                <p className="pos-panier-vide-texte">{products.length ? 'Choisissez un article à gauche, puis « Ajouter au panier ».' : 'Aucun article n’est renseigné. Ajoutez d’abord des articles dans le module Catalogue.'}</p>
              </div>
            ) : (
              <div className="pos-cart-content">
                <div className="caisse-table-defile">
                  <table className="caisse-table-panier">
                    <thead><tr><th>Article</th><th>Nombre</th><th>Montant</th><th>Action</th></tr></thead>
                    <tbody>{panier.map(item => <tr key={item._id}>
                      <td>{item.nom}</td><td>{item.qteVente}</td>
                      <td>{(item.prix * item.qteVente).toLocaleString()} FCFA</td>
                      <td><button type="button" onClick={() => retirerDuPanier(item._id)} title="Retirer l'article" aria-label={`Retirer ${item.nom}`}><Icone nom="retirer" taille={13} /></button></td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <div className="pos-cart-footer">
                  <div className="pos-cart-total"><span>Total :</span><span>{totalPanier.toLocaleString()} FCFA</span></div>
                  <label className="pos-payment-label" htmlFor="paiement-panier">Moyen de paiement</label>
                  <select id="paiement-panier" value={selectedPaymentMethod} onChange={e => setSelectedPaymentMethod(e.target.value)}>
                    {MOYENS_PAIEMENT.map(moyen => <option key={moyen} value={moyen}>{moyen}</option>)}
                  </select>
                  <p className="pos-payment-note">Mode de règlement enregistré sur le reçu : <strong>{selectedPaymentMethod}</strong></p>
                  <div className="pos-checkout-actions">
                    <button type="button" className="pos-btn-success" onClick={validerTransaction}>Valider le paiement</button>
                    <button type="button" className="pos-btn-payment" onClick={lancerPaiementKkiapay}><Icone nom="paiements" taille={15} /> Payer — {selectedPaymentMethod}</button>
                    <button type="button" className="pos-btn-print" onClick={imprimerRecuFacture} title={estApplicationNative() ? 'Impression disponible sur ordinateur' : 'Imprimer le reçu'}>{t.printReceipt}</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

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

    </div>
  );
}

export default Caisse;
