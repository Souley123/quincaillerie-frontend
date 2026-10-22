import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { Html5Qrcode } from 'html5-qrcode';
import ScannerHtml5 from './ScannerHtml5';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) }
}));

const html5Mock = vi.hoisted(() => ({ constructeur: null }));

vi.mock('html5-qrcode', () => {
  const instances = [];
  html5Mock.instances = instances;
  const constructeur = vi.fn(function mockHtml5Qrcode() {
    const instance = {
      isScanning: false,
      state: 0,
      start: vi.fn(async () => { instance.isScanning = true; instance.state = 2; }),
      stop: vi.fn(async () => { instance.isScanning = false; instance.state = 0; }),
      clear: vi.fn(async () => {})
    };
    instances.push(instance);
    html5Mock.lastInstance = instance;
    return instance;
  });
  const Html5Qrcode = Object.assign(constructeur, {
    getCameras: vi.fn(async () => [{ id: 'rear-id', label: 'Back Camera' }])
  });
  html5Mock.constructeur = Html5Qrcode;
  return {
    Html5Qrcode,
    Html5QrcodeSupportedFormats: { EAN_13: 1, QR_CODE: 2 }
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Capacitor.isNativePlatform.mockReturnValue(false);
  Html5Qrcode.getCameras.mockResolvedValue([{ id: 'rear-id', label: 'Back Camera' }]);
});

describe('ScannerHtml5', () => {
  test('sur ordinateur conserve les commandes de sélection explicite de caméra', async () => {
    render(<ScannerHtml5 onScan={vi.fn()} />);
    await waitFor(() => expect(html5Mock.constructeur).toHaveBeenCalled());
    expect(html5Mock.constructeur).toHaveBeenCalledWith('skys-reader-video', expect.any(Object));
    expect(screen.getByRole('button', { name: /Connecter une autre caméra/i })).toBeInTheDocument();
  });

  test('sur natif démarre en facingMode arrière sans attendre les IDs caméra', async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    render(<ScannerHtml5 onScan={vi.fn()} />);
    await waitFor(() => expect(html5Mock.constructeur).toHaveBeenCalled());
    expect(html5Mock.constructeur).toHaveBeenCalledWith('skys-reader-video', expect.any(Object));
    expect(Html5Qrcode.mock.results[0].value.start).toHaveBeenCalledWith(
      { facingMode: { ideal: 'environment' } }, expect.any(Object), expect.any(Function), expect.any(Function)
    );
    expect(screen.getByRole('button', { name: /Redémarrer la caméra/i })).toBeInTheDocument();
  });

  test('sur natif reporte clairement le refus de permission', async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    const onError = vi.fn();
    html5Mock.instances = [];
    const demarrerAvecErreur = vi.fn(async () => {
      throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    });
    const ancienConstructeur = html5Mock.constructeur.getMockImplementation();
    html5Mock.constructeur.mockImplementation(function mockHtml5QrcodeAvecErreur(...args) {
      const instance = ancienConstructeur(...args);
      instance.start = demarrerAvecErreur;
      return instance;
    });
    render(<ScannerHtml5 onScan={vi.fn()} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/réglages de l’application/i);
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/réglages de l’application/i));
  });

  test('un scan appelle le callback au plus une fois par démarrage', async () => {
    const onScan = vi.fn();
    html5Mock.instances = [];
    render(<ScannerHtml5 onScan={onScan} />);
    await waitFor(() => expect(html5Mock.constructeur).toHaveBeenCalled());
    const decode = (html5Mock.instances[0] || Html5Qrcode.mock.results[0].value).start.mock.calls[0][2];
    decode('EAN123');
    decode('EAN123');
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('EAN123');
  });

  test('Fermer arrête la caméra avant onStop', async () => {
    const onStop = vi.fn();
    html5Mock.instances = [];
    Capacitor.isNativePlatform.mockReturnValue(true);
    render(<ScannerHtml5 onScan={vi.fn()} onStop={onStop} />);
    await waitFor(() => expect(html5Mock.constructeur).toHaveBeenCalled());
    const camera = html5Mock.lastInstance;
    expect(camera).toBeDefined();
    camera.start.mockImplementation(async () => { camera.isScanning = true; camera.state = 2; });
    await waitFor(() => expect(screen.getByRole('button', { name: /Redémarrer la caméra/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Redémarrer la caméra/i }));
    await waitFor(() => expect(camera.start).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Fermer la caméra/i }));
    await waitFor(() => expect(camera.stop).toHaveBeenCalledTimes(1));
    expect(camera.clear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onStop).toHaveBeenCalledTimes(1));
  });
});
