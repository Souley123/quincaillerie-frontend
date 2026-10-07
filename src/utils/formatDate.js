// Les dates ISO serveur sont affichées sans heure ni conversion de fuseau.
export const formatDate = valeur => {
  if (!valeur) return '—';
  const date = String(valeur).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (date) return `${date[3]}/${date[2]}/${date[1]}`;
  const parsed = new Date(valeur);
  return Number.isNaN(parsed.getTime()) ? String(valeur) : parsed.toLocaleDateString('fr-FR');
};
