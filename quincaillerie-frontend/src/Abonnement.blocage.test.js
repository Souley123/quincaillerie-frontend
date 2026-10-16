import { render, screen } from '@testing-library/react';
import App from './App';

/**
 * Régression — écran « Période d'essai expirée ».
 *
 * Un 402 reçu autrefois (essai expiré, panne réseau, mauvaise URL d'API)
 * laissait erp_trial_expire/erp_subscribed figés dans le navigateur : l'écran
 * de blocage réapparaissait alors même que l'abonnement était encore valide
 * côté serveur, sans aucun moyen de le vérifier depuis l'interface.
 *
 * Attendu désormais : l'écran propose un bouton « Actualiser mon abonnement »
 * qui interroge le serveur (GET /api/auth/moi) et lève le blocage si l'accès
 * est en réalité toujours valide.
 */
// Les clés métier sont isolées par compte : sans session, le préfixe est
// « skys__demo__demo__ ». On écrit donc dans cet espace pour simuler un
// verrou local laissé par un ancien 402.
const PREFIXE = 'skys__demo__demo__';
const forcerBlocageLocal = () => {
  // Échéance d'essai dans le passé → trialExpired = true au démarrage.
  localStorage.setItem(`${PREFIXE}erp_trial_expire`, String(Date.now() - 1000));
  localStorage.setItem(`${PREFIXE}erp_subscribed`, 'false');
};

describe('Abonnement — écran de blocage', () => {
  beforeEach(() => {
    localStorage.clear();
    forcerBlocageLocal();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('affiche l’écran « essai expiré » quand l’échéance locale est dépassée', () => {
    render(<App />);
    expect(screen.getByText(/expirée/i)).toBeInTheDocument();
  });

  test('propose un bouton « Actualiser mon abonnement » pour resynchroniser', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: /Actualiser mon abonnement/i })
    ).toBeInTheDocument();
  });

  test('propose toujours les moyens de paiement Mobile Money', () => {
    render(<App />);
    expect(screen.getByText(/Wave/i)).toBeInTheDocument();
    expect(screen.getByText(/Orange Money/i)).toBeInTheDocument();
  });
});