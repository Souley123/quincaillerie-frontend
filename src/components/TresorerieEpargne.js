import React, { useMemo, useState } from 'react';

/**
 * Module Exclusif — Tresorerie & Epargne Personnelle
 * - Depenses personnelles dissociees de la tresorerie de l'entreprise
 * - Capacite d'epargne saine : ne jamais puiser dans la caisse de l'entreprise
 * - Alerte de seuil critique : verrouillage visuel des prelevements
 * - Suivi mensuel et par categorie
 */
export default function TresorerieEpargne({
  tresorerieEntreprise = 0,
  depensesPersonnelles = [],
  seuilCritique = 100000,
  epargneCible = 500000,
  onAjouterDepense,
  onDefinirSeuil,
  onDefinirEpargneCible
}) {
  const [form, setForm] = useState({ libelle: '', montant: '', categorie: 'Retrait personnel', date: new Date().toISOString().slice(0, 10) });

  const totalDepenses = useMemo(
    () => depensesPersonnelles.reduce((total, d) => total + Number(d.montant || 0), 0),
    [depensesPersonnelles]
  );

  // Epargne disponible = tresorerie reelle - depenses personnelles - seuil de securite
  const epargneDisponible = Math.max(0, tresorerieEntreprise - totalDepenses - seuilCritique);

  const parMois = useMemo(() => {
    const map = {};
    depensesPersonnelles.forEach(d => {
      const mois = (d.date || '').slice(0, 7) || 'inconnu';
      map[mois] = (map[mois] || 0) + Number(d.montant || 0);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [depensesPersonnelles]);

  const parCategorie = useMemo(() => {
    const map = {};
    depensesPersonnelles.forEach(d => {
      const cat = d.categorie || 'Autre';
      map[cat] = (map[cat] || 0) + Number(d.montant || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [depensesPersonnelles]);

  const seuilAtteint = tresorerieEntreprise <= seuilCritique;
  const progressionEpargne = epargneCible > 0 ? Math.min(100, Math.round((epargneDisponible / epargneCible) * 100)) : 100;

  const soumettre = e => {
    e.preventDefault();
    if (!form.libelle || Number(form.montant) <= 0) return;

    const montant = Number(form.montant);

    // Verrouillage : on refuse de depasser la capacite d'epargne disponible
    if (montant > epargneDisponible) {
      alert(
        `Prelevement refuse : le montant depasse la capacite d'epargne disponible `
        + `(${epargneDisponible.toLocaleString()} FCFA).\n`
        + `Tresorerie insuffisante ou seuil de securite atteint : les fonds de l'entreprise sont proteges.`
      );
      return;
    }

    if (onAjouterDepense) onAjouterDepense({ ...form, montant, id: Date.now() });
    setForm(f => ({ ...f, libelle: '', montant: '' }));
    alert(`Depense personnelle enregistree : ${montant.toLocaleString()} FCFA`);
  };

  return (
    <div>
      {seuilAtteint && (
        <div style={{ backgroundColor: '#fef2f2', border: '2px solid #dc2626', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
          <strong style={{ color: '#991b1b', fontSize: '13px', display: 'block' }}>Verrouillage des prelevements - seuil critique atteint</strong>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#7f1d1d' }}>
            La tresorerie ({tresorerieEntreprise.toLocaleString()} FCFA) est inferieure ou egale au seuil de securite
            ({seuilCritique.toLocaleString()} FCFA). Aucun retrait personnel ne peut etre effectue tant que la
            tresorerie n'est pas reconstituee.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '14px' }}>
        <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '7px', borderLeft: '3px solid #16a34a', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Tresorerie entreprise</span>
          <strong style={{ fontSize: '16px', color: '#16a34a' }}>{tresorerieEntreprise.toLocaleString()} FCFA</strong>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '7px', borderLeft: '3px solid #ef4444', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Depenses personnelles</span>
          <strong style={{ fontSize: '16px', color: '#ef4444' }}>{totalDepenses.toLocaleString()} FCFA</strong>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '7px', borderLeft: '3px solid #0284c7', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Épargne disponible</span>
          <strong style={{ fontSize: '16px', color: '#0284c7' }}>{epargneDisponible.toLocaleString()} FCFA</strong>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '7px', borderLeft: '3px solid #8b5cf6', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Objectif d'épargne</span>
          <strong style={{ fontSize: '16px', color: '#8b5cf6' }}>{progressionEpargne} %</strong>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '7px', marginBottom: '14px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '5px' }}>
          <span>Progression vers l'Objectif d'épargne</span>
          <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{epargneDisponible.toLocaleString()} / {epargneCible.toLocaleString()} FCFA</span>
        </div>
        <div style={{ height: '9px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ width: `${progressionEpargne}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #0284c7)', borderRadius: '999px', transition: 'width 300ms ease' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px', marginBottom: '14px', alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '3px' }}>Seuil critique (FCFA)</label>
          <input
            type="number"
            value={seuilCritique}
            onChange={e => onDefinirSeuil && onDefinirSeuil(Number(e.target.value) || 0)}
            style={{ width: '100%', padding: '5px 6px', fontSize: '12px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '3px' }}>Objectif d'épargne (FCFA)</label>
          <input
            type="number"
            value={epargneCible}
            onChange={e => onDefinirEpargneCible && onDefinirEpargneCible(Number(e.target.value) || 0)}
            style={{ width: '100%', padding: '5px 6px', fontSize: '12px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
          />
        </div>
      </div>

      <form onSubmit={soumettre} style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#8b5cf6', margin: '0 0 7px 0', fontSize: '13px' }}>Depense personnelle / retrait</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', alignItems: 'center' }}>
          <input type="text" placeholder="Libelle" value={form.libelle} onChange={e => setForm({ ...form, libelle: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
          <input type="number" min="1" placeholder="Montant (FCFA)" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
          <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }}>
            <option value="Retrait pessoal">Retrait pessoal</option>
            <option value="Retrait personnel">Retrait personnel</option>
            <option value="Sante">Sante</option>
            <option value="Education">Education</option>
            <option value="Logement">Logement</option>
            <option value="Transport">Transport</option>
            <option value="Famille">Famille</option>
            <option value="Autre">Autre</option>
          </select>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} />
          <button
            type="submit"
            disabled={seuilAtteint}
            style={{
              backgroundColor: seuilAtteint ? '#cbd5e1' : '#8b5cf6',
              color: seuilAtteint ? '#64748b' : '#fff',
              border: 'none',
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '5px',
              fontWeight: 'bold',
              cursor: seuilAtteint ? 'not-allowed' : 'pointer'
            }}
          >
            {seuilAtteint ? 'Verrouille' : 'Enregistrer'}
          </button>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '7px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#0f172a' }}>Suivi mensuel</h4>
          {parMois.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Aucune depense enregistree.</p>
          ) : parMois.map(([mois, total]) => (
            <div key={mois} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{mois}</span>
              <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{total.toLocaleString()} F</span>
            </div>
          ))}
        </div>
        <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '7px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#0f172a' }}>Par categorie</h4>
          {parCategorie.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Aucune depense enregistree.</p>
          ) : parCategorie.map(([cat, total]) => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{cat}</span>
              <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{total.toLocaleString()} F</span>
            </div>
          ))}
        </div>
      </div>

      {depensesPersonnelles.length > 0 && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', color: '#fff' }}>
                <th style={{ padding: '7px 9px' }}>Date</th>
                <th style={{ padding: '7px 9px' }}>Libelle</th>
                <th style={{ padding: '7px 9px' }}>Categorie</th>
                <th style={{ padding: '7px 9px' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {depensesPersonnelles.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '7px 9px' }}>{d.date}</td>
                  <td style={{ padding: '7px 9px', fontWeight: 'bold' }}>{d.libelle}</td>
                  <td style={{ padding: '7px 9px' }}>{d.categorie}</td>
                  <td style={{ padding: '7px 9px', color: '#ef4444', fontWeight: 'bold' }}>{Number(d.montant).toLocaleString()} FCFA</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}