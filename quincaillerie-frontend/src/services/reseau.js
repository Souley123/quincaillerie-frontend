/**
 * Résilience réseau côté client.
 * Les appels métier en écriture ne sont jamais rejoués automatiquement.
 */
export const avecRepriseLecture = async (operation, { tentativesMax = 2, delaiInitialMs = 500 } = {}) => {
  let tentative = 0;

  for (;;) {
    try {
      return await operation();
    } catch (erreur) {
      const statut = erreur?.response?.status;
      const panneTransport = !erreur?.response || [502, 503, 504].includes(statut);
      if (!panneTransport || tentative >= tentativesMax) throw erreur;

      const delai = delaiInitialMs * (2 ** tentative) + Math.floor(Math.random() * 250);
      tentative += 1;
      await new Promise(resolve => setTimeout(resolve, delai));
    }
  }
};
