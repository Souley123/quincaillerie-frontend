import { useState } from 'react';
import { confirmerReinitialisationMotDePasseApi } from '../services/api';

const LONGUEUR_MIN_MOT_DE_PASSE = 12;
const LONGUEUR_MAX_MOT_DE_PASSE = 256;
const PARAMETRES_SENSIBLES = ['jeton', 'email', 'slug', '__route'];
/* Retour visuel sur la robustesse du mot de passe : un simple compteur
   reste compréhensible, alors qu'une jauge chiffrée ne dit rien à l'utilisateur. */
const evaluerMotDePasse = motDePasse => {
  if (!motDePasse) return { score: 0, libelle: '', couleur: '#e2e8f0' };
  const criteres = [
    motDePasse.length >= 12,
    /[a-z]/.test(motDePasse) && /[A-Z]/.test(motDePasse),
    /\d/.test(motDePasse),
    /[^A-Za-z0-9]/.test(motDePasse)
  ].filter(Boolean).length;
  if (criteres <= 1) return { score: 1, libelle: 'Faible', couleur: '#dc2626' };
  if (criteres === 2) return { score: 2, libelle: 'Moyen', couleur: '#f59e0b' };
  if (criteres === 3) return { score: 3, libelle: 'Bon', couleur: '#0284c7' };
  return { score: 4, libelle: 'Excellent', couleur: '#16a34a' };
};

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

  const robustesse = evaluerMotDePasse(motDePasse);

  return (
    <div className="login-shell" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0284c7 100%)' }}>
      <div className="login-card" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', textAlign: 'center' }}>
        {/* Même en-tête de marque que l'écran de connexion : l'utilisateur
            qui arrive depuis sa boîte mail reconnaît l'application. */}
        <div className="login-brand">
          <div className="login-brand-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <div className="login-brand-texte">
            <span className="login-brand-nom">SKYS ERP</span>
            <span className="login-brand-slogan">Solution de gestion</span>
          </div>
        </div>

        <h1 className="login-title" style={{ color: '#0f172a', fontWeight: 'bold' }}>Réinitialiser le mot de passe</h1>

        {termine ? (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', margin: '6px 0 10px', textAlign: 'left' }}>
            <p role="status" style={{ margin: 0, fontSize: '13px', color: '#166534', fontWeight: 'bold' }}>Mot de passe modifié</p>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#166534' }}>{message}</p>
          </div>
        ) : lienIncomplet ? (
          <div role="alert" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', margin: '6px 0 10px', textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#991b1b' }}>
              Lien incomplet ou déjà utilisé. Demandez un nouveau lien depuis l’écran de connexion.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px' }}>
              Choisissez un mot de passe de 12 caractères minimum.<br />
              {identifiantsLien.email && <>Compte : <strong>{identifiantsLien.email}</strong></>}
            </p>
            <form className="login-form" onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="login-field">
                <label htmlFor="nouveau-mdp" className="login-label">Nouveau mot de passe</label>
                <input
                  id="nouveau-mdp"
                  type="password"
                  value={motDePasse}
                  onChange={event => setMotDePasse(event.target.value)}
                  minLength={LONGUEUR_MIN_MOT_DE_PASSE}
                  maxLength={LONGUEUR_MAX_MOT_DE_PASSE}
                  required
                  autoComplete="new-password"
                  style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                {motDePasse && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '6px 0 8px' }}>
                    <div style={{ display: 'flex', gap: '3px', flex: 1 }} aria-hidden="true">
                      {[1, 2, 3, 4].map(niveau => (
                        <span key={niveau} style={{ height: '4px', flex: 1, borderRadius: '2px', backgroundColor: niveau <= robustesse.score ? robustesse.couleur : '#e2e8f0' }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: robustesse.couleur }}>{robustesse.libelle}</span>
                  </div>
                )}
              </div>
              <div className="login-field">
                <label htmlFor="confirmation-mdp" className="login-label">Confirmer le mot de passe</label>
                <input
                  id="confirmation-mdp"
                  type="password"
                  value={confirmation}
                  onChange={event => setConfirmation(event.target.value)}
                  minLength={LONGUEUR_MIN_MOT_DE_PASSE}
                  maxLength={LONGUEUR_MAX_MOT_DE_PASSE}
                  required
                  autoComplete="new-password"
                  style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                {confirmation && motDePasse !== confirmation && (
                  <span style={{ fontSize: '11.5px', color: '#dc2626', textAlign: 'left', marginTop: '2px' }}>Les mots de passe ne correspondent pas.</span>
                )}
              </div>
              {erreur && <p role="alert" style={{ color: '#ef4444', fontSize: '12px', margin: 0 }}>{erreur}</p>}
              <button className="login-btn" type="submit" disabled={enCours} style={{ backgroundColor: enCours ? '#94a3b8' : '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: enCours ? 'wait' : 'pointer' }}>
                {enCours ? 'Enregistrement…' : 'Modifier le mot de passe'}
              </button>
            </form>
          </>
        )}

        <div className="login-switch">
          <a href={urlConnexion} style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none', fontSize: '12.5px' }}>Retour à la connexion</a>
        </div>
      </div>
    </div>
  );
}
