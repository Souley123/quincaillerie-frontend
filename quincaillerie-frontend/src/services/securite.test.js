/**
 * Tests du service de détection visuelle.
 * On vérifie la logique pure de comparaison d'empreintes, sans navigateur.
 */

/* On importe la fonction depuis le module ; jsdom (env par défaut de CRA)
   fournit `window` et `document`. */
import { differenceEmpreintes } from './detectionVisuelle';
import { demarrerSurveillanceInactivite } from './surveillanceInactivite';

describe('differenceEmpreintes', () => {
  test('renvoie 0 pour deux empreintes identiques', () => {
    const a = [10, 20, 30, 40];
    expect(differenceEmpreintes(a, a)).toBe(0);
  });

  test('renvoie la différence moyenne attendue', () => {
    const a = [0, 0, 0, 0];
    const b = [10, 10, 10, 10];
    expect(differenceEmpreintes(a, b)).toBe(10);
  });

  test('renvoie null si les tailles diffèrent', () => {
    expect(differenceEmpreintes([1, 2], [1, 2, 3])).toBeNull();
  });

  test('renvoie null si une empreinte manque', () => {
    expect(differenceEmpreintes(null, [1, 2])).toBeNull();
  });
});

describe('demarrerSurveillanceInactivite', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('déclenche l\'avertissement puis le verrouillage', () => {
    const onAvertir = jest.fn();
    const onVerrouiller = jest.fn();

    const arreter = demarrerSurveillanceInactivite({
      dureeMaxMs: 10000,
      delaiAlerteMs: 6000,
      onAvertir,
      onVerrouiller
    });

    jest.advanceTimersByTime(6000);
    expect(onAvertir).toHaveBeenCalled();
    expect(onVerrouiller).not.toHaveBeenCalled();

    jest.advanceTimersByTime(4000);
    expect(onVerrouiller).toHaveBeenCalled();

    arreter();
  });

  test('l\'arrêt annule les minuteurs', () => {
    const onVerrouiller = jest.fn();

    const arreter = demarrerSurveillanceInactivite({
      dureeMaxMs: 5000,
      delaiAlerteMs: 3000,
      onVerrouiller
    });

    arreter();
    jest.advanceTimersByTime(10000);
    expect(onVerrouiller).not.toHaveBeenCalled();
  });

  test('une interaction remet le compte à rebours à zéro', () => {
    const onVerrouiller = jest.fn();

    const arreter = demarrerSurveillanceInactivite({
      dureeMaxMs: 10000,
      delaiAlerteMs: 6000,
      onVerrouiller
    });

    // 4 secondes s'écoulent, puis l'utilisateur bouge la souris :
    // le verrouillage ne doit PAS survenir aux 10 s initiales.
    jest.advanceTimersByTime(4000);
    window.dispatchEvent(new Event('mousemove'));

    jest.advanceTimersByTime(7000);
    expect(onVerrouiller).not.toHaveBeenCalled();

    // 4 secondes supplémentaires (total 11 s depuis la reprise) : verrouillage.
    jest.advanceTimersByTime(4000);
    expect(onVerrouiller).toHaveBeenCalled();

    arreter();
  });

  test('l\'avertissement signale la reprise d\'activité', () => {
    const onAvertir = jest.fn();
    const onActif = jest.fn();

    const arreter = demarrerSurveillanceInactivite({
      dureeMaxMs: 10000,
      delaiAlerteMs: 6000,
      onAvertir,
      onActif
    });

    jest.advanceTimersByTime(6000);
    expect(onAvertir).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('keydown'));
    expect(onActif).toHaveBeenCalledTimes(1);

    arreter();
  });
});
