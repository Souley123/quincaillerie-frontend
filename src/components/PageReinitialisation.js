import React, { useState } from 'react';
import { confirmerReinitialisationMotDePasseApi } from '../services/api';

export default function PageReinitialisation() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  const jeton = params.get('jeton') || '';
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [termine, setTermine] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const soumettre = async event => {
    event.preventDefault();
    if (motDePasse !== confirmation) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }
    setErreur('');
    setEnCours(true);
    try {
      await confirmerReinitialisationMotDePasseApi(email, jeton, motDePasse);
      setTermine(true);
    } catch (err) {
      setErreur(err.response?.data?.error || 'Réinitialisation impossible. Demandez un nouveau lien.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: '10vh auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Réinitialiser le mot de passe</h1>
      {termine ? <p role="status">Mot de passe modifié. <a href="/">Se connecter</a></p> :
        !email || !jeton ? <p role="alert">Lien incomplet. Demandez un nouveau lien depuis la connexion.</p> : (
          <form onSubmit={soumettre} style={{ display: 'grid', gap: 12 }}>
            <label>Nouveau mot de passe
              <input type="password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} minLength={8} required autoComplete="new-password" />
            </label>
            <label>Confirmer le mot de passe
              <input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={8} required autoComplete="new-password" />
            </label>
            {erreur && <p role="alert">{erreur}</p>}
            <button type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Modifier le mot de passe'}</button>
          </form>
        )}
    </main>
  );
}
