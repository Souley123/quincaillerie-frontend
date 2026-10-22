const MOTIFS = [
  { valeur: 'gradient', libelle: 'Dégradé subtil Corporate' },
  { valeur: 'clean', libelle: 'Minimaliste & Bordure élégante' },
  { valeur: 'glass', libelle: 'Effet SaaS Moderne (Glass)' }
];

const lireCouleur = cle => {
  try {
    const valeur = localStorage.getItem(cle);
    return /^#[\da-f]{6}$/i.test(valeur || '') ? valeur : null;
  } catch {
    return null;
  }
};

const ecrireCouleur = (cle, valeur) => {
  try { localStorage.setItem(cle, valeur); } catch { /* stockage facultatif */ }
};

export const lirePreferencesBanniere = () => {
  let motif = 'gradient';
  try {
    const enregistre = localStorage.getItem('skys_banner_motif');
    if (MOTIFS.some(option => option.valeur === enregistre)) motif = enregistre;
  } catch { /* stockage facultatif */ }
  return { motif, couleur: lireCouleur('skys_banner_accent') || '#0284c7' };
};

export const lireCouleursBanniere = () => ({
  accent: lireCouleur('skys_banner_accent') || '#0284c7',
  fond: lireCouleur('skys_banner_fond') || '#eff6ff',
  texte: lireCouleur('skys_banner_texte') || '#1e293b'
});

export default function PersonnalisationBanniere({ publicite, setPublicite }) {
  const preferences = lirePreferencesBanniere();
  const couleurs = lireCouleursBanniere();
  const motif = MOTIFS.some(option => option.valeur === publicite.motif) ? publicite.motif : preferences.motif;

  const modifierMotif = evenement => {
    const valeur = evenement.target.value;
    try { localStorage.setItem('skys_banner_motif', valeur); } catch { /* stockage facultatif */ }
    setPublicite(actuelle => ({ ...actuelle, motif: valeur }));
  };
  const modifierCouleur = (cle, propriete) => evenement => {
    const valeur = evenement.target.value;
    ecrireCouleur(cle, valeur);
    setPublicite(actuelle => ({
      ...actuelle,
      couleurs: { ...lireCouleursBanniere(), ...(actuelle.couleurs || {}), [propriete]: valeur }
    }));
  };

  return (
    <div className="banner-settings-controls">
      <label className="banner-motif-control">
        <span>Style du bandeau</span>
        <select id="bannerMotifSelect" value={motif} onChange={modifierMotif}>
          <option value="clean">Minimaliste &amp; bordure élégante</option>
          <option value="gradient">Dégradé subtil corporate</option>
          <option value="glass">Effet SaaS moderne (Glass)</option>
        </select>
      </label>
      <div className="banner-color-controls" aria-label="Couleurs de la bannière">
        <label>
          <input id="bannerColorPicker" type="color" value={couleurs.accent} onChange={modifierCouleur('skys_banner_accent', 'accent')} />
          <span>Accent</span>
        </label>
        <label>
          <input id="bannerBgPicker" type="color" value={couleurs.fond} onChange={modifierCouleur('skys_banner_fond', 'fond')} />
          <span>Arrière-plan</span>
        </label>
        <label>
          <input id="bannerTextPicker" type="color" value={couleurs.texte} onChange={modifierCouleur('skys_banner_texte', 'texte')} />
          <span>Texte</span>
        </label>
      </div>
    </div>
  );
}
