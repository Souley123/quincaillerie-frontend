import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/* =========================================================
   SCANNER HTML5-QRCODE — configure les formats supportés par ZXing.
   Extrait de App.js pour être réutilisable par les modules.
   ========================================================= */
function ScannerHtml5({ onScan, onError, onStop }) {
  const conteneurRef = useRef(null);
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  // Serialise les changements de camera pour eviter une transition concurrente.
  const demarrageEnCoursRef = useRef(false);
  const cameraEnAttenteRef = useRef(null);
  const instancePromiseRef = useRef(Promise.resolve());
  const cameraCouranteRef = useRef(null);

  // States declares avant tout useEffect : evite l'usage de const avant initialisation.
  const [cameras, setCameras] = useState([]);
  const [cameraActive, setCameraActive] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onScan, onError]);

  const arreter = () => {
    const instance = scannerRef.current;
    scannerRef.current = null;

    if (!instance) return Promise.resolve();

    try {
      const resultat = instance.stop();
      if (resultat && typeof resultat.then === 'function') {
        return resultat
          .then(() => {
            try {
              const detach = instance.clear();
              if (detach && typeof detach.catch === 'function') detach.catch(() => {});
            } catch (error) { /* deja detache */ }
          })
          .catch(() => {});
      }
    } catch (error) {
      /* scanner deja arrete */
    }
    return Promise.resolve();
  };

  const demarrer = cameraId => {
    cameraEnAttenteRef.current = cameraId;
    if (!demarrageEnCoursRef.current && scannerRef.current && cameraCouranteRef.current === cameraId) {
      cameraEnAttenteRef.current = null;
      return instancePromiseRef.current;
    }
    if (demarrageEnCoursRef.current) return instancePromiseRef.current;

    demarrageEnCoursRef.current = true;
    instancePromiseRef.current = (async () => {
      try {
        while (cameraEnAttenteRef.current !== null) {
          const cameraDemandee = cameraEnAttenteRef.current;
          cameraEnAttenteRef.current = null;
          if (!conteneurRef.current) return;
          cameraCouranteRef.current = cameraDemandee;

          await arreter();
          const instance = new Html5Qrcode('skys-reader-video', {
            verbose: false,
            formatsToSupport: Object.values(Html5QrcodeSupportedFormats)
          });
          scannerRef.current = instance;

          try {
            await instance.start(
              cameraDemandee || { facingMode: 'environment' },
              { fps: 10, qrbox: (largeurVue, hauteurVue) => ({
                width: Math.floor(largeurVue * 0.85),
                height: Math.min(140, Math.floor(hauteurVue * 0.35))
              }) },
              codeDecode => {
                const valeur = String(codeDecode || '').trim();
                if (valeur) onScanRef.current(valeur);
              },
              () => {}
            );
          } catch (error) {
            const message = String(error?.message || error || '');
            if (/NotAllowedError|Permission denied/i.test(message)) {
              onErrorRef.current?.('Accès caméra refusé. Autorisez la caméra ou utilisez la saisie manuelle.');
            } else if (/NotFoundError|No camera|Requested device/i.test(message)) {
              onErrorRef.current?.('Aucune caméra disponible. Utilisez la saisie manuelle.');
            } else {
              onErrorRef.current?.('Impossible de démarrer la caméra. Vérifiez les permissions ou utilisez la saisie manuelle.');
            }
          }
        }
      } finally {
        demarrageEnCoursRef.current = false;
      }
    })();
    return instancePromiseRef.current;
  };

  useEffect(() => {
    let annule = false;

    (async () => {
      try {
        const appareils = await Html5Qrcode.getCameras();
        if (annule) return;

        if (!appareils || appareils.length === 0) {
          onErrorRef.current?.('Aucune camera detectee sur cet appareil. Branchez une camera ou utilisez la saisie manuelle du code-barres.');
          return;
        }

        // Preference : camera arriere (numerique de telephone), sinon la 1re.
            const cameraArriere = appareils.find(camera => /back|rear|environment|arriere/i.test(camera.label));
        setCameraActive(cameraArriere?.id || appareils[0].id);
        await demarrer(cameraArriere?.id || appareils[0].id);
      } catch (error) {
        if (!annule) {
          onErrorRef.current?.('Acces a la camera indisponible. Verifiez les autorisations du navigateur ou utilisez la saisie manuelle.');
        }
      }
    })();

    return () => {
      annule = true;
      arreter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let annule = false;
    Html5Qrcode.getCameras()
      .then(liste => {
        if (!annule) setCameras(liste || []);
      })
      .catch(() => { /* la liste reste vide : le select est alors masque */ });
    return () => { annule = true; };
  }, []);

  const changerCamera = async event => {
    const cameraId = event.target.value;
    setCameraActive(cameraId);
    await demarrer(cameraId);
  };

  return (
    <div>
      <div id="skys-reader-video" ref={conteneurRef} style={{ width: '100%' }} />

      {cameras.length > 1 && (
        <div style={{ margin: '10px 0' }}>
          <label
            htmlFor="skys-select-camera"
            style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}
          >
            Camera utilisee
          </label>
          <select
            id="skys-select-camera"
            value={cameraActive}
            onChange={changerCamera}
            style={{ width: '100%', maxWidth: '380px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {cameras.map(camera => (
              <option key={camera.id} value={camera.id}>
                {camera.label || 'Camera sans nom'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onStop}
          style={{ backgroundColor: '#64748b', color: 'white', border: 'none', padding: '9px 14px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Fermer la camera
        </button>
        <button
            type="button"
            onClick={() => demarrer(cameraActive)}
            style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '9px 14px', borderRadius: '6px', cursor: 'pointer' }}
          >
          Redemarrer la camera
        </button>
      </div>
    </div>
  );
}

export default ScannerHtml5;
