import { useCallback, useEffect, useState } from 'react';
import {
  joursRestants as joursRestantsEssai,
  estExpire as estExpireAbonnement,
  echeanceEssaiDepuisEntreprise,
  libellePalier,
  relancePaiement
} from '../services/abonnement';
import { moi as apiMoi, messageErreur } from '../services/api';
import { lireCleIsolee, ecrireCleIsolee, lireCleGlobale, ecrireCleGlobale } from '../services/persistance';

/* =========================================================
   PALIERS D'ABONNEMENT
   - 'Essai'   : accès aux modules de base pendant la période d'essai
   - 'Standard': jusqu'à 3 comptes
   - 'Pro'     : jusqu'à 10 comptes + fonctionnalités avancées
   - 'Enterprise' : comptes illimités + trésorerie + caméra
   ========================================================= */
export const PALIERS_ABONNEMENT = {
  Essai: { libelle: 'Essai gratuit', prix: 'Gratuit (5 jours)', comptes: 1, modulesAvances: false, tresorerie: false, cameraEspion: false },
  Standard: { libelle: 'Standard / Boutique', prix: '10 000 FCFA / mois', comptes: 3, modulesAvances: false, tresorerie: false, cameraEspion: false },
  Pro: { libelle: 'Professionnel / ERP', prix: '25 000 FCFA / mois', comptes: 10, modulesAvances: true, tresorerie: false, cameraEspion: false },
  Enterprise: { libelle: 'Enterprise / Master', prix: '45 000 FCFA / mois', comptes: Infinity, modulesAvances: true, tresorerie: true, cameraEspion: true },
  Transport: { libelle: 'Transporteur (Spécial Transport)', prix: '5 000 FCFA / mois', comptes: 3, modulesAvances: false, tresorerie: false, cameraEspion: false, transport: true }
};

// Fonctionnalités avancées réservées aux abonnés Pro (ou comptes illimités)
export const MODULES_NIVEAU_PRO = ['securite', 'comptabilite', 'reports', 'multiDepots'];
export const MODULES_ENTERPRISE = ['tresorerie'];

/* Échéance d'essai initiale.
   CLÉ GLOBALE, volontairement NON isolée par compte : cette valeur sert
   justement quand AUCUNE identité n'est disponible (visiteur déconnecté,
   compte verrouillé). Lire l'ancienne clé isolée en secours évite de perdre
   l'état existant. Aucune échéance n'est réécrite ici : elle est fournie par
   le SERVEUR (apiMoi). */
const lireEcheanceEssaiInitiale = () => null;

/**
 * État, paliers et effets d'abonnement (essai, 402 serveur, resynchronisation).
 */
export default function useAbonnement({ setAuthError }) {
  const [trialExpireDate, setTrialExpireDate] = useState(lireEcheanceEssaiInitiale);

  // Blocage explicite renvoyé par le SERVEUR (402) : l'accès est coupé même si
  // l'horloge locale diverge. L'autorité est toujours le serveur.
  const [abonnementExpireServeur, setAbonnementExpireServeur] = useState(false);

  /* Montant du dernier abonnement PAYÉ connu du serveur (GET /api/abonnements).
     Sert à distinguer un palier payant d'un simple essai. */
  const [abonnementPayeServeur, setAbonnementPayeServeur] = useState(null);

  const [isSubscribed, setIsSubscribed] = useState(() => {
    const global = lireCleGlobale('erp_subscribed');
    return (global !== null ? global : lireCleIsolee('erp_subscribed')) === 'true';
  });

  const [subscriptionLevel, setSubscriptionLevel] = useState(() => {
    const saved = lireCleIsolee('erp_subscription_level');
    if (saved && PALIERS_ABONNEMENT?.[saved]) return saved;
    return 'Essai';
  });

  useEffect(() => {
    ecrireCleIsolee('erp_subscription_level', subscriptionLevel);
  }, [subscriptionLevel]);

  // L'échéance conservée localement ne sert qu'à afficher le compteur et les
  // relances. L'accès est déterminé exclusivement par le statut serveur.
  useEffect(() => {
    if (!trialExpireDate) return undefined;
    const minuterie = window.setTimeout(() => setTrialExpireDate(valeur => valeur), Math.max(0, trialExpireDate - Date.now()));
    return () => window.clearTimeout(minuterie);
  }, [trialExpireDate]);

  /* Resynchronise l'état d'abonnement LOCAL avec l'autorité du serveur.
     Un 402 reçu autrefois laissait erp_trial_expire/erp_subscribed figés dans
     le navigateur, si bien que l'écran de blocage réapparaissait même après
     régularisation. Dès que le serveur confirme un abonnement valide, on lève
     ce verrou local. */
  const resynchroniserAbonnement = useCallback(entreprise => {
    if (!entreprise) return false;
    const echeance = echeanceEssaiDepuisEntreprise(entreprise);
    const statut = String(entreprise.abonnementActuel || '').toLowerCase();
    const encoreValide = statut !== 'expire'
      && entreprise.abonnementActif !== false
      && (echeance === null || echeance > Date.now());
    if (!encoreValide) return false;

    setAbonnementExpireServeur(false);
    setIsSubscribed(true);
    ecrireCleGlobale('erp_subscribed', 'true');
    setTrialExpireDate(echeance);
    return true;
  }, []);

  /* Essai ou abonnement expiré (402 serveur). Le blocage n'est appliqué que si
     le SERVEUR confirme qu'il est encore valable (apiMoi). */
  useEffect(() => {
    const surAbonnementExpire = async event => {
      setSubscriptionLevel('Essai');
      setIsSubscribed(false);
      ecrireCleGlobale('erp_subscribed', 'false');
      if (setAuthError) setAuthError(event.detail?.message || "Votre période d'essai ou d'abonnement est expirée.");
      if (event.detail?.code === 'ESSAI_EXPIRE') {
        setAbonnementExpireServeur(true);
        return;
      }

      /* Le serveur est l'autorité : s'il répond encore qu'un abonnement est
         valide, le message reçu ne doit pas bloquer l'accès. */
      try {
        const moi = await apiMoi();
        if (resynchroniserAbonnement(moi.entreprise)) {
          if (setAuthError) setAuthError('');
          setAbonnementExpireServeur(false);
          return;
        }
      } catch {
        /* Pas de session ou serveur injoignable : on ne grave RIEN. */
      }
      setAbonnementExpireServeur(true);
    };

    window.addEventListener('skys:abonnement-expire', surAbonnementExpire);
    return () => window.removeEventListener('skys:abonnement-expire', surAbonnementExpire);
  }, [resynchroniserAbonnement, setAuthError]);

  /* Bouton « Actualiser mon abonnement » de l'écran de blocage : interroge le
     serveur et lève l'écran si l'abonnement est en réalité encore valide. */
  const actualiserAbonnement = useCallback(async () => {
    if (setAuthError) setAuthError('');
    try {
      const moi = await apiMoi();
      const debloque = resynchroniserAbonnement(moi.entreprise);
      if (!debloque && setAuthError) {
        setAuthError("Votre abonnement n'est pas actif côté serveur. Merci de le régulariser.");
      }
      return moi.entreprise;
    } catch (err) {
      if (setAuthError) setAuthError(messageErreur(err) || 'Impossible de vérifier votre abonnement. Réessayez.');
      return null;
    }
  }, [resynchroniserAbonnement, setAuthError]);

  const palierActif = PALIERS_ABONNEMENT?.[subscriptionLevel] || PALIERS_ABONNEMENT.Essai;
  const aAccesAvance = Boolean(palierActif?.modulesAvances);
  const aAccesTresorerie = Boolean(palierActif?.tresorerie);
  const aAccesCameraEspion = Boolean(palierActif?.cameraEspion);

  const joursRestants = joursRestantsEssai(trialExpireDate);
  const trialExpired = abonnementExpireServeur || (!isSubscribed && estExpireAbonnement(trialExpireDate));
  const abonnementPaye = Number(abonnementPayeServeur) > 0;
  const abonnementActifPaye = isSubscribed && abonnementPaye;
  const libelleStatutAbonnement = abonnementActifPaye
    ? `Abonnement : ${libellePalier(subscriptionLevel)} · Actif`
    : subscriptionLevel !== 'Essai' && abonnementPaye
      ? `Abonnement : ${libellePalier(subscriptionLevel)} · En attente de paiement`
      : `Essai gratuit : ${joursRestants} jour${joursRestants > 1 ? 's' : ''} restant${joursRestants > 1 ? 's' : ''}`;
  const relance = relancePaiement(trialExpireDate, isSubscribed);

  return {
    PALIERS_ABONNEMENT,
    subscriptionLevel,
    setSubscriptionLevel,
    palierActif,
    aAccesAvance,
    aAccesTresorerie,
    aAccesCameraEspion,
    trialExpireDate,
    setTrialExpireDate,
    abonnementExpireServeur,
    setAbonnementExpireServeur,
    abonnementPayeServeur,
    setAbonnementPayeServeur,
    isSubscribed,
    setIsSubscribed,
    joursRestants,
    trialExpired,
    abonnementPaye,
    abonnementActifPaye,
    libelleStatutAbonnement,
    relance,
    resynchroniserAbonnement,
    actualiserAbonnement
  };
}
