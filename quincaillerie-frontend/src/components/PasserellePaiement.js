import React, { useState } from 'react';
import { verifierPaiementApi } from '../services/api';

/**
 * Passerelle de paiement à distance
 * Wave · Orange Money · MTN MoMo · Moov Money · Cartes bancaires
 * Affiche les instructions de paiement et VÉRIFIE la confirmation auprès du
 * serveur (Kkiapay). La confirmation n'est jamais décidée côté navigateur :
 * seul le serveur peut marquer un paiement comme encaissé.
 */
const OPERATEURS = [
  { id: 'wave', nom: 'Wave', couleur: '#0ea5e9', numero: '*770 #montant', icon: '🌊' },
  { id: 'orange', nom: 'Orange Money', couleur: '#f97316', numero: '#144#', compte: 'Orange Money', icon: '🟠' },
  { id: 'mtn', nom: 'MTN MoMo', couleur: '#eab308', numero: '*133#', compte: 'MTN Mobile Money', icon: '🟡' },
  { id: 'moov', nom: 'Moov Money', couleur: '#047857', numero: '*155#', compte: 'Moov Money', icon: '🟢' },
  { id: 'carte', nom: 'Cartes bancaires', couleur: '#0f172a', numero: 'Visa · Mastercard · Amex', compte: 'TPE / Terminal', icon: '💳' }
];

function CarteOperateur({ operateur, actif, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(operateur)}
      style={{
        padding: '10px',
        borderRadius: '8px',
        border: '2px solid ' + (actif ? operateur.couleur : '#e2e8f0'),
        backgroundColor: actif ? operateur.couleur : '#fff',
        color: actif ? '#fff' : '#0f172a',
        cursor: 'pointer',
        boxShadow: actif ? `0 4px 12px ${operateur.couleur}55` : '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      <div style={{ fontSize: '18px' }}>{operateur.icon}</div>
      <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2px' }}>{operateur.nom}</div>
      <div style={{ fontSize: '9px', opacity: 0.8 }}>{operateur.compte}</div>
    </button>
  );
}

export default function PasserellePaiement({ montant, operateurInitial = 'wave', referenceInitiale = '', onPaiementConfirme }) {
  const [operateurActif, setOperateurActif] = useState(
    OPERATEURS.some(o => o.id === operateurInitial) ? operateurInitial : 'wave'
  );
  const [reference, setReference] = useState(referenceInitiale || '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const operateur = OPERATEURS.find(o => o.id === operateurActif) || OPERATEURS[0];

  /* Vérifie la transaction auprès du serveur, qui interroge Kkiapay.
     Le montant et la référence ne sont jamais crus sur parole : le serveur
     les compare à sa propre référence avant d'enregistrer le paiement. */
  const verifier = async () => {
    const ref = reference.trim();
    if (!ref) {
      setErreur('Saisissez la référence de transaction renvoyée par le prestataire.');
      return;
    }
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await verifierPaiementApi(ref, 'vente');
      if (resultat?.transaction) {
        onPaiementConfirme?.(resultat.transaction);
      } else {
        setErreur('Paiement non confirmé par le prestataire.');
      }
    } catch (err) {
      setErreur(err.response?.data?.error || 'Vérification du paiement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div>
      {/* Sélecteur d'opérateur */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '7px', marginBottom: '14px' }}>
        {OPERATEURS.map(o => (
          <CarteOperateur key={o.id} operateur={o} actif={operateurActif === o.id} onSelect={selection => setOperateurActif(selection.id)} />
        ))}
      </div>

      {/* Montant */}
      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '11px 13px', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', color: '#64748b' }}>Montant à encaisser</span>
        <div style={{ fontSize: '26px', fontWeight: 'bold', color: operateur.couleur }}>{Number(montant || 0).toLocaleString()} FCFA</div>
      </div>

      {/* Instructions selon l'opérateur */}
      <p role="note" style={{ fontSize: '12px', color: '#475569' }}>
        {operateurActif === 'carte'
          ? 'Payez via le widget sécurisé Kkiapay, puis saisissez ci-dessous la référence de transaction.'
          : `Payez depuis l’application ${operateur.nom}, puis saisissez ci-dessous la référence de transaction.`}
        {' '}Cette interface n’accepte ni numéro de carte, ni CVV, ni code secret.
      </p>

      {/* Vérification serveur */}
      <label style={{ display: 'block', fontSize: '12px', color: '#334155', marginTop: '10px' }}>
        Référence de transaction
        <input
          type="text"
          value={reference}
          onChange={e => setReference(e.target.value)}
          placeholder="ex. TX-123456789"
          maxLength={128}
          style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
        />
      </label>
      {erreur && <p role="alert" style={{ color: '#b91c1c', fontSize: '12px', margin: '8px 0 0' }}>{erreur}</p>}
      <button
        type="button"
        onClick={verifier}
        disabled={enCours}
        style={{ marginTop: '12px', width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: enCours ? '#94a3b8' : '#0284c7', color: '#fff', fontWeight: 'bold', cursor: enCours ? 'not-allowed' : 'pointer' }}
      >
        {enCours ? 'Vérification…' : 'Vérifier le paiement'}
      </button>
      <p role="status" style={{ fontSize: '12px', color: '#b45309', marginTop: '8px' }}>
        Aucun paiement n’est enregistré comme encaissé avant la confirmation du serveur.
      </p>
    </div>
  );
}