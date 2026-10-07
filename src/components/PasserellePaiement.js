import React, { useState } from 'react';

/**
 * Passerelle de paiement à distance
 * Wave · Orange Money · MTN MoMo · Moov Money · Cartes bancaires
 * Génère un lien de paiement et un QR informatifs. La confirmation effective
 * doit toujours venir du serveur / webhook du prestataire.
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

export default function PasserellePaiement({ montant, operateurInitial = 'wave' }) {
  const [operateurActif, setOperateurActif] = useState(
    OPERATEURS.some(o => o.id === operateurInitial) ? operateurInitial : 'wave'
  );
  const operateur = OPERATEURS.find(o => o.id === operateurActif) || OPERATEURS[0];

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

      {/* Formulaire selon l'opérateur */}
      <p role="note" style={{ fontSize: '12px', color: '#475569' }}>
        {operateurActif === 'carte'
          ? 'Le paiement carte doit être traité par le widget sécurisé Kkiapay.'
          : 'Le paiement mobile doit être traité par l’application officielle de l’opérateur.'}
        {' '}Cette interface n’accepte ni numéro de carte, ni CVV, ni code secret et ne confirme pas les paiements.
      </p>
      <p role="status" style={{ fontSize: '12px', color: '#b45309' }}>
        Aucun paiement ne sera enregistré comme encaissé avant une confirmation serveur du prestataire.
      </p>
    </div>
  );
}