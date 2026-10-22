import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { contraintesDepuisAppareils, ouvrirFluxCamera } from './choixCamera';

/* PC sans caméra frontale : une seule webcam USB. */
const USB = { kind: 'videoinput', deviceId: 'usb-1', label: 'HD USB Camera', groupId: 'g1' };
/* Étiquettes vides : permission pas encore accordée. */
const ANONYME = { kind: 'videoinput', deviceId: '', label: '', groupId: '' };

const piste = () => ({ stop: vi.fn() });
const flux = () => ({ getTracks: () => [piste()], getVideoTracks: () => [piste()] });

/* Le stub de navigator est défait automatiquement, même si un test échoue
   (le stub manuel en fin de test ne protège pas le test suivant). */
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('contraintesDepuisAppareils', () => {
  test('vise l’identifiant explicite de la webcam existante (pas facingMode)', () => {
    const { contraintes, appareil } = contraintesDepuisAppareils('user', [USB]);
    expect(contraintes.deviceId).toEqual({ exact: 'usb-1' });
    expect(contraintes.facingMode).toBeUndefined();
    expect(appareil.deviceId).toBe('usb-1');
  });

  test('préfère la caméra arrière quand elle existe', () => {
    const frontale = { kind: 'videoinput', deviceId: 'f', label: 'Front Camera' };
    const arriere = { kind: 'videoinput', deviceId: 'b', label: 'Back Camera' };
    expect(contraintesDepuisAppareils('environment', [frontale, arriere]).contraintes.deviceId)
      .toEqual({ exact: 'b' });
    expect(contraintesDepuisAppareils('user', [frontale, arriere]).contraintes.deviceId)
      .toEqual({ exact: 'f' });
  });

  test('retombe sur facingMode idéal quand aucun appareil n’est étiqueté', () => {
    const { contraintes } = contraintesDepuisAppareils('user', [ANONYME]);
    expect(contraintes.facingMode).toEqual({ ideal: 'user' });
    expect(contraintes.deviceId).toBeUndefined();
  });
});

describe('ouvrirFluxCamera', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('libellés vides : amorce, relecture, puis demande par deviceId', async () => {
    const appels = [];
    const mediaDevices = {
      enumerateDevices: vi.fn()
        .mockResolvedValueOnce([ANONYME])
        .mockResolvedValueOnce([USB]),
      getUserMedia: vi.fn(async contraintes => {
        appels.push(contraintes);
        return flux();
      })
    };
    vi.stubGlobal('navigator', { mediaDevices });

    const promesse = ouvrirFluxCamera({ face: 'user', delaiEtiquettesMs: 350 });
    await vi.advanceTimersByTimeAsync(400);
    await promesse;

    // 1) amorce générique, 2) demande réelle par identifiant.
    expect(appels[0]).toEqual({ video: true, audio: false });
    expect(appels[1].video.deviceId).toEqual({ exact: 'usb-1' });
    expect(appels[1].video.facingMode).toBeUndefined();
    expect(appels[1].audio).toBe(false);
  });

  test('appareils déjà étiquetés : aucun appel d’amorce', async () => {
    const getUserMedia = vi.fn(async () => flux());
    vi.stubGlobal('navigator', {
      mediaDevices: { enumerateDevices: vi.fn(async () => [USB]), getUserMedia }
    });

    await ouvrirFluxCamera({ face: 'user', appareils: [USB] });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia.mock.calls[0][0].video.deviceId).toEqual({ exact: 'usb-1' });
  });

  test('la caméra d’amorce est libérée avant la demande réelle', async () => {
    const pisteAmorce = piste();
    const getUserMedia = vi.fn()
      .mockResolvedValueOnce({ getTracks: () => [pisteAmorce] })
      .mockResolvedValueOnce(flux());
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn()
          .mockResolvedValueOnce([ANONYME])
          .mockResolvedValueOnce([USB]),
        getUserMedia
      }
    });

    const promesse = ouvrirFluxCamera({ face: 'user', delaiEtiquettesMs: 0 });
    await vi.advanceTimersByTimeAsync(0);
    await promesse;

    expect(pisteAmorce.stop).toHaveBeenCalledTimes(1);
  });

  test('sans enumerateDevices : une seule demande, en facingMode', async () => {
    const getUserMedia = vi.fn(async () => flux());
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    await ouvrirFluxCamera({ face: 'user' });

    // Pas d'amorce inutile : une 2e demande rejouerait la permission.
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia.mock.calls[0][0].video.facingMode).toEqual({ ideal: 'user' });
  });
});
