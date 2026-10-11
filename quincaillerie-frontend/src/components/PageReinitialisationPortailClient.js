import React, { useState } from 'react';
import { confirmerReinitialisationPortailClientApi } from '../services/api';

export default function PageReinitialisationPortailClient() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || '';
  const email = params.get('email') || '';
  const jeton = params.get('jeton') || '';
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [termine, setTermine] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const soumettre = async event => {
    event.preventDefault();
    if (enCours) return;
    if (motDePasse.length < 12 || motDePasse.length > 256) {
      setErreur('Le mot de passe doit contenir entre 12 et 256 caractères.');
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await confirmerReinitialisationPortailClientApi({ slug, email, jeton, motDePasse });
      setMessage(resultat.message || 'Mot de passe modifié. Vous pouvez vous connecter.');
      setTermine(true);
    } catch (err) {
      setErreur(err.response?.data?.error || 'Réinitialisation impossible. Demandez un nouveau lien.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <main style={{ maxWidth: 440, margin: '10vh auto', padding: 24, fontFamily: 'sans-serif', color: '#0f172a' }}>
      <h1>Réinitialiser votre mot de passe client</h1>
      {termine ? (
        <p role="status">{message} <a href="/">Retour à la connexion</a></p>
      ) : !slug || !email || !jeton ? (
        <p role="alert">Lien incomplet ou invalide. Demandez un nouveau lien de réinitialisation.</p>
      ) : (
        <form onSubmit={soumettre} style={{ display: 'grid', gap: 14 }}>
          <p>Entreprise : <strong>{slug}</strong></p>
          <label style={{ display: 'grid', gap: 6 }}>
            Nouveau mot de passe
            <input type="password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} minLength={12} maxLength={256} required autoComplete="new-password" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Confirmer le nouveau mot de passe
            <input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={12} maxLength={256} required autoComplete="new-password" />
          </label>
          {erreur && <p role="alert">{erreur}</p>}
          <button type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Modifier le mot de passe'}</button>
        </form>
      )}
    </main>
  );
}
