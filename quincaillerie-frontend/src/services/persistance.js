/**
 * PERSISTANCE LOCALE
 * ------------------------------------------------------------
 * UNE seule implémentation, pilotée par une notion de PORTÉE :
 *
 *   portee: 'compte'  (défaut) — espace isolé du compte courant
 *                                (companyId + email, voir stockageCompte) ;
 *   portee: 'global'           — lié à l'APPAREIL, préfixe `skys_`.
 *
 * Les clés globales décrivent l'appareil (état d'essai, abonnement) : elles
 * doivent rester lisibles quand aucune identité n'est disponible (visiteur
 * déconnecté, compte verrouillé, jeton expiré).
 *
 * Deux formats :
 *   - `lireLocal` / `ecrireLocal` sérialisent en JSON (objets, tableaux) ;
 *   - `lireCleIsolee` / `ecrireCleIsolee` manipulent des chaînes brutes.
 */
import { useEffect, useRef } from 'react';
import { cleIsolee } from './stockageCompte';

export const PORTEES = { COMPTE: 'compte', GLOBAL: 'global' };

const PREFIXE_GLOBAL = 'skys_';

export const lectureLocalePermise = () => typeof window !== 'undefined';

/** Construit la clé réelle pour une portée donnée. */
export const clePersistee = (cle, portee = PORTEES.COMPTE) => (
  portee === PORTEES.GLOBAL ? `${PREFIXE_GLOBAL}${cle}` : cleIsolee(cle)
);

/* ------------------------------------------------------------------ JSON */

/** Lit une valeur JSON. `secours` est renvoyé si absente ou illisible. */
export const lireLocal = (cle, secours, { portee } = {}) => {
  try {
    if (typeof window === 'undefined') return secours;
    const valeur = localStorage.getItem(clePersistee(cle, portee));
    return valeur === null ? secours : JSON.parse(valeur);
  } catch {
    return secours;
  }
};

/** Écrit une valeur JSON. Renvoie false si le stockage refuse (quota, mode privé). */
export const ecrireLocal = (cle, valeur, { portee } = {}) => {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.setItem(clePersistee(cle, portee), JSON.stringify(valeur));
    return true;
  } catch (error) {
    console.warn(`Persistance locale indisponible pour ${cle}:`, error);
    return false;
  }
};

/* --------------------------------------------------------------- CHAÎNES */

/** Lit une chaîne brute (non JSON). */
export const lireCleIsolee = (cle, secours = null, { portee } = {}) => {
  try {
    if (typeof window === 'undefined') return secours;
    const valeur = localStorage.getItem(clePersistee(cle, portee));
    return valeur === null ? secours : valeur;
  } catch {
    return secours;
  }
};

/** Écrit une chaîne brute. */
export const ecrireCleIsolee = (cle, valeur, { portee } = {}) => {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.setItem(clePersistee(cle, portee), String(valeur));
    return true;
  } catch {
    return false;
  }
};

/* ------------------------------------------------------- ALIAS HISTORIQUES */

/* Noms conservés pour les appelants existants (App.js, hooks) : mêmes
   fonctions, mêmes signatures — aucune duplication d'implémentation. */
export const lireStockageLocal = (cle, secours) => lireLocal(cle, secours);
export const enregistrerStockageLocal = (cle, valeur) => ecrireLocal(cle, valeur);
export const lireCleGlobale = (cle, secours = null) => lireCleIsolee(cle, secours, { portee: PORTEES.GLOBAL });
export const ecrireCleGlobale = (cle, valeur) => ecrireCleIsolee(cle, valeur, { portee: PORTEES.GLOBAL });

/* ----------------------------------------------------------------- HOOKS */

/**
 * Persiste `valeur` sous `cle` tant que `actif` est vrai.
 * Sert au mode DÉMO : hors session serveur, le catalogue, les clients, les
 * mouvements… sont conservés entre deux ouvertures du navigateur. Dès qu'une
 * session est ouverte, le serveur devient la vérité et rien n'est réécrit.
 *
 * @param {string} cle
 * @param {*} valeur
 * @param {boolean} actif   généralement `!isAuthenticated`
 */
export function usePersistanceDemo(cle, valeur, actif) {
  // Évite d'écraser une valeur fraîchement lue au tout premier rendu.
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    if (!actif) return;
    ecrireLocal(cle, valeur);
  }, [cle, valeur, actif]);
}

/** Variante pour une valeur texte (préférences simples, compteurs). */
export function usePersistanceDemoCle(cle, valeur, actif) {
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    if (!actif) return;
    ecrireCleIsolee(cle, valeur);
  }, [cle, valeur, actif]);
}
