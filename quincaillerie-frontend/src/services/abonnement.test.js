import { afterEach, describe, expect, test, vi } from 'vitest';
import { DUREE_ESSAI_JOURS, echeanceEssaiDepuisEntreprise, estExpire, joursRestants } from './abonnement';

describe('nouvel essai d’abonnement', () => {
  afterEach(() => vi.useRealTimers());

  test('la durée de l’essai est de cinq jours', () => {
    expect(DUREE_ESSAI_JOURS).toBe(5);
  });

  test('calcule la nouvelle échéance à cinq jours depuis la date de création côté serveur', () => {
    const creation = new Date('2026-10-22T12:00:00.000Z');
    expect(echeanceEssaiDepuisEntreprise({ abonnementActuel: 'essai', dateCreation: creation }))
      .toBe(new Date('2026-10-27T12:00:00.000Z').getTime());
  });

  test('un abonnement expiré côté serveur ne reçoit pas de nouvelle période d’essai', () => {
    expect(echeanceEssaiDepuisEntreprise({ abonnementActuel: 'expire', dateCreation: new Date() })).toBe(0);
  });

  test('une entreprise historique conserve son ancienne date d’expiration sans lui ajouter cinq jours', () => {
    const ancienneEcheance = new Date('2026-10-25T12:00:00.000Z');
    expect(echeanceEssaiDepuisEntreprise({ palier: 'Essai', abonnementEcheance: ancienneEcheance }))
      .toBe(ancienneEcheance.getTime());
  });

  test('un palier payant conserve son échéance contractuelle du serveur', () => {
    const echeance = new Date('2026-11-22T12:00:00.000Z');
    expect(echeanceEssaiDepuisEntreprise({ abonnementActuel: 'standard', abonnementEcheance: echeance }))
      .toBe(echeance.getTime());
  });

  test('calcule les jours restants depuis une échéance du serveur', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'));
    const echeance = new Date('2026-10-27T12:00:00.000Z');
    expect(joursRestants(echeance)).toBe(5);
    expect(estExpire(echeance)).toBe(false);
  });

  test('signale l’expiration après l’échéance serveur', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00.000Z'));
    expect(estExpire(new Date('2026-10-27T12:00:00.000Z'))).toBe(true);
    expect(joursRestants(new Date('2026-10-27T12:00:00.000Z'))).toBe(0);
  });
});
