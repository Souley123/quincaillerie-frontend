import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { MODULES } from './matrice';

const ICI = dirname(fileURLToPath(import.meta.url));

describe('Cohérence du menu déroulant', () => {
  const lire = () => readFileSync(resolve(ICI, '../App.js'), 'utf8');

  test('chaque module de la matrice est proposable dans le menu', () => {
    const source = lire();
    const bloc = source.match(/const dropdownTabIds = \[([\s\S]*?)\];/);
    expect(bloc).toBeTruthy();

    const ids = [...bloc[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    MODULES.forEach(module => {
      expect(ids).toContain(module.id);
    });
  });

  test('le menu ne contient aucun module inconnu de la matrice', () => {
    const source = lire();
    const bloc = source.match(/const dropdownTabIds = \[([\s\S]*?)\];/);
    const ids = [...bloc[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

    ids.forEach(id => {
      expect(MODULES.map(m => m.id)).toContain(id);
    });
  });

  test('chaque onglet de getAllTabs() existe dans la matrice', () => {
    const source = lire();
    const bloc = source.match(/const tabs = \[([\s\S]*?)\n  \];/);
    expect(bloc).toBeTruthy();

    const ids = [...bloc[1].matchAll(/id: '([^']+)'/g)].map(m => m[1]);
    expect(ids.length).toBeGreaterThan(20);
    ids.forEach(id => {
      expect(MODULES.map(m => m.id)).toContain(id);
    });
  });
});
