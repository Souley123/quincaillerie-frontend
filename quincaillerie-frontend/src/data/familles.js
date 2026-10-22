/* Familles de référence du catalogue et normalisation des libellés.
   Partagés par App.js, useCategories et les modules qui affichent le stock. */

export const FAMILLES_PRODUITS = [
  "Quincaillerie de fixation",
  "Outillage manuel",
  "Outillage électroportatif",
  "Électricité",
  "Plomberie",
  "Peinture et finition",
  "Matériaux légers",
  "Métallerie et soudure",
  "Menuiserie et serrurerie",
  "Équipements de protection individuelle",
  "Jardinage",
  "Produits chimiques",
  "Gaz butane",
  "Bouteilles et accessoires gaz",
  "Alimentation générale",
  "Boissons",
  "Hygiène et entretien",
  "Papeterie",
  "Électronique",
  "Divers"
];

/* Normalise le nom d'une famille (catégorie) pour comparer sans se tromper :
   casse ignorée, accents retirés, espaces superflus supprimés. Ainsi un
   article rangé dans « matelas », « Matelas » ou « Matelas  » est toujours
   rattaché à la même famille dans le tableau de bord. */
export const normaliserFamille = valeur => String(valeur || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

/* Familles dédoublonnées sur leur forme normalisée, en conservant le premier
   libellé rencontré (ordre de la liste d'entrée). */
export const dedoublonnerFamilles = liste => {
  const vues = new Set();
  const resultat = [];
  (liste || []).filter(Boolean).forEach(famille => {
    const cle = normaliserFamille(famille);
    if (cle && !vues.has(cle)) {
      vues.add(cle);
      resultat.push(famille);
    }
  });
  return resultat;
};
