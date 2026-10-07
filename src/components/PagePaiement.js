import React, { useMemo, useState } from 'react';
import { verifierLienPaiement } from '../utils/signaturePaiement';
import PasserellePaiement from './PasserellePaiement';

/**
 * Page publique /paiement
 *
 * Cible des liens de paiement generes par le module Moyens de Paiement
 * (QR code, SMS, WhatsApp) et par le generateur de QR du tableau de bord.
 *
 * Elle s'affiche HORS session ERP : un client qui recoit le lien ne doit
 * jamais avoir besoin de se connecter. Elle est donc rendue par index.js
 * AVANT <App />, sur simple correspondance de window.location.pathname.
 */

const OPERATEURS_LABELS = {
  wave: { nom: 'Wave', couleur: '#0ea5e9', icon: '🌊' },
  orange: { nom: 'Orange Money', couleur: '#f97316', icon: '🟠' },
  moov: { nom: 'Moov Money', couleur: '#047857', icon: '🟢' },
  mtn: { nom: 'MTN Mobile Money', couleur: '#eab308', icon: '🟡' },
  carte: { nom: 'Cartes bancaires', couleur: '#0f172a', icon: '💳' }
};

const lireParams = () => {
  const params = new URLSearchParams(window.location.search);

  return {
    operateur: params.get('operateur') || params.get('o') || '',
    reference: params.get('reference') || params.get('r') || '',
    montant: params.get('montant') || params.get('m') || '',
    devise: params.get('devise') || 'XOF',
    expire: params.get('expire') || params.get('x') || '',
    signature: params.get('signature') || params.get('s') || ''
  };
};

export default function PagePaiement() {
  const params = useMemo(lireParams, []);

  const [paiement, setPaiement] = useState(null);
  const [erreur] = useState('');

  // Verifie la signature AVANT tout affichage de donnees de paiement.
  const controle = useMemo(
    () => verifierLienPaiement(params),
    [params]
  );

  const operateur = OPERATEURS_LABELS[params.operateur] || null;

  if (!controle.valide) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.carte, textAlign: 'center' }}>
          <div style={{ fontSize: '46px', marginBottom: '12px' }}>⛔</div>
          <h1 style={styles.titre}>Lien de paiement invalide</h1>
          <p style={styles.texte}>
            {controle.raison === 'expire'
              ? 'Ce lien de paiement a expiré. Demandez au commerçant un nouveau lien ou un nouveau QR Code.'
              : 'Ce lien de paiement a été modifié ou est incomplet. Vérifiez le lien reçu ou Scannez à nouveau le QR Code.'}
          </p>

          {controle.raison === 'signature' && (
            <p style={{ ...styles.texte, color: '#b91c1c', fontSize: '12px' }}>
              Le montant ou la référence de ce lien ne correspond pas à ceux émis par le commerçant.
            </p>
          )}

          <p style={{ ...styles.texte, fontSize: '11px', color: '#94a3b8' }}>
            Raison du rejet : <code>{controle.raison || 'inconnu'}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.carte}>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', color: '#64748b', letterSpacing: '1px' }}>
            {operateur ? operateur.icon : '💳'} {operateur ? operateur.nom : 'Paiement'}
          </div>
          <h1 style={{ ...styles.titre, marginBottom: '6px' }}>Régler votre paiement</h1>
          <div style={{ fontSize: '34px', fontWeight: 'bold', color: operateur ? operateur.couleur : '#0f172a' }}>
            {Number(params.montant).toLocaleString()} {params.devise}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Référence : <strong>{params.reference}</strong>
          </div>
        </div>

        {paiement ? (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '18px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <h2 style={{ margin: '0 0 6px', color: '#15803d', fontSize: '18px' }}>Paiement confirmé</h2>
            <p style={{ margin: 0, color: '#166534', fontSize: '13px' }}>
              Référence <strong>{paiement.reference}</strong> · {Number(paiement.montant).toLocaleString()} {params.devise}
            </p>
            <p style={{ margin: '10px 0 0', color: '#166534', fontSize: '12px' }}>
              Conservez cette page : elle fait foi de votre règlement.
            </p>
          </div>
        ) : (
          <>
            <PasserellePaiement
              montant={Number(params.montant)}
              operateurInitial={params.operateur}
              referenceInitiale={params.reference}
              onPaiementConfirme={reglement => {
                setPaiement(reglement);
                // Remonte l'evenement : le commerçant (fenetre opener) peut l'ecouter
                if (window.opener && !window.opener.closed) {
                  try {
                    window.opener.postMessage(
                      { type: 'SKYS_PAIEMENT_CONFIRME', ...reglement },
                      window.location.origin
                    );
                  } catch (error) {
                    /* cross-origin : ignore */
                  }
                }
              }}
            />

            {erreur && (
              <p style={{ color: '#b91c1c', fontSize: '12px', marginTop: '10px', textAlign: 'center' }}>{erreur}</p>
            )}
          </>
        )}

        <p style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', marginTop: '16px' }}>
          SKYS ERP Solution · Lien valable {Math.max(0, Math.round((controle.expire - Date.now()) / 60000))} minute(s).
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0284c7 100%)',
    padding: '20px',
    fontFamily: "'Segoe UI', system-ui, sans-serif"
  },
  carte: {
    backgroundColor: '#fff',
    padding: '28px 22px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '460px',
    boxShadow: '0 20px 45px rgba(0,0,0,0.35)'
  },
  titre: {
    fontSize: '20px',
    color: '#0f172a',
    fontWeight: 'bold',
    margin: '0 0 8px'
  },
  texte: {
    color: '#475569',
    fontSize: '13px',
    lineHeight: '1.6',
    margin: '0 0 6px'
  }
};