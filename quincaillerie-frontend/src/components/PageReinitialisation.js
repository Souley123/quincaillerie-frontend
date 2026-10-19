import { useState } from 'react';
import { confirmerReinitialisationMotDePasseApi } from '../services/api';

const LONGUEUR_MIN_MOT_DE_PASSE = 12;
const LONGUEUR_MAX_MOT_DE_PASSE = 256;
const PARAMETRES_SENSIBLES = ['jeton', 'email', 'slug', '__route'];
const STYLE_CONTENEUR = {
  maxWidth: 420,
  margin: '10vh auto',
  padding: 24,
  fontFamily: 'sans-serif'
};
const STYLE_FORMULAIRE = { display: 'grid', gap: 12 };

const lireIdentifiantsLien = () => {
  const params = new URLSearchParams(window.location.search);
  const identifiants = {
    email: params.get('email') || '',
    jeton: params.get('jeton') || '',
    slug: params.get('slug') || ''
  };

  if (window.location.search) {
    const url = new URL(window.location.href);
    PARAMETRES_SENSIBLES.forEach(cle => url.searchParams.delete(cle));
    window.history.replaceState({}, '', url.toString());
  }

  return identifiants;
};

const obtenirUrlConnexion = () => (
  window.location.pathname.startsWith('/quincaillerie-frontend')
    ? 'https://souley123.github.io/quincaillerie-frontend/'
    : '/'
);

const validerMotDePasse = (motDePasse, confirmation) => {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE || motDePasse.length > LONGUEUR_MAX_MOT_DE_PASSE) {
    return 'Le mot de passe doit contenir entre 12 et 256 caractères.';
  }
  if (motDePasse !== confirmation) {
    return 'Les mots de passe ne correspondent pas.';
  }
  return '';
};

const obtenirMessageErreur = erreur => (
  erreur?.response?.data?.error || 'Réinitialisation impossible. Demandez un nouveau lien.'
);

export default function PageReinitialisation() {
  const [identifiantsLien] = useState(lireIdentifiantsLien);
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [termine, setTermine] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const urlConnexion = obtenirUrlConnexion();
  const lienIncomplet = !identifiantsLien.email || !identifiantsLien.jeton;

  const soumettre = async event => {
    event.preventDefault();
    const erreurValidation = validerMotDePasse(motDePasse, confirmation);
    if (erreurValidation) {
      setErreur(erreurValidation);
      return;
    }

    setErreur('');
    setEnCours(true);
    try {
      const resultat = await confirmerReinitialisationMotDePasseApi(
        identifiantsLien.email,
        identifiantsLien.jeton,
        motDePasse,
        identifiantsLien.slug
      );
      setMessage(resultat?.message || 'Mot de passe modifié. Vous pouvez vous connecter.');
      setTermine(true);
    } catch (err) {
      setErreur(obtenirMessageErreur(err));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <main style={STYLE_CONTENEUR}>
      <h1>Réinitialiser le mot de passe</h1>
      {termine ? (
        <p role="status">
          {message} <a href={urlConnexion}>Se connecter</a>
        </p>
      ) : lienIncomplet ? (
        <p role="alert">Lien incomplet. Demandez un nouveau lien depuis la connexion.</p>
      ) : (
        <form onSubmit={soumettre} style={STYLE_FORMULAIRE}>
          <label>
            Nouveau mot de passe
            <input
              type="password"
              value={motDePasse}
              onChange={event => setMotDePasse(event.target.value)}
              minLength={LONGUEUR_MIN_MOT_DE_PASSE}
              maxLength={LONGUEUR_MAX_MOT_DE_PASSE}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirmer le mot de passe
            <input
              type="password"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              minLength={LONGUEUR_MIN_MOT_DE_PASSE}
              maxLength={LONGUEUR_MAX_MOT_DE_PASSE}
              required
              autoComplete="new-password"
            />
          </label>
          {erreur && <p role="alert">{erreur}</p>}
          <button type="submit" disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Modifier le mot de passe'}
          </button>
        </form>
      )}
    </main>
  );
}
