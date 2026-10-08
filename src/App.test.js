import { render, screen } from '@testing-library/react';
import App from './App';

/**
 * Tests de l'écran de connexion (mode déconnecté).
 * On vérifie que les éléments essentiels de l'authentification sont présents,
 * pas seulement le titre : champs email / mot de passe et lien de réinitialisation.
 */
describe('Écran de connexion', () => {
  test('affiche le titre « Connexion Sécurisée »', () => {
    render(<App />);
    expect(screen.getByText(/Connexion Sécurisée/i)).toBeInTheDocument();
  });

  test('expose les champs email et mot de passe', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/Adresse email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/mot de passe/i)).toBeInTheDocument();
  });

  test('propose la réinitialisation du mot de passe', () => {
    render(<App />);
    expect(screen.getByText(/Mot de passe oublié/i)).toBeInTheDocument();
  });
});
