import React, { useEffect, useRef, useState } from 'react';

/**
 * Montre multifonction professionnelle
 * - Aiguilles analogiques (heure / minute / seconde)
 * - Affichage numérique temps réel + date complète en français
 * - Indicateur 12h / 24h
 */
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function Aiguille({ angle, longueur, epaisseur, couleur }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: epaisseur,
        height: longueur,
        backgroundColor: couleur,
        borderRadius: epaisseur,
        transformOrigin: '50% 100%',
        transform: `translate(-50%, -100%) rotate(${angle}deg)`,
        transition: 'transform 120ms cubic-bezier(.4,2.2,.6,1)'
      }}
    />
  );
}

export default function MontrePro({ taille = 168, compact = false }) {
  const [maintenant, setMaintenant] = useState(new Date());
  const rafRef = useRef(null);

  useEffect(() => {
    // Horloge pilotée par requestAnimationFrame : reste exacte même après mise en veille
    const tick = () => {
      setMaintenant(new Date());
      rafRef.current = window.setTimeout(tick, 1000);
    };
    rafRef.current = window.setTimeout(tick, 1000);
    return () => window.clearTimeout(rafRef.current);
  }, []);

  const h = maintenant.getHours();
  const m = maintenant.getMinutes();
  const s = maintenant.getSeconds();

  const angleSeconde = s * 6;
  const angleMinute = m * 6 + s * 0.1;
  const angleHeure = (h % 12) * 30 + m * 0.5;

  const heure24 = String(h).padStart(2, '0');
  const minute = String(m).padStart(2, '0');
  const seconde = String(s).padStart(2, '0');

  const dateFr = `${JOURS[maintenant.getDay()]} ${maintenant.getDate()} ${MOIS[maintenant.getMonth()]} ${maintenant.getFullYear()}`;
  const dateCourte = `${maintenant.getDate()} ${MOIS[maintenant.getMonth()].slice(0, 4)}. ${maintenant.getFullYear()}`;

  // ---------- Variante compacte : en-tête de l'application ----------
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
        <span
          className="montre-cadre"
          style={{
            position: 'relative',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 34% 30%, #334155 0%, #0f172a 70%)',
            border: '1.5px solid #475569',
            display: 'inline-block',
            flex: 'none'
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '1.5px',
              height: '9px',
              backgroundColor: '#f8fafc',
              transformOrigin: '50% 100%',
              transform: `translate(-50%, -100%) rotate(${angleHeure}deg)`
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '1.5px',
              height: '12px',
              backgroundColor: '#e2e8f0',
              transformOrigin: '50% 100%',
              transform: `translate(-50%, -100%) rotate(${angleMinute}deg)`
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '4px',
              width: '1px',
              height: '5px',
              backgroundColor: '#f97316',
              transformOrigin: `50% 11px`,
              transform: `rotate(${angleSeconde}deg)`
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '3px',
              height: '3px',
              marginLeft: '-1.5px',
              marginTop: '-1.5px',
              borderRadius: '50%',
              backgroundColor: '#f97316'
            }}
          />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span className="montre-heure" style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#0f172a',
              fontFamily: "'Consolas', 'Courier New', monospace",
              letterSpacing: '0.5px'
            }}
          >
            {heure24}:{minute}
            <span style={{ fontSize: '10px', color: '#f97316' }}>:{seconde}</span>
          </span>
          <span className="montre-date" style={{ fontSize: '9px', color: '#64748b', textTransform: 'capitalize' }}>{dateCourte}</span>
        </span>
      </div>
    );
  }

  // Marques horaires
  const marques = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Cadran analogique */}
      <div
        style={{
          position: 'relative',
          width: taille,
          height: taille,
          margin: '0 auto',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 32% 28%, #334155 0%, #0f172a 58%, #020617 100%)',
          boxShadow: '0 10px 26px rgba(0,0,0,0.28), inset 0 0 0 3px rgba(148,163,184,0.35)',
          border: '2px solid #0f172a'
        }}
      >
        {marques.map(marque => (
          <div
            key={marque}
            style={{
              position: 'absolute',
              left: '50%',
              top: '6px',
              width: marque % 3 === 0 ? '3px' : '2px',
              height: marque % 3 === 0 ? '11px' : '6px',
              marginLeft: marque % 3 === 0 ? '-1.5px' : '-1px',
              backgroundColor: marque % 3 === 0 ? '#f8fafc' : '#94a3b8',
              borderRadius: '2px',
              transformOrigin: `50% ${taille / 2 - 6}px`,
              transform: `rotate(${marque * 30}deg)`
            }}
          />
        ))}

        <Aiguille angle={angleHeure} longueur={taille * 0.27} epaisseur="5px" couleur="#f8fafc" />
        <Aiguille angle={angleMinute} longueur={taille * 0.37} epaisseur="3px" couleur="#e2e8f0" />
        <Aiguille angle={angleSeconde} longueur={taille * 0.42} epaisseur="1.5px" couleur="#f97316" />

        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '9px',
            height: '9px',
            marginLeft: '-4.5px',
            marginTop: '-4.5px',
            borderRadius: '50%',
            backgroundColor: '#f97316',
            boxShadow: '0 0 0 2px #0f172a'
          }}
        />
      </div>

      {/* Affichage numérique */}
      <div style={{ marginTop: '10px' }}>
        <div
          style={{
            fontSize: '26px',
            fontWeight: 'bold',
            color: '#0f172a',
            fontFamily: "'Consolas', 'Courier New', monospace",
            letterSpacing: '2px'
          }}
        >
          {heure24}:{minute}
          <span style={{ fontSize: '16px', color: '#f97316' }}>:{seconde}</span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', textTransform: 'capitalize' }}>{dateFr}</div>
        <div
          style={{
            display: 'inline-block',
            marginTop: '6px',
            padding: '2px 9px',
            borderRadius: '999px',
            fontSize: '10px',
            fontWeight: 'bold',
            backgroundColor: '#eff6ff',
            color: '#0284c7',
            border: '1px solid #bae6fd'
          }}
        >
          ⏱️ Heure locale · 24 h
        </div>
      </div>
    </div>
  );
}