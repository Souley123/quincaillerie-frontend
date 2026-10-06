import { render, screen } from '@testing-library/react';
import App from './App';

test('affiche le formulaire de connexion', () => {
  render(<App />);
  expect(screen.getByText(/Connexion Sécurisée/i)).toBeInTheDocument();
});
