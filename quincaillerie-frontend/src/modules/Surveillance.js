import React from 'react';
import CameraEspion from '../components/CameraEspion';
import { Icone } from '../components/Icones';
import { ajouterEvenementSecurite } from '../utils/evenementSecurite';

/* Surépaisseur « Surveillance globale » — extrait de App.js.
   Affiche un déclencheur discret et un panneau de capture caméra,
   réservé à l'administrateur disposant du palier cameraEspion. */
function Surveillance({
  utilisateurCourant,
  aAccesCameraEspion,
  surveillanceGlobaleOuverte,
  setSurveillanceGlobaleOuverte,
  authEmail,
  setSecurityEvents
}) {
  if (utilisateurCourant?.role !== 'Administrateur' || !aAccesCameraEspion) return null;

  return (
    <>
      <button
        type="button"
        onDoubleClick={() => setSurveillanceGlobaleOuverte(v => !v)}
        onContextMenu={e => { e.preventDefault(); setSurveillanceGlobaleOuverte(v => !v); }}
        aria-label="Zone de contrôle de la surveillance"
        title=""
        tabIndex={-1}
        style={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          width: '28px',
          height: '28px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: 'transparent',
          opacity: 0,
          cursor: 'default',
          zIndex: 9999
        }}
      >
        .
      </button>

      {surveillanceGlobaleOuverte && (
        <div
          style={{
            position: 'fixed',
            right: '18px',
            bottom: '40px',
            width: '360px',
            maxWidth: 'calc(100vw - 36px)',
            maxHeight: 'calc(100vh - 180px)',
            overflowY: 'auto',
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 12px 34px rgba(0,0,0,0.28)',
            zIndex: 9998
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '13px' }}>Surveillance globale — SKYS ERP</h3>
            <button
              type="button"
              onClick={() => setSurveillanceGlobaleOuverte(false)}
              aria-label="Fermer la surveillance"
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '2px 6px', display: 'flex' }}
            >
              <Icone nom="fermer" taille={16} />
            </button>
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b' }}>
            Œil permanent sur l’application : activez la surveillance pour enregistrer une preuve à tout moment, quel que soit le module affiché.
          </p>
          <CameraEspion
            onPreuveCapturee={preuve => {
              setSecurityEvents(events => ajouterEvenementSecurite(events, {
                id: preuve.id,
                date: preuve.horodatage,
                utilisateur: authEmail || 'Administrateur',
                type: 'Capture surveillance globale',
                detail: `Capture manuelle - session de ${preuve.dureeSession}s`,
                preuveImage: preuve.image
              }));
            }}
          />
        </div>
      )}
    </>
  );
}

export default Surveillance;
