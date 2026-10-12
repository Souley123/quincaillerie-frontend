import React from 'react';
import { REGIONS_VILLES_CI as REGIONS_VILLES } from '../data/villes-ci';
import { Icone } from '../components/Icones';

/* Module « Clients & Contacts » — extrait de App.js.
   Composant purement présentationnel : toute la logique (état, handlers,
   persistance) reste dans App et lui est transmise via les props. */
function Clients({
  t,
  headerConfig,
  clients,
  clientForm,
  setClientForm,
  editingClientId,
  setEditingClientId,
  CLIENT_INITIAL,
  handleClientSubmit,
  handleEditClient,
  handleDeleteClient
}) {
  return (
    <div>
      <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.clients}</h2>
      <form onSubmit={handleClientSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0284c7', marginTop: 0 }}>{editingClientId ? "Modifier le client" : "Ajouter un client"}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="Nom / Raison Sociale" value={clientForm.nom} onChange={e => setClientForm({ ...clientForm, nom: e.target.value })} required style={{ padding: '8px' }} />
          <input type="email" placeholder="Email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} required style={{ padding: '8px' }} />
          <input type="text" placeholder="Téléphone" value={clientForm.telephone} onChange={e => setClientForm({ ...clientForm, telephone: e.target.value })} required style={{ padding: '8px' }} />
          <select value={clientForm.region} onChange={e => setClientForm({ ...clientForm, region: e.target.value, ville: REGIONS_VILLES[e.target.value]?.[0] || '' })} style={{ padding: '8px' }}>
            {Object.keys(REGIONS_VILLES).sort((a, b) => a.localeCompare(b, 'fr')).map(reg => <option key={reg} value={reg}>{reg}</option>)}
          </select>
          <select value={clientForm.ville} onChange={e => setClientForm({ ...clientForm, ville: e.target.value })} required aria-label="Ville du client" style={{ padding: '8px' }}>
            {(REGIONS_VILLES[clientForm.region] || []).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{editingClientId ? t.save : t.add}</button>
          {editingClientId && <button type="button" onClick={() => { setEditingClientId(null); setClientForm(CLIENT_INITIAL); }} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>{t.cancel}</button>}
        </div>
      </form>

      <div className="clients-table-scroll" style={{ backgroundColor: '#fff', borderRadius: '12px', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 6px 20px rgba(15,23,42,0.07)' }}>
        <table className="clients-table" style={{ width: '100%', minWidth: '1060px', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left', fontSize: '14px' }}>
          <colgroup>
            <col style={{ width: '19%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '19%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
              <th style={{ padding: '15px 16px' }}>Nom / Entreprise</th>
              <th style={{ padding: '15px 16px' }}>Email</th>
              <th style={{ padding: '15px 16px' }}>Téléphone</th>
              <th style={{ padding: '15px 16px' }}>Région / Ville</th>
              <th style={{ padding: '15px 16px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c._id || c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '16px', fontWeight: '700', color: '#0f172a', overflowWrap: 'break-word' }}>{c.nom}</td>
                <td style={{ padding: '16px', color: '#334155', overflowWrap: 'break-word' }}>{c.email}</td>
                <td style={{ padding: '16px', color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{c.telephone}</td>
                <td style={{ padding: '16px', color: '#334155', overflowWrap: 'break-word' }}>{[c.region, c.ville].filter(Boolean).join(' — ') || '—'}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div className="clients-table-actions">
                    <button type="button" onClick={() => handleEditClient(c)} className="clients-action-button clients-action-button--edit" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="notes" taille={13} /> {t.edit}</button>
                    <button type="button" onClick={() => handleDeleteClient(c._id || c.id)} className="clients-action-button clients-action-button--delete" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="retirer" taille={13} /> {t.delete}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Clients;
