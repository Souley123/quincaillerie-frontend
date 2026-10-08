﻿import { avecRepriseLecture } from './reseau';

describe('avecRepriseLecture', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retente une panne de transport puis renvoie le rÃ©sultat', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('ok');

    await expect(avecRepriseLecture(operation, { delaiInitialMs: 0 })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('ne retente pas une erreur HTTP client', async () => {
    const erreur = { response: { status: 401 } };
    const operation = jest.fn().mockRejectedValue(erreur);

    await expect(avecRepriseLecture(operation)).rejects.toBe(erreur);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('sâ€™arrÃªte aprÃ¨s le nombre maximal de tentatives', async () => {
    const erreur = new Error('offline');
    const operation = jest.fn().mockRejectedValue(erreur);

    await expect(avecRepriseLecture(operation, { tentativesMax: 1, delaiInitialMs: 0 })).rejects.toBe(erreur);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

