import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/* =========================================================
   SCANNER HTML5-QRCODE — configure les formats supportés par ZXing.
   Extrait de App.js pour être réutilisable par les modules.
   ========================================================= */
function ScannerHtml5({ onScan, onError, onStop }) {
  const conteneurRef = useRef(null);
  const scannerRef = useRef(null);
  const demonteeRef = useRef(false);
  const scanDejaTraiteRef = useRef(false);
  const demarrageEnCoursRef = useRef(false);
  const cameraEnAttenteRef = useRef(null);
  const instancePromiseRef = useRef(Promise.resolve());
  const [erreurLocale, setErreurLocale] = useState('');
  const [demarrageActif, setDemarrageActif] = useState(false);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  // Serialise les changements de camera pour eviter une transition concurrente.
  const cameraCouranteRef = useRef(null);
  const native = Capacitor.isNativePlatform();

  // States declares avant tout useEffect : evite l'usage de const avant initialisation.
  const [cameras, setCameras] = useState([]);
  const [cameraActive, setCameraActive] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onScan, onError]);

  const arreter = useCallback(async () => {
    const instance = scannerRef.current;
    scannerRef.current = null;
    cameraCouranteRef.current = null;
    if (!instance) return;
    try { if (typeof instance.stop === 'function') await instance.stop(); } catch { /* déjà arrêté */ }
    try { await instance.clear(); } catch { /* le conteneur peut être détaché */ }
  }, []);

  const signalerErreurCamera = useCallback(erreur => {
    const valeur = `${erreur?.name || ''} ${erreur?.message || erreur || ''}`;
    let texte;
    if (/NotAllowedError|PermissionDeniedError|Permission denied/i.test(valeur)) {
      texte = native
        ? 'Accès caméra refusé. Autorisez la caméra dans les réglages de l’application puis réessayez.'
        : 'Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur puis réessayez.';
    } else if (/NotFoundError|DevicesNotFoundError|No camera|Requested device/i.test(valeur)) {
      texte = 'Aucune caméra disponible. Utilisez la saisie manuelle du code-barres.';
    } else if (/NotReadableError|TrackStartError|Could not start video source/i.test(valeur)) {
      texte = 'La caméra est occupée par une autre application. Fermez-la puis réessayez.';
    } else if (/SecurityError|secure context|https/i.test(valeur)) {
      texte = 'La caméra exige une connexion sécurisée. Fermez puis rouvrez l’application mobile.';
    } else {
      texte = 'Impossible de démarrer la caméra. Vérifiez les autorisations ou utilisez la saisie manuelle.';
    }
    setErreurLocale(texte);
    onErrorRef.current?.(texte);
  }, [native]);

  const demarrer = useCallback(cameraId => {
    if (demonteeRef.current) return Promise.resolve();
    cameraEnAttenteRef.current = cameraId || '';
    if (demarrageEnCoursRef.current) return instancePromiseRef.current;
    demarrageEnCoursRef.current = true;
    setDemarrageActif(true);
    setErreurLocale('');
    instancePromiseRef.current = (async () => {
      try {
        while (cameraEnAttenteRef.current !== null && !demonteeRef.current) {
          const demandee = cameraEnAttenteRef.current;
          cameraEnAttenteRef.current = null;
          if (!conteneurRef.current) return;
          await arreter();
          if (demonteeRef.current || !conteneurRef.current) return;
          setErreurLocale('');
          const instance = new Html5Qrcode(conteneurRef.current.id, {
            verbose: false,
            formatsToSupport: Object.values(Html5QrcodeSupportedFormats),
            useBarCodeDetectorIfSupported: false
          });
          scannerRef.current = instance;
          const camera = native
            ? { facingMode: { ideal: 'environment' } }
            : (demandee || { facingMode: { ideal: 'environment' } });
          try {
            await instance.start(camera, {
              fps: 8,
              aspectRatio: 1,
              qrbox: (largeur, hauteur) => {
                const cote = Math.max(120, Math.floor(Math.min(largeur, hauteur) * 0.72));
                return { width: Math.min(cote, largeur), height: Math.min(cote, hauteur) };
              }
            }, texte => {
              const valeur = String(texte || '').trim();
              if (!valeur || scanDejaTraiteRef.current) return;
              scanDejaTraiteRef.current = true;
              onScanRef.current?.(valeur);
            }, () => {});
            if (demonteeRef.current) await arreter();
          } catch (erreur) {
            await arreter();
            if (demonteeRef.current) {
              if (cameraEnAttenteRef.current !== null) continue;
              break;
            }
            signalerErreurCamera(erreur);
            break;
          }
        }
      } finally {
        demarrageEnCoursRef.current = false;
        if (!demonteeRef.current) setDemarrageActif(false);
      }
    })();
    return instancePromiseRef.current;
  }, [arreter, native, signalerErreurCamera]);

  useEffect(() => {
    let annule = false;
    demonteeRef.current = false;
    scanDejaTraiteRef.current = false;

    (async () => {
      if (native) {
        // iOS n’accorde souvent la liste qu’après le prompt getUserMedia :
        // lancer directement en facingMode pour déclencher l’autorisation.
        setCameraActive('');
        setDemarrageActif(true);
        await demarrer('');
        return;
      }
      try {
        const appareils = await Html5Qrcode.getCameras();
        if (annule || demonteeRef.current) return;
        setCameras(appareils || []);
        const cameraArriere = (appareils || []).find(camera => /back|rear|environment|arriere/i.test(camera.label || ''));
        const cameraId = native ? '' : (cameraArriere?.id || appareils?.[0]?.id || '');
        setCameraActive(cameraId);
        // L’absence temporaire de caméras énumérables n’empêche pas iOS de
        // demander l’autorisation via getUserMedia/facingMode.
        await demarrer(cameraId);
      } catch (error) {
        if (annule || demonteeRef.current) return;
        setCameraActive('');
        await demarrer('');
        if (!scannerRef.current) signalerErreurCamera(error);
      }
    })();

    return () => {
      annule = true;
      demonteeRef.current = true;
      cameraEnAttenteRef.current = null;
      instancePromiseRef.current.finally(() => arreter());
    };
  }, [arreter, demarrer, native, signalerErreurCamera]);

  const changerCamera = async event => {
    const cameraId = event.target.value;
    scanDejaTraiteRef.current = false;
    setCameraActive(cameraId);
    await demarrer(cameraId);
  };

  const reconnecterAutreCamera = async () => {
    let liste = cameras;
    try {
      liste = (await Html5Qrcode.getCameras()) || [];
      setCameras(liste);
    } catch {
      if (!liste.length) {
        scanDejaTraiteRef.current = false;
        await demarrer('');
        return;
      }
    }
    if (!liste.length) {
      scanDejaTraiteRef.current = false;
      await demarrer('');
      return;
    }
    const index = liste.findIndex(camera => camera.id === cameraActive);
    const suivante = liste[(index + 1) % liste.length];
    setCameraActive(suivante.id);
    scanDejaTraiteRef.current = false;
    await demarrer(suivante.id);
  };

  const arreterEtFermer = async () => {
    cameraEnAttenteRef.current = null;
    demarrageEnCoursRef.current = false;
    setDemarrageActif(false);
    // Ne pas attendre la permission système : arrêter et fermer immédiatement.
    await arreter();
    demonteeRef.current = true;
    onStop?.();
  };

  return (
    <div>
      <div id="skys-reader-video" ref={conteneurRef} style={{ width: '100%', minHeight: '180px' }} />
      {(erreurLocale || demarrageActif) && (
        <p role={erreurLocale ? 'alert' : 'status'} style={{ color: erreurLocale ? '#b91c1c' : '#475569', fontSize: '13px', margin: '8px 0' }}>
          {erreurLocale || 'Démarrage de la caméra… Autorisez son accès si le téléphone le demande.'}
        </p>
      )}

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
          onClick={arreterEtFermer}
          style={{ backgroundColor: '#64748b', color: 'white', border: 'none', padding: '9px 14px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Fermer la caméra
        </button>
        <button
          type="button"
          onClick={() => { scanDejaTraiteRef.current = false; demarrer(cameraActive); }}
          disabled={demarrageActif}
          style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '9px 14px', borderRadius: '6px', cursor: demarrageActif ? 'wait' : 'pointer' }}
        >
          Redémarrer la caméra
        </button>
        <button
          type="button"
          onClick={reconnecterAutreCamera}
          style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '9px 14px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Connecter une autre caméra
        </button>
      </div>
    </div>
  );
}

export default ScannerHtml5;
