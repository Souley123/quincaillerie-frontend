import React, { useState } from 'react';

/**
 * Passerelle de paiement à distance
 * Wave · Orange Money · MTN MoMo · Moov Money · Cartes bancaires
 * Génère un lien de paiement + QR Code, avec simulation de confirmation.
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
    <div
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
    </div>
  );
}

export default function PasserellePaiement({
  montant,
  onPaiementConfirme,
  operateurInitial = 'wave',
  referenceInitiale = ''
}) {
  const [operateurActif, setOperateurActif] = useState(
    OPERATEURS.some(o => o.id === operateurInitial) ? operateurInitial : 'wave'
  );
  const [reference, setReference] = useState('');
  const [lien, setLien] = useState('');
  const [urlQr, setUrlQr] = useState('');
  const [statut, setStatut] = useState('en_attente');
  const [form, setForm] = useState({ telephone: '', carte: '', expiration: '', cvv: '', nomCarte: '' });

  // Garde-fou : ne jamais dereferencer un operateur inconnu (liste filtree plus haut)
  const operateur = OPERATEURS.find(o => o.id === operateurActif) || OPERATEURS[0];

  const genererLien = () => {
    const ref = referenceInitiale || ('PAY-' + Math.floor(100000 + Math.random() * 900000));
    const url = `${window.location.origin}/paiement?o=${operateurActif}&r=${encodeURIComponent(ref)}&m=${montant}&devise=XOF`;
    setReference(ref);
    setLien(url);
    setUrlQr(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`);
    setStatut('en_attente');
  };

  const confirmer = () => {
    setStatut('paye');
    if (onPaiementConfirme) {
      onPaiementConfirme({ operateur: operateurActif, reference: reference || referenceInitiale, montant });
    }
  };

  return (
    <div>
      {/* Sélecteur d'opérateur */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '7px', marginBottom: '14px' }}>
        {OPERATEURS.map(o => (
          <CarteOperateur key={o.id} operateur={o} actif={operateurActif === o.id} onSelect={id => { setOperateurActif(id); setReference(''); setLien(''); setStatut('en_attente'); }} />
        ))}
      </div>

      {/* Montant */}
      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '11px 13px', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', color: '#64748b' }}>Montant à encaisser</span>
        <div style={{ fontSize: '26px', fontWeight: 'bold', color: operateur.couleur }}>{Number(montant || 0).toLocaleString()} FCFA</div>
      </div>

      {/* Formulaire selon l'opérateur */}
      {operateurActif === 'carte' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Numéro de carte"
            inputMode="numeric"
            value={form.carte}
            onChange={e => setForm({ ...form, carte: e.target.value.replace(/\s/g, '').slice(0, 19) })}
            style={{ gridColumn: '1 / -1', padding: '9px 10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1', letterSpacing: '1px' }}
          />
          <input type="text" placeholder="MM/AA" value={form.expiration} onChange={e => setForm({ ...form, expiration: e.target.value.slice(0, 5) })} style={{ padding: '9px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          <input type="password" placeholder="CVV" maxLength="4" value={form.cvv} onChange={e => setForm({ ...form, cvv: e.target.value.replace(/\D/g, '') })} style={{ padding: '9px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          <input type="text" placeholder="Nom sur la carte" value={form.nomCarte} onChange={e => setForm({ ...form, nomCarte: e.target.value })} style={{ gridColumn: '1 / -1', padding: '9px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
        </div>
      ) : (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '3px' }}>Numéro de téléphone</label>
          <input
            type="tel"
            placeholder="+225 07 00 00 00 00"
            value={form.telephone}
            onChange={e => setForm({ ...form, telephone: e.target.value })}
            style={{ width: '100%', padding: '9px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />
          <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#64748b' }}>
            USSD {operateur.id === 'wave' ? '*770*' : operateur.id === 'mtn' ? '*133*' : operateur.id === 'moov' ? '*155*' : '#144#'} — puis validez le paiement sur votre téléphone.
          </p>
        </div>
      )}

      {/* Lien + QR */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button type="button" onClick={genererLien} style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 'bold', backgroundColor: operateur.couleur, color: operateurActif === 'mtn' ? '#111' : '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Générer le lien de paiement
        </button>
        <button type="button" onClick={confirmer} style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          J'ai payé
        </button>
        <button type="button" onClick={confirmer} disabled={statut === 'paye'} style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 'bold', backgroundColor: statut === 'paye' ? '#16a34a' : '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: statut === 'paye' ? 'default' : 'pointer' }}>
          {statut === 'paye' ? '✓ Payé' : "Simuler la confirmation"}
        </button>
      </div>

      {lien && (
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', flexWrap: 'wrap' }}>
          <img src={urlQr} alt="QR Code paiement" style={{ width: '130px', height: '130px', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: '0 0 5px', fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
              {operateur.icon} {operateur.nom} — Référence {reference}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: '11px', color: statut === 'paye' ? '#16a34a' : '#b45309', fontWeight: 'bold' }}>
              {statut === 'paye' ? '✓ Paiement confirmé' : 'En attente de confirmation'}
            </p>
            <a href={lien} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0284c7', wordBreak: 'break-all' }}>{lien}</a>
          </div>
        </div>
      )}
    </div>
  );
}