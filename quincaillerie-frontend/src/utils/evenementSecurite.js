/* Construction centralisée des événements de sécurité.
   Remplace la forme d'objet dupliquée dans les callbacks de capture
   et applique l'unique plafond de 100 entrées. */
const PLAFOND_EVENEMENTS = 100;

/* Normalise un événement de sécurité : complète les champs manquants
   (date, statut, image) puis laisse les valeurs explicites gagner. */
export const construireEvenementSecurite = (champs = {}) => ({
  id: champs.id ?? `${Date.now()}-${Math.random()}`,
  date: champs.date ?? new Date().toLocaleString(),
  utilisateur: champs.utilisateur || 'Utilisateur inconnu',
  type: champs.type || 'Événement de sécurité',
  detail: champs.detail || '',
  niveau: champs.niveau || 'Moyen',
  statut: champs.statut || 'À examiner',
  preuveImage: champs.preuveImage ?? null
});

/* Insère l'événement en tête de liste et applique l'unique plafond de 100 entrées. */
export const ajouterEvenementSecurite = (events, champs) =>
  [construireEvenementSecurite(champs), ...events].slice(0, PLAFOND_EVENEMENTS);

export default { construireEvenementSecurite, ajouterEvenementSecurite };
