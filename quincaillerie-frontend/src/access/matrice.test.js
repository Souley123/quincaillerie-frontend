import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  MODULES,
  ROLES,
  autoriserModule,
  deciderAcces,
  modulesAutorises,
  normaliserPalier,
  normaliserRole,
  palierCouvre,
  roleAutorise
} from './matrice';

/* ==================================================================
   SÉCURITÉ RBAC + ABONNEMENT — matrice d'accès
   Ces tests verrouillent le « moindre privilège » : toute régression
   d'autorisation fera échouer la suite.
   ================================================================== */

const admin = ROLES.ADMIN;
const gestionnaire = ROLES.GESTIONNAIRE;
const vendeur = ROLES.VENDEUR;
const livreur = ROLES.LIVREUR;

describe('Rôles', () => {
  test('les anciens rôles sont ramenés aux rôles actuels', () => {
    expect(normaliserRole('Magasinier')).toBe(gestionnaire);
    expect(normaliserRole('Caissier')).toBe(vendeur);
    expect(normaliserRole('Administrateur')).toBe(admin);
    expect(normaliserRole('Livreur')).toBe(livreur);
  });

  test('un rôle inconnu est refusé (défaut fermé)', () => {
    expect(normaliserRole('SuperHacker')).toBeNull();
    expect(normaliserRole('')).toBeNull();
  });
});

describe('Paliers', () => {
  test('les synonymes commerciaux sont reconnus', () => {
    expect(normaliserPalier('Master')).toBe('Enterprise');
    expect(normaliserPalier('Entreprise')).toBe('Enterprise');
    expect(normaliserPalier('Professionnel / ERP')).toBe('Pro');
    expect(normaliserPalier('Standard / Boutique')).toBe('Standard');
  });

  test('un palier inconnu équivaut à l’essai', () => {
    expect(normaliserPalier('Platine')).toBe('Essai');
  });
});

describe('Menu par abonnement', () => {
  test('STANDARD : uniquement les modules de base', () => {
    const modules = modulesAutorises({ role: admin, palier: 'Standard' });
    expect(modules).toEqual(expect.arrayContaining([
      'dashboard', 'quincaillerie', 'transaction', 'gaz', 'recherche', 'clients', 'aide'
    ]));
    // Aucun module Pro ou Enterprise ne doit fuiter.
    expect(modules).not.toContain('mouvements');
    expect(modules).not.toContain('transport');
    expect(modules).not.toContain('tresorerie');
    expect(modules).not.toContain('comptabilite');
    expect(modules).not.toContain('parametresGeneraux');
  });

  test('PRO : les modules Pro s’ajoutent, pas ceux d’Enterprise', () => {
    const modules = modulesAutorises({ role: admin, palier: 'Pro' });
    expect(modules).toEqual(expect.arrayContaining([
      'mouvements', 'reappro', 'achats', 'devis', 'inventaire', 'transport', 'credits', 'notes'
    ]));
    expect(modules).not.toContain('depenses');
    expect(modules).not.toContain('comptabilite');
    expect(modules).not.toContain('tresorerie');
  });

  test('ENTERPRISE / MASTER : tous les modules', () => {
    const modules = modulesAutorises({ role: admin, palier: 'Master' });
    expect(modules).toHaveLength(MODULES.length);
  });

  test('un abonnement inférieur ne donne jamais un module supérieur', () => {
    expect(palierCouvre('Standard', 'comptabilite')).toBe(false);
    expect(palierCouvre('Pro', 'tresorerie')).toBe(false);
    expect(palierCouvre('Essai', 'mouvements')).toBe(false);
  });

  test('l’offre Transporteur ouvre le transport sans débloquer le reste', () => {
    expect(palierCouvre('Transport', 'transport')).toBe(true);
    expect(palierCouvre('Transport', 'comptabilite')).toBe(false);
    expect(palierCouvre('Transporteur', 'quincaillerie')).toBe(true);
  });
});

describe('Rôles et moindre privilège', () => {
  test('un vendeur n’a pas la trésorerie ni les paramètres', () => {
    expect(roleAutorise(vendeur, 'tresorerie')).toBe(false);
    expect(roleAutorise(vendeur, 'parametresGeneraux')).toBe(false);
    expect(roleAutorise(vendeur, 'comptabilite')).toBe(false);
  });

  test('un vendeur peut vendre, deviser et chercher', () => {
    expect(roleAutorise(vendeur, 'transaction')).toBe(true);
    expect(roleAutorise(vendeur, 'devis')).toBe(true);
    expect(roleAutorise(vendeur, 'recherche')).toBe(true);
  });

  test('un gestionnaire ne touche ni la caisse ni la trésorerie', () => {
    expect(roleAutorise(gestionnaire, 'transaction')).toBe(false);
    expect(roleAutorise(gestionnaire, 'tresorerie')).toBe(false);
    expect(roleAutorise(gestionnaire, 'quincaillerie')).toBe(true);
    expect(roleAutorise(gestionnaire, 'achats')).toBe(true);
    expect(roleAutorise(gestionnaire, 'reports')).toBe(false);
  });

  test('un livreur ne voit que la logistique', () => {
    const modules = modulesAutorises({ role: livreur, palier: 'Enterprise' });
    expect(modules).toEqual(expect.arrayContaining(['transport', 'mouvements', 'dashboard', 'aide']));
    expect(modules).not.toContain('transaction');
    expect(modules).not.toContain('quincaillerie');
    expect(modules).not.toContain('achats');
    expect(modules).not.toContain('depenses');
  });

  test('le croisement rôle × abonnement est bien une intersection', () => {
    // Admin en Standard : module Pro refusé pour l'ABONNEMENT.
    expect(deciderAcces({ role: admin, palier: 'Standard', moduleId: 'comptabilite' }).raison).toBe('abonnement');
    // Vendeur en Enterprise : module présent, mais refusé pour le RÔLE.
    expect(deciderAcces({ role: vendeur, palier: 'Enterprise', moduleId: 'comptabilite' }).raison).toBe('role');
    // Les deux réunis : autorisé.
    expect(deciderAcces({ role: admin, palier: 'Enterprise', moduleId: 'comptabilite' }).autorise).toBe(true);
  });

  test('un module inexistant n’est jamais autorisé', () => {
    expect(autoriserModule({ role: admin, palier: 'Enterprise', moduleId: 'portail-magique' })).toBe(false);
  });
});

describe('Cohérence frontend / backend', () => {
  test('la matrice backend est identique à celle du frontend', () => {
    const chemin = resolve(__dirname, '../../quicaillerie-backend/config/acces.js');
    let backend;
    try {
      backend = readFileSync(chemin, 'utf8');
    } catch {
      // Le dossier backend n'est pas toujours présent (déploiement séparé).
      return;
    }

    const modulesBackend = [...backend.matchAll(/id: '([^']+)', libelle: '([^']+)', niveau: '([A-Z]+)'/g)]
      .map(m => ({ id: m[1], libelle: m[2], niveau: m[3] }));
    const modulesFrontend = MODULES.map(m => ({ id: m.id, libelle: m.libelle, niveau: m.niveau }));

    expect(modulesBackend).toEqual(modulesFrontend);
  });

  test('chaque module a au moins un rôle et un niveau valide', () => {
    MODULES.forEach(module => {
      expect(module.roles.length).toBeGreaterThan(0);
      expect(['STANDARD', 'PRO', 'ENTERPRISE']).toContain(module.niveau);
    });
  });
});
