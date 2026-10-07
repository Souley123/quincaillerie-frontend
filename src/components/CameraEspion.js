import React, { useEffect, useRef, useState } from 'react';

/**
 * Caméra de sécurité — Mode Espion
 * - Surveillance en direct via getUserMedia
 * - Option d'activation / désactivation (case à cocher)
 * - Capture de preuve horodatée, capacité d'envoi au journal de sécurité
 * - Réticule, chrono de session et compteur de captures
 */
export default function CameraEspion({ onPreuveCapturee, activeInitial = false }) {
  const [surveillanceActive, setSurveillanceActive] = useState(activeInitial);
  const [erreur, setErreur] = useState('');
  const [captures, setCaptures] = useState([]);
  const [chrono, setChrono] = useState(0);
  const [cameraFace, setCameraFace] = useState('user');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Démarrage / arrêt du flux selon la case à cocher
  useEffect(() => {
    let annule = false;

    const arreter = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    if (!surveillanceActive) {
      arreter();
      setChrono(0);
      return undefined;
    }

    const demarrer = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErreur("Caméra inaccessible : permission du navigateur requise ou connexion HTTPS manquante.");
        setSurveillanceActive(false);
        return;
      }

      try {
        const flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cameraFace } }, audio: false });
        if (annule) {
          flux.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = flux;
        if (videoRef.current) {
          videoRef.current.srcObject = flux;
          await videoRef.current.play();
        }
        setErreur('');
      } catch (e) {
        setErreur('Accès à la caméra refusé ou impossible. Autorisez la caméra puis réessayez.');
        setSurveillanceActive(false);
      }
    };

    demarrer();

    return () => {
      annule = true;
      arreter();
    };
  }, [surveillanceActive, cameraFace]);

  // Chronomètre de session
  useEffect(() => {
    if (!surveillanceActive) return undefined;
    const minuteur = window.setInterval(() => setChrono(c => c + 1), 1000);
    return () => window.clearInterval(minuteur);
  }, [surveillanceActive]);

  const capturer = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    const preuve = {
      id: Date.now(),
      horodatage: new Date().toLocaleString(),
      image: canvas.toDataURL('image/jpeg', 0.75),
      dureeSession: chrono
    };

    setCaptures(liste => [preuve, ...liste].slice(0, 12));
    if (onPreuveCapturee) onPreuveCapturee(preuve);
  };

  const formaterChrono = total => {
    const min = String(Math.floor(total / 60)).padStart(2, '0');
    const sec = String(total % 60).padStart(2, '0');
    return `${min}:${sec}`;
  };

  return (
    <div>
      {/* Interrupteur principal */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          backgroundColor: surveillanceActive ? '#fef2f2' : '#f8fafc',
          border: '1px solid ' + (surveillanceActive ? '#fecaca' : '#e2e8f0'),
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '12px'
        }}
      >
        <input
          type="checkbox"
          checked={surveillanceActive}
          onChange={e => setSurveillanceActive(e.target.checked)}
          style={{ width: '17px', height: '17px', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: surveillanceActive ? '#dc2626' : '#334155' }}>
          {surveillanceActive ? '🟢 Surveillance en direct ACTIVE' : '⚪ Surveillance désactivée'}
        </span>
        {surveillanceActive && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', fontFamily: 'monospace', color: '#dc2626', fontWeight: 'bold' }}>
            ⏱️ {formaterChrono(chrono)}
          </span>
        )}
      </label>

      {erreur && (
        <p style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12px', padding: '9px 11px', borderRadius: '6px', margin: '0 0 12px' }}>
          {erreur}
        </p>
      )}

      {/* Flux vidéo */}
      <div style={{ position: 'relative', backgroundColor: '#020617', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
        <video ref={videoRef} muted playsInline style={{ display: 'block', width: '100%', maxHeight: '300px', objectFit: 'cover' }} />

        {/* Réticule */}
        {surveillanceActive && (
          <>
            <div style={{ position: 'absolute', top: 0, left: '50%', width: '1px', height: '28px', backgroundColor: 'rgba(239,68,68,0.85)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: '50%', width: '1px', height: '28px', backgroundColor: 'rgba(239,68,68,0.85)' }} />
            <div style={{ position: 'absolute', left: 0, top: '50%', height: '1px', width: '28px', backgroundColor: 'rgba(239,68,68,0.85)' }} />
            <div style={{ position: 'absolute', right: 0, top: '50%', height: '1px', width: '28px', backgroundColor: 'rgba(239,68,68,0.85)' }} />
            <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(220,38,38,0.85)', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#fff' }} />
              REC
            </div>
            <div style={{ position: 'absolute', bottom: '8px', left: '8px', color: '#fff', fontSize: '10px', fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.6)', padding: '3px 7px', borderRadius: '4px' }}>
              {new Date().toLocaleString('fr-CI')}
            </div>
          </>
        )}

        {!surveillanceActive && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '6px' }}>
            <span style={{ fontSize: '30px' }}>📷</span>
            <span style={{ fontSize: '12px' }}>Aucune surveillance active</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setCameraFace(face => face === 'user' ? 'environment' : 'user')}
          style={{ padding: '7px 12px', fontSize: '12px', backgroundColor: '#0369a1', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          🔄 Caméra {cameraFace === 'user' ? 'arrière' : 'avant'}
        </button>
        <button
          type="button"
          onClick={capturer}
          disabled={!surveillanceActive}
          style={{
            padding: '7px 12px',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor: surveillanceActive ? '#dc2626' : '#cbd5e1',
            color: surveillanceActive ? '#fff' : '#64748b',
            border: 'none',
            borderRadius: '5px',
            cursor: surveillanceActive ? 'pointer' : 'not-allowed'
          }}
        >
          📸 Capturer une preuve
        </button>
        <button
          type="button"
          onClick={() => setSurveillanceActive(a => !a)}
          style={{ padding: '7px 12px', fontSize: '12px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {surveillanceActive ? '⏹️ Arrêter' : '▶️ Démarrer'}
        </button>
        {captures.length > 0 && (
          <button
            type="button"
            onClick={() => setCaptures([])}
            style={{ padding: '7px 12px', fontSize: '12px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Vider ({captures.length})
          </button>
        )}
      </div>

      {/* Galerie des captures */}
      {captures.length > 0 && (
        <div className="docs-row">
          {captures.map(capture => (
            <div key={capture.id} className="doc-card">
              <img src={capture.image} alt={`Capture ${capture.horodatage}`} style={{ width: '100%', height: '96px', objectFit: 'cover', borderRadius: '4px' }} />
              <span style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{capture.horodatage}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}