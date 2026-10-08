import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';

/**
 * HOOK : useDonneesServeur
 * ------------------------------------------------------------
 * Remplace la persistance `localStorage` des données métier par
 * l'API multi-tenant.
 *
 * Principe : le backend est la source de vérité. L'état local n'est
 * qu'un miroir-optimiste qui se resynchronise après chaque écriture.
 *
 * Stratégie de bascule : au premier chargement après connexion, les
 * données locales sont RÉCUPÉRÉES vers l'API pour ne rien perdre.
 * Ensuite, chaque lecture vient du serveur et chaque création est
 * enregistrée côté API.
 */

/* Les identifiants Mongo (_id) sont prioritaires sur les anciens
   identifiants numériques conservés dans localStorage. */
const id = doc => doc?._id || doc?.id;

export default function useDonneesServeur({ connecte, entreprise, cleSuffixe = '' }) {
  const [produits, setProduits] = useState([]);
  const [clients, setClients] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [transports, setTransports] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [abonnements, setAbonnements] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  const entrepriseId = entreprise?.companyId || null;
  const cleMigrationLegacy = entrepriseId ? `erp_legacy_importe_${entrepriseId}` : null;

  /* ------------------------------------------------------------------
     Chargement depuis l'API
     ------------------------------------------------------------------ */
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      const [p, c, v, m, f] = await Promise.all([
        api.listerProduits({ limite: 2000 }),
        api.listerClients(),
        api.listerVentes({ limite: 200 }),
        api.listerMouvements({ limite: 300 }),
        api.listerFournisseurs()
      ]);

      setProduits(p || []);
      setClients(c || []);
      setVentes(v || []);
      setMouvements(m || []);
      setFournisseurs(f || []);

      // Modules complémentaires : leurs échecs ne doivent pas bloquer
      // l'affichage du catalogue principal.
      const [tr, de, ab] = await Promise.allSettled([
        api.listerTransports({ limite: 500 }),
        api.listerDepenses({ limite: 500 }),
        api.listerAbonnements()
      ]);

      if (tr.status === 'fulfilled') setTransports(tr.value || []);
      if (de.status === 'fulfilled') setDepenses(de.value || []);
      if (ab.status === 'fulfilled') setAbonnements(ab.value || []);
    } catch (err) {
      setErreur(api.messageErreur(err));
    } finally {
      setChargement(false);
    }
  }, []);

  /* ------------------------------------------------------------------
     Rappel vers l'API des données locales (première connexion)
     On lit la sauvegarde FIGÉE (erp_legacy_*) : le miroir local
     erp_products* a déjà été écrasé par le rendu courant.
     ------------------------------------------------------------------ */
  const mountLegacy = useCallback(async () => {
    const lire = cle => {
      try {
        return JSON.parse(localStorage.getItem(`erp_legacy_${cle}`) || '[]');
      } catch {
        return [];
      }
    };

    const produitsLocaux = lire('products');
    const clientsLocaux = lire('clients');
    const transportsLocaux = lire('transports');
    const depensesLocales = lire('depenses');
    const fournisseursLocaux = lire('fournisseurs');

    for (const produit of produitsLocaux) {
      // On ignore ceux déjà importés (repérés par la présence d'un _id Mongo).
      if (produit._id && String(produit._id).length === 24) continue;
      try {
        await api.creerProduit({
          ref: produit.ref,
          nom: produit.nom,
          codeBarre: produit.codeBarre || '',
          famille: produit.famille || 'Divers',
          fournisseur: produit.fournisseur || '',
          prixAchat: Number(produit.prixAchat) || 0,
          prix: Number(produit.prix) || 0,
          quantiteStock: Number(produit.quantiteStock) || 0,
          minStock: Number(produit.minStock) || 0,
          maxStock: Number(produit.maxStock) || 0,
          zone: produit.zone || produit.emplacement || 'Zone A',
          classe: produit.classe || 'Classe A'
        });
      } catch {
        // Référence déjà présente : on l'ignore silencieusement.
      }
    }

    for (const client of clientsLocaux) {
      if (client._id && String(client._id).length === 24) continue;
      try {
        await api.creerClient({
          nom: client.nom,
          email: client.email || '',
          telephone: client.telephone || '',
          region: client.region || 'Lagunes',
          ville: client.ville || 'Abidjan',
          district: client.district || ''
        });
      } catch {
        // Client déjà présent.
      }
    }

    for (const transport of transportsLocaux) {
      if (transport._id && String(transport._id).length === 24) continue;
      try {
        await api.creerTransport({
          nomResponsable: transport.nomResponsable || '',
          prenomsResponsable: transport.prenomsResponsable || '',
          vehicule: transport.vehicule || '',
          immatriculation: transport.immatriculation || '',
          nombreVoyage: Number(transport.nombreVoyage) || 1,
          destination: transport.destination || '',
          client: transport.client || '',
          frais: Number(transport.frais) || 0,
          commentaires: transport.commentaires || '',
          date: transport.date || undefined
        });
      } catch {
        // L'import des autres données continue en cas d'échec isolé.
      }
    }

    for (const depense of depensesLocales) {
      if (depense._id && String(depense._id).length === 24) continue;
      try {
        await api.creerDepense({
          libelle: depense.libelle,
          montant: Number(depense.montant) || 0,
          categorie: depense.categorie || 'Fixe',
          date: depense.date || undefined
        });
      } catch {
        // L'import des autres données continue si une dépense est invalide.
      }
    }

    for (const fournisseur of fournisseursLocaux) {
      if (fournisseur?._id && String(fournisseur._id).length === 24) continue;
      try {
        await api.creerFournisseur({
          nom: typeof fournisseur === 'string' ? fournisseur : fournisseur.nom,
          contact: fournisseur.contact || '',
          email: fournisseur.email || '',
          telephone: fournisseur.telephone || '',
          adresse: fournisseur.adresse || '',
          ville: fournisseur.ville || 'Abidjan'
        });
      } catch {
        // Le fournisseur peut déjà exister.
      }
    }

    if (localStorage.getItem('erp_subscribed') === 'true') {
      const palier = localStorage.getItem('erp_subscription_level') || 'Standard';
      const paliersValides = ['Essai', 'Standard', 'Pro', 'Enterprise', 'Transport'];
      if (paliersValides.includes(palier)) {
        try {
          await api.souscrireAbonnement({
            palier,
            prix: 0,
            periode: 'mensuel',
            moyenPaiement: 'Historique local'
          });
        } catch {
          // La souscription locale n'empêche pas la migration des autres modules.
        }
      }
    }

    await charger();
  }, [charger]);

  /* ------------------------------------------------------------------
     Effets
     ------------------------------------------------------------------ */
  useEffect(() => {
    if (!connecte || !entrepriseId) return;

    const demarrer = async () => {
      try {
        await api.listerProduits({ limite: 1 });

        const migrationFaite = cleMigrationLegacy && localStorage.getItem(cleMigrationLegacy) === 'true';
        const clesLegacy = ['products', 'clients', 'transports', 'depenses', 'fournisseurs'];
        const aImporter = clesLegacy.some(cle => {
          const donnees = localStorage.getItem(`erp_legacy_${cle}`);
          return donnees && donnees !== '[]';
        });

        // Importer les anciens modules avant le premier chargement serveur
        // qui remplacerait leur état local. Le marqueur évite les doublons.
        if (!migrationFaite && aImporter) {
          await mountLegacy();
          if (cleMigrationLegacy) localStorage.setItem(cleMigrationLegacy, 'true');
          return;
        }

        await charger();
      } catch (err) {
        setErreur(api.messageErreur(err));
      }
    };

    demarrer();
  }, [connecte, entrepriseId, cleMigrationLegacy, cleSuffixe, charger, mountLegacy]);

  /* ------------------------------------------------------------------
     Écritures optimistes + resynchronisation
     ------------------------------------------------------------------ */
  const avecResync = useCallback(
    async operation => {
      try {
        const resultat = await operation();
        await charger();
        return { ok: true, resultat };
      } catch (err) {
        setErreur(api.messageErreur(err));
        return { ok: false, erreur: api.messageErreur(err) };
      }
    },
    [charger]
  );

  /* ---------- Produits ---------- */

  const ajouterProduit = donnees =>
    avecResync(() => api.creerProduit(donnees));

  const modifierProduitApi = (produitId, donnees) =>
    avecResync(() => api.modifierProduit(produitId, donnees));

  const supprimerProduitApi = produitId =>
    avecResync(() => api.supprimerProduit(produitId));

  const ajusterStock = (produitId, quantite, type, motif, depot) =>
    avecResync(() =>
      api.bougerStock(produitId, {
        type,
        quantite: Number(quantite),
        motif: motif || (type === 'ENTREE' ? 'Entrée manuelle' : 'Sortie manuelle'),
        depot
      })
    );

  const definirStockPhysique = (produitId, quantite) =>
    avecResync(() => api.inventorierProduit(produitId, quantite));

  /* ---------- Clients ---------- */

  const ajouterClient = donnees => avecResync(() => api.creerClient(donnees));

  const modifierClientApi = (clientId, donnees) =>
    avecResync(() => api.modifierClient(clientId, donnees));

  const supprimerClientApi = clientId =>
    avecResync(() => api.supprimerClient(clientId));

  /* ---------- Ventes ---------- */

  const enregistrerVenteApi = donnees =>
    avecResync(() => api.enregistrerVente(donnees));

  const annulerVenteApi = venteId => avecResync(() => api.annulerVente(venteId));

  /* ---------- Fournisseurs ---------- */

  const ajouterFournisseur = donnees =>
    avecResync(() => api.creerFournisseur(donnees));

  const modifierFournisseurApi = (fournisseurId, donnees) =>
    avecResync(() => api.modifierFournisseur(fournisseurId, donnees));

  const supprimerFournisseurApi = fournisseurId =>
    avecResync(() => api.supprimerFournisseur(fournisseurId));

  /* ---------- Transport & Logistique ---------- */

  const ajouterTransport = donnees =>
    avecResync(() => api.creerTransport(donnees));

  const modifierTransportApi = (transportId, donnees) =>
    avecResync(() => api.modifierTransport(transportId, donnees));

  const supprimerTransportApi = transportId =>
    avecResync(() => api.supprimerTransport(transportId));

  /* ---------- Dépenses & Charges ---------- */

  const ajouterDepense = donnees =>
    avecResync(() => api.creerDepense(donnees));

  const modifierDepenseApi = (depenseId, donnees) =>
    avecResync(() => api.modifierDepense(depenseId, donnees));

  const supprimerDepenseApi = depenseId =>
    avecResync(() => api.supprimerDepense(depenseId));

  /* ---------- Abonnements ---------- */

  const souscrireAbonnementApi = donnees =>
    avecResync(() => api.souscrireAbonnement(donnees));

  /* ---------- Recherche scanner ---------- */

  const rechercherParCode = async code => {
    try {
      return { ok: true, produit: await api.rechercherProduitParCode(code) };
    } catch (err) {
      return { ok: false, erreur: api.messageErreur(err) };
    }
  };

  return {
    // lectures
    produits,
    clients,
    ventes,
    mouvements,
    fournisseurs,
    transports,
    depenses,
    abonnements,
    chargement,
    erreur,
    id,
    // écritures
    recharger: charger,
    rechargerDonnees: charger,
    ajouterProduit,
    modifierProduit: modifierProduitApi,
    supprimerProduit: supprimerProduitApi,
    ajusterStock,
    definirStockPhysique,
    ajouterClient,
    modifierClient: modifierClientApi,
    supprimerClient: supprimerClientApi,
    enregistrerVente: enregistrerVenteApi,
    annulerVente: annulerVenteApi,
    ajouterFournisseur,
    modifierFournisseur: modifierFournisseurApi,
    supprimerFournisseur: supprimerFournisseurApi,
    ajouterTransport,
    modifierTransport: modifierTransportApi,
    supprimerTransport: supprimerTransportApi,
    ajouterDepense,
    modifierDepense: modifierDepenseApi,
    supprimerDepense: supprimerDepenseApi,
    souscrireAbonnement: souscrireAbonnementApi,
    rechercherParCode
  };
}