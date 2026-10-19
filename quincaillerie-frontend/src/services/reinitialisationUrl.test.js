import { act } from '@testing-library/react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import PageReinitialisation from '../components/PageReinitialisation';
import PageReinitialisationPortailClient from '../components/PageReinitialisationPortailClient';
import {
  confirmerReinitialisationMotDePasseApi,
  confirmerReinitialisationPortailClientApi
} from '../services/api';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  confirmerReinitialisationMotDePasseApi: vi.fn().mockResolvedValue({ message: 'OK' }),
  confirmerReinitialisationPortailClientApi: vi.fn().mockResolvedValue({ message: 'OK' })
}));

const afficher = (Composant, url) => {
  window.history.replaceState({}, '', url);
  const element = document.createElement('div');
  document.body.appendChild(element);
  const root = createRoot(element);
  act(() => root.render(<Composant />));
  return { element, root };
};

const formulaireAvecMotDePasse = element => {
  const champs = element.querySelectorAll('input[type="password"]');
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(champs[0], 'motdepasse-securise-123');
    champs[0].dispatchEvent(new Event('input', { bubbles: true }));
    setter.call(champs[1], 'motdepasse-securise-123');
    champs[1].dispatchEvent(new Event('input', { bubbles: true }));
  });
  return element.querySelector('form');
};

afterEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
  jest.clearAllMocks();
});

test('la page ERP garde les informations en mémoire et retire immédiatement les secrets de query', () => {
  const { element, root } = afficher(
    PageReinitialisation,
    '/quincaillerie-frontend/mot-de-passe/reinitialiser?email=user%40example.com&jeton=abc123&slug=demo&keep=yes'
  );
  expect(window.location.search).toBe('?keep=yes');
  expect(window.location.pathname).toBe('/quincaillerie-frontend/mot-de-passe/reinitialiser');
  expect(element.textContent).toContain('Réinitialiser le mot de passe');
  expect(element.textContent).not.toContain('abc123');
  const formulaire = formulaireAvecMotDePasse(element);
  act(() => formulaire.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(confirmerReinitialisationMotDePasseApi)
    .toHaveBeenCalledWith('user@example.com', 'abc123', 'motdepasse-securise-123', 'demo');
  act(() => root.unmount());
});

test('la page client garde les informations en mémoire et retire immédiatement les secrets de query', () => {
  const { element, root } = afficher(
    PageReinitialisationPortailClient,
    '/quincaillerie-frontend/client/mot-de-passe/reinitialiser?email=user%40example.com&jeton=abc123&slug=demo&keep=yes'
  );
  expect(window.location.search).toBe('?keep=yes');
  expect(window.location.pathname).toBe('/quincaillerie-frontend/client/mot-de-passe/reinitialiser');
  expect(element.textContent).toContain('Réinitialiser votre mot de passe client');
  expect(element.textContent).not.toContain('abc123');
  const formulaire = formulaireAvecMotDePasse(element);
  act(() => formulaire.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(confirmerReinitialisationPortailClientApi)
    .toHaveBeenCalledWith({ slug: 'demo', email: 'user@example.com', jeton: 'abc123', motDePasse: 'motdepasse-securise-123' });
  act(() => root.unmount());
});
