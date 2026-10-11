import React from 'react';
import { annoncer as annoncerA11y } from '../services/accessibilite';

/* Module « Rapports & Indicateurs KPI » — extrait de App.js.
   Composant présentationnel : les données calculées et les handlers
   restent dans App et sont transmis via props. */
function Rapports({
  t,
  headerConfig,
  reportPeriod,
  setReportPeriod,
  exporterRapportCsv,
  caTotalEstime,
  chargesPeriode,
  beneficeNet,
  totalValeurStock,
  products,
  resumeAutomatique,
  prefsA11y
}) {
  return (
    <div>
      <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.reports}</h2>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setReportPeriod('mensuel')} style={{ padding: '4px 11px', fontSize: '12px', backgroundColor: reportPeriod === 'mensuel' ? '#0284c7' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Mensuel</button>
        <button onClick={() => setReportPeriod('trimestriel')} style={{ padding: '4px 11px', fontSize: '12px', backgroundColor: reportPeriod === 'trimestriel' ? '#0284c7' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Trimestriel</button>
        <button onClick={() => setReportPeriod('annuel')} style={{ padding: '4px 11px', fontSize: '12px', backgroundColor: reportPeriod === 'annuel' ? '#0284c7' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Annuel</button>
        <button onClick={exporterRapportCsv} style={{ padding: '4px 11px', fontSize: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Exporter CSV</button>
      </div>
      <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '13px' }}>Rapport Financier Synthétique ({reportPeriod.toUpperCase()})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '6px' }}>
          <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f0f9ff', border: '1px solid #e0f2fe' }}>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Chiffre d'affaires enregistré</span>
            <strong style={{ fontSize: '13px', color: '#0284c7' }}>{caTotalEstime.toLocaleString()} FCFA</strong>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2' }}>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Charges d'exploitation</span>
            <strong style={{ fontSize: '13px', color: '#ef4444' }}>{chargesPeriode.toLocaleString()} FCFA</strong>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7' }}>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Bénéfice net</span>
            <strong style={{ fontSize: '13px', color: '#16a34a' }}>{beneficeNet.toLocaleString()} FCFA</strong>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#fefce8', border: '1px solid #fef9c3' }}>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Marge nette</span>
            <strong style={{ fontSize: '13px', color: '#ca8a04' }}>{caTotalEstime > 0 ? ((beneficeNet / caTotalEstime) * 100).toFixed(1) : '0.0'} %</strong>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f5f3ff', border: '1px solid #ede9fe' }}>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Articles en stock bas</span>
            <strong style={{ fontSize: '13px', color: '#7c3aed' }}>{products.filter(p => Number(p.quantiteStock) <= Number(p.minStock)).length}</strong>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Valeur du stock</span>
            <strong style={{ fontSize: '13px', color: '#334155' }}>{totalValeurStock.toLocaleString()} FCFA</strong>
          </div>
        </div>
      </div>

      {/* Résumé automatique : analyse les données réelles et propose
          des recommandations concrètes. */}
      <div
        aria-live="polite"
        style={{ backgroundColor: '#fff', padding: '14px 16px', borderRadius: '8px', marginTop: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #0284c7' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, color: '#0284c7', fontSize: '14px' }}>🧠 Résumé automatique</h3>
          <button
            type="button"
            onClick={() => annoncerA11y(resumeAutomatique, { priorite: 'polite', parler: prefsA11y.annoncesVocales })}
            style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '5px 11px', fontSize: '11px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
            title="Lire le résumé à voix haute"
          >
            🔊 Lire le résumé
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.7', color: '#334155' }}>
          {resumeAutomatique}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#94a3b8' }}>
          Analyse générée automatiquement à partir de vos ventes, dépenses, achats et stocks — période {reportPeriod}. Mise à jour en temps réel.
        </p>
      </div>
    </div>
  );
}

export default Rapports;
