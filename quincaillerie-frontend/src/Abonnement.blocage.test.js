import { render, screen } from '@testing-library/react';
import App from './App';

/**
 * Régression — écran « Période d'essai expirée ».
 *
 * Historique du défaut (à ne pas réintroduire) :
 *   1. Un 402 reçu autrefois écrivait `erp_trial_expire` dans le passé, à demeure.
 *   2. L'écran de blocage s'affichait ALORS MÊME qu'aucune session n'était
 *      ouverte, donc AVANT la connexion.
 *   3. L'utilisateur ne pouvait plus jamais se connecter : aucun mot de passe,
 *      même correct, ne changeait quoi que ce soit.
 *
 * Règle retenue : un blocage d'abonnement ne concerne qu'une SESSION OUVERTE.
 * Le serveur reste seul juge et répond 402 à chaque requête protégée.
 * Un visiteur déconnecté doit TOUJOURS voir l'écran de connexion.
 */
// Les clés métier sont isolées par compte : sans session, le préfixe est
// « skys__demo__demo__ ». On écrit donc dans cet espace pour simuler un
// verrou local laissé par un ancien 402.
const PREFIXE = 'skys__demo__demo__';
const forcerBlocageLocal = () => {
  // Échéance d'essai dans le passé → trialExpired = true au démarrage.
  localStorage.setItem(`${PREFIXE}erp_trial_expire`, String(Date.now() - 1000));
  localStorage.setItem(`${PREFIXE}erp_subscribed`, 'false');
  // Verrou déjà signalé par le serveur lors d'une session précédente.
  localStorage.setItem(`${PREFIXE}erp_abonnement_expire`, 'true');
};

describe('Abonnement — un verrou local ne doit pas bloquer la connexion', () => {
  beforeEach(() => {
    localStorage.clear();
    forcerBlocageLocal();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('affiche l’écran de connexion malgré une échéance locale dépassée', () => {
    render(<App />);
    // Le champ « Adresse Email ou Login » n'existe que sur l'écran de connexion.
    expect(screen.getByLabelText(/Adresse Email ou Login/i)).toBeInTheDocument();
  });

  test('n’affiche PAS l’écran « essai expiré » avant connexion', () => {
    render(<App />);
    expect(screen.queryByText(/Votre période d’essai est expirée/i)).not.toBeInTheDocument();
  });

  test('n’affiche PAS les moyens de paiement avant connexion', () => {
    render(<App />);
    // Payer suppose une session ouverte : le proposer ici n’a aucun sens.
    expect(screen.queryByText(/Orange Money/i)).not.toBeInTheDocument();
  });
});