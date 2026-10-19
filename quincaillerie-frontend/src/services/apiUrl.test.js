import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false }
}));

describe('résolution de l’URL de l’API', () => {
  beforeEach(() => {
    // La CI définit VITE_API_URL (et REACT_APP_API_URL) : on les retire le
    // temps des tests pour vérifier réellement la valeur PAR DÉFAUT
    // (localhost → backend local).
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('REACT_APP_API_URL', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const definirFenetre = hostname => {
    vi.stubGlobal('window', {
      location: {
        hostname,
        origin: `https://${hostname}`,
        protocol: 'https:'
      }
    });
  };

  test('le frontend sur localhost utilise le backend local', async () => {
    definirFenetre('localhost');
    const { apiUrl } = await import('./apiUrl');
    expect(apiUrl).toBe('http://localhost:5001');
  });

  test('une prévisualisation HTTPS utilise le backend public configuré par défaut', async () => {
    definirFenetre('preview.example.com');
    const { apiUrl, API_PUBLIQUE } = await import('./apiUrl');
    expect(apiUrl).toBe(API_PUBLIQUE);
  });

  test('le site GitHub Pages utilise le backend public', async () => {
    definirFenetre('souley123.github.io');
    const { apiUrl, API_PUBLIQUE } = await import('./apiUrl');
    expect(apiUrl).toBe(API_PUBLIQUE);
  });
});
