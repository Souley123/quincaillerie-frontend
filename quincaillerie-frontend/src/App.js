﻿import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logoImage from './Assets/logo-fond-transparent.png';
import logoSombre from './Assets/logo-fond-sombre.png';
import MontrePro from './components/MontrePro';
import CameraEspion from './components/CameraEspion';
import TresorerieEpargne from './components/TresorerieEpargne';

import { DISTRICTS_CI, STATS_GEO } from './data/geographie-ci';
import { REGIONS_VILLES_CI, VILLES_DESTINATION_CI } from './data/villes-ci';
import { PAYS_AFRIQUE_PAR_REGION } from './data/pays-afrique';

import ChatbotAssistant from './components/ChatbotAssistant';
import { Icone, MARQUES, PastilleMobileMoney } from './components/Icones';
import useDonneesServeur from './hooks/useDonneesServeur';
import {
  connexion as apiConnexion,
  inscriptionEntreprise as apiInscription,
  moi as apiMoi,
  enregistrerSession,
  effacerSession,
  lireJeton,
  lireEntreprise,
  messageErreur,
  listerUtilisateursApi,
  creerUtilisateurApi,
  supprimerUtilisateurApi,
  debloquerUtilisateurApi,
  demanderReinitialisationMotDePasseApi,
  changerMotDePasseApi,
  verifierEmailApi,
  renvoyerVerificationEmailApi,
  verifierPaiementApi,
  configPaiementPubliqueApi,
  alerterSecurite
} from './services/api';
import { capturerFurtivement } from './services/captureEspion';
import { demarrerSurveillanceInactivite } from './services/surveillanceInactivite';
import { demarrerAnalyseVisuelle } from './services/detectionVisuelle';
import {
  lirePreferences as lirePrefsA11y,
  enregistrerPreferences as enregistrerPrefsA11y,
  appliquerPreferences as appliquerPrefsA11y,
  annoncer as annoncerA11y,
  alerteVisuelle as alerteVisuelleA11y,
  lirePage as lirePageA11y,
  arreterLecture as arreterLectureA11y,
  demarrerLectureAuto as demarrerLectureAutoA11y,
  arreterLectureAuto as arreterLectureAutoA11y,
  lireNouvelEcran as lireNouvelEcranA11y,
  lireInfo as lireInfoA11y
} from './services/accessibilite';
import { apiUrl } from './services/apiUrl';
import { translations } from './i18n/translations';
import Clients from './modules/Clients';
import Stock from './modules/Stock';
import Caisse from './modules/Caisse';
import Rapports from './modules/Rapports';
import Surveillance from './modules/Surveillance';
import { ajouterEvenementSecurite } from './utils/evenementSecurite';
import {
  cleIsolee,
  effacerDonneesCompte,
  migrerAnciennesCles
} from './services/stockageCompte';
import { confirmer, alerter, demander, imprimer } from './services/dialogues';
import {
  MENTIONS_LEGALES_PAR_DEFAUT,
  REGIMES_FISCAUX_CI,
  TAUX_TVA_CI,
  construireMentionsLegales,
  verifierConformite,
  TEXTES_INSCRIPTION
} from './services/mentionsLegales';
import {
  demarrerTousCapteurs,
  demanderAutorisationsCapteurs,
  capteursDisponibles
} from './services/capteurs';
import {
  PAIEMENT_COMMERCANT_PAR_DEFAUT,
  COMPTE_DEVELOPPEUR,
  verifierReferencesCommercant,
  configKkiapayVente,
  resumerPaiementsCommercant
} from './services/paiements';
import {
  DUREE_ESSAI_JOURS,
  PALIERS,
  libellePalier,
  joursRestants as joursRestantsEssai,
  estExpire as estExpireAbonnement,
  relancePaiement,
  lienContactCommercial
} from './services/abonnement';

const FAMILLES_PRODUITS = [
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

/* =========================================================
     VENTE DE GAZ — Référentiel professionnel
     Bouteilles butane normalisées (Côte d'Ivoire) avec
     contenance, poids et consigne (caution bouteille).
     ========================================================= */
const BOUTEILLES_GAZ = [
  { code: 'B6',  libelle: 'Bouteille 6 kg',  poidsKg: 6,  prixConsigne: 5000 },
  { code: 'B9',  libelle: 'Bouteille 9 kg',  poidsKg: 9,  prixConsigne: 7500 },
  { code: 'B12', libelle: 'Bouteille 12 kg', poidsKg: 12, prixConsigne: 10000 },
  { code: 'B15', libelle: 'Bouteille 15 kg', poidsKg: 15, prixConsigne: 12000 },
  { code: 'B38', libelle: 'Bouteille 38 kg', poidsKg: 38, prixConsigne: 25000 }
];

/* Recharges proposées au litre/kg et prestations annexes. */
const PRESTATIONS_GAZ = [
  'Recharge bouteille',
  'Vente bouteille neuve',
  'Consigne bouteille (caution)',
  'Reprise bouteille vide',
  'Livraison à domicile',
  'Kit détendeur + tuyau'
];

/* =========================================================
     LISTES COMPLÈTES : Préfectures / Départements et
     Villes / Chefs-lieux de la Côte d'Ivoire (14 districts)
     ========================================================= */

const REGIONS_VILLES = REGIONS_VILLES_CI;
const REGION_CLIENT_INITIALE = "District Autonome d'Abidjan";
const CLIENT_INITIAL = { nom: '', email: '', telephone: '', region: REGION_CLIENT_INITIALE, ville: 'Abidjan' };

/* Normalise le nom d'une famille (catégorie) pour comparer sans se tromper :
   casse ignorée, accents retirés, espaces superflus supprimés. Ainsi un
   article rangé dans « matelas », « Matelas » ou « Matelas  » est toujours
   rattaché à la même famille dans le tableau de bord. */
const normaliserFamille = valeur => String(valeur || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

// Dates ISO serveur affichées sans heure ni conversion de fuseau.
const formatDate = valeur => {
  if (!valeur) return '—';
  const date = String(valeur).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (date) return `${date[3]}/${date[2]}/${date[1]}`;
  const parsed = new Date(valeur);
  return Number.isNaN(parsed.getTime()) ? String(valeur) : parsed.toLocaleDateString('fr-FR');
};

const ouvrirBaseDossiers = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible dans cet environnement.'));
      return;
    }

    const request = indexedDB.open('quincaillerie-db', 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('dossiers')) {
        db.createObjectStore('dossiers', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const lireDossiersEnregistres = async () => {
  const db = await ouvrirBaseDossiers();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction('dossiers', 'readonly')
      .objectStore('dossiers')
      .getAll();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
};

const enregistrerDossier = async dossier => {
  const db = await ouvrirBaseDossiers();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('dossiers', 'readwrite');
    transaction.objectStore('dossiers').put(dossier);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};

const supprimerDossierEnregistre = async id => {
  const db = await ouvrirBaseDossiers();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('dossiers', 'readwrite');
    transaction.objectStore('dossiers').delete(id);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};


function PaymentLogo({ logo, size = 42 }) {
  const styles = {
    width: size,
    height: size,
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: size * 0.35,
    color: '#334155',
    margin: '0 auto 4px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
  };

  const logoMap = {
    cash: { label: 'CASH', src: '' },
    visa: { label: 'VISA', src: '/assets/visa.png', fallback: 'https://cdn.simpleicons.org/visa/1a1f71' },
    mastercard: { label: 'MASTERCARD', src: '/assets/mastercard.png', fallback: 'https://cdn.simpleicons.org/mastercard/eb001b' },
    amex: { label: 'AMEX', src: '/assets/amex.png', fallback: 'https://cdn.simpleicons.org/americanexpress/2e77bc' },
    wave: { label: 'WAVE', src: '/assets/wave.png', fallback: 'https://cdn.simpleicons.org/wave/0ea5e9' },
    orange: { label: 'ORANGE MONEY', src: '/assets/orange-money.png', fallback: 'https://cdn.simpleicons.org/orange/f97316' },
    moov: { label: 'MOOV MONEY', src: '/assets/moov-money.png', fallback: 'https://cdn.simpleicons.org/moov/22c55e' },
    mtn: { label: 'MTN MONEY', src: '/assets/mtn-money.png', fallback: 'https://cdn.simpleicons.org/mtn/eab308' }
  };

  const current = logoMap[logo] || { label: 'PAY', src: '' };

  return <div style={styles}>
    {current.src && (
      <img
        src={current.src}
        alt={`Logo ${current.label}`}
        width={size - 12}
        height={size - 12}
        loading="lazy"
        onError={event => {
          if (current.fallback && !event.currentTarget.dataset.fallbackApplied) {
            event.currentTarget.dataset.fallbackApplied = 'true';
            event.currentTarget.src = current.fallback;
            return;
          }
          event.currentTarget.style.display = 'none';
          if (event.currentTarget.nextElementSibling) event.currentTarget.nextElementSibling.style.display = 'block';
        }}
      />
    )}
    <span style={{ display: current.src ? 'none' : 'block', fontSize: size * 0.25 }}>{current.label}</span>
  </div>;
}

/* ========================================================= */
function SkysLogo({ centered = false, largeur = 170, sombre = false, legende = '' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: centered ? 'center' : 'flex-start', justifyContent: centered ? 'center' : 'flex-start', width: '100%' }}>
      <img
        src={sombre ? logoSombre : logoImage}
        alt="Logo SKYS ERP Solution"
        style={{ display: 'block', width: `${largeur}px`, maxWidth: '100%', maxHeight: '110px', height: 'auto', objectFit: 'contain' }}
      />
      {legende ? (
        <span
          className={sombre ? 'skys-logo-legende skys-logo-legende--sombre' : 'skys-logo-legende'}
          style={{ marginTop: '6px', fontWeight: 'bold', textAlign: 'center', width: '100%' }}
        >
          {legende}
        </span>
      ) : null}
    </div>
  );
}

const MODULES_AUTORISES_PAR_ROLE = {
  Administrateur: ['dashboard', 'quincaillerie', 'multiDepots', 'transaction', 'gaz', 'recherche', 'mouvements', 'reappro', 'achats', 'depenses', 'devis', 'inventaire', 'transport', 'clients', 'credits', 'dossiers', 'paiements', 'abonnements', 'comptabilite', 'reports', 'securite', 'tresorerie', 'parametresGeneraux', 'notes', 'versions', 'aide'],
  Caissier: ['transaction', 'gaz', 'recherche', 'devis', 'clients', 'credits', 'paiements', 'notes', 'versions', 'aide'],
  Magasinier: ['quincaillerie', 'multiDepots', 'recherche', 'mouvements', 'reappro', 'achats', 'inventaire', 'notes', 'versions', 'aide']
};

/* Modules sensibles protégés par un mot de passe dédié, comme la trésorerie.
   Le libellé sert à l'écran de déverrouillage et au lecteur d'écran. */
const MODULES_SENSIBLES = {
  comptabilite: 'Comptabilité automatique',
  reports: 'Rapports & Indicateurs KPI',
  credits: 'Crédits & Dettes clients',
  depenses: 'Gestion des Dépenses & Charges'
};

const cleLocale = cle => cleIsolee(cle);
// Les données locales sont isolées PAR COMPTE (companyId + email).
// Un utilisateur non connecté (mode démo) dispose d'un espace « demo »
// distinct ; une session authentifiée utilise le serveur comme vérité.
const lectureLocalePermise = () => typeof window !== 'undefined';

const lireStockageLocal = (cle, secours) => {
  try {
    if (typeof window === 'undefined') return secours;
    const valeur = localStorage.getItem(cleLocale(cle));
    return valeur === null ? secours : JSON.parse(valeur);
  } catch {
    return secours;
  }
};

const enregistrerStockageLocal = (cle, valeur) => {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.setItem(cleLocale(cle), JSON.stringify(valeur));
    return true;
  } catch (error) {
    console.warn(`Persistance locale indisponible pour ${cle}:`, error);
    return false;
  }
};

/* Accès directs isolés par compte : pour les valeurs simples (chaînes) qui
   étaient auparavant stockées sans préfixe et donc partagées entre comptes. */
const lireCleIsolee = (cle, secours = null) => {
  try {
    if (typeof window === 'undefined') return secours;
    const valeur = localStorage.getItem(cleIsolee(cle));
    return valeur === null ? secours : valeur;
  } catch {
    return secours;
  }
};

const ecrireCleIsolee = (cle, valeur) => {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.setItem(cleIsolee(cle), String(valeur));
    return true;
  } catch {
    return false;
  }
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(lireJeton()));
  /* Un jeton local ne prouve RIEN : seule la vérification serveur (apiMoi)
     fait autorité. Tant qu'elle n'a pas répondu, on n'affiche ni l'ERP ni la
     page de connexion, mais un écran d'attente — sinon le tableau de bord
     apparaît brièvement avant la connexion. */
  const [sessionEnVerification, setSessionEnVerification] = useState(() => Boolean(lireJeton()));
  const [searchTermInput, setSearchTermInput] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanHistory, setScanHistory] = useState(() => lireStockageLocal('erp_scan_history', []));
  const scannerInputRef = useRef(null);
  const barcodeInputRef = useRef('');
  const scanBufferRef = useRef('');
  const scanLastKeyTimeRef = useRef(0);
  const [accesTresorerie, setAccesTresorerie] = useState(false);
  const [mouvementSubTab, setMouvementSubTab] = useState('ENTREE');
  const [mouvements, setMouvements] = useState(() => lireStockageLocal('erp_mouvements', []));
  const [scanResult, setScanResult] = useState(null);
  const [, setDerniereTransaction] = useState(null);
  const [confirmationAdmin, setConfirmationAdmin] = useState('');
  const [motDePasseTresorerie, setMotDePasseTresorerie] = useState(() => lireStockageLocal('erp_tresorerie_mdp', null));
  const [motDePasseTresorerieConfirme, setMotDePasseTresorerieConfirme] = useState('');
  const [erreurAdmin, setErreurAdmin] = useState('');
  const verrouTresorerieTimer = useRef(null);

  /* Modules sensibles protégés par un mot de passe dédié (comme la trésorerie).
     `modulesDebloques` mémorise les modules ouverts pendant la session. */
  const [modulesDebloques, setModulesDebloques] = useState([]);
  const [motDePasseModules, setMotDePasseModules] = useState(() => lireStockageLocal('erp_modules_mdp', null));
  const [motDePasseModulesConfirme, setMotDePasseModulesConfirme] = useState('');
  const [saisieModule, setSaisieModule] = useState('');
  const [erreurModule, setErreurModule] = useState('');
  const [moduleEnVerification, setModuleEnVerification] = useState(null);
  const verrouModuleTimer = useRef(null);
  const [isRegistering, setIsRegistering] = useState(false);
  /* Acceptation des conditions générales (obligatoire à l'inscription,
     conformément à la réglementation ivoirienne sur le commerce électronique). */
  const [accepteConditions, setAccepteConditions] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authNom, setAuthNom] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState(() => lireEntreprise()?.utilisateur?.role || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSlug, setResetSlug] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return lireEntreprise()?.entreprise?.slug || params.get('entreprise') || '';
  });
  const [resetEnvoye, setResetEnvoye] = useState(false);
  const [resetEnCours, setResetEnCours] = useState(false);
  const [authError, setAuthError] = useState('');
  /* Changement de mot de passe imposé à la première connexion (mot de passe
     temporaire généré par l'administrateur). */
  const [doitChangerMotDePasse, setDoitChangerMotDePasse] = useState(false);
  const [nouveauMotDePasseObligatoire, setNouveauMotDePasseObligatoire] = useState('');
  const [confirmationNouveauMotDePasse, setConfirmationNouveauMotDePasse] = useState('');
  const [erreurChangement, setErreurChangement] = useState('');
  /* Compteur purement informatif côté interface; les décisions de verrouillage
     sont exclusivement prises et persistées par le serveur. */
  const [tentativesConnexion, setTentativesConnexion] = useState(0);
  /* Autorisation ponctuelle de l'administrateur pour agir sur les dépenses
     sans déclencher l'alerte/capture (valable le temps de la session). */
  const [autorisationDepenses, setAutorisationDepenses] = useState(false);
  /* Panneau de surveillance globale : un œil accessible depuis n'importe
     quel module, pour l'administrateur disposant de l'option caméra. */
  const [surveillanceGlobaleOuverte, setSurveillanceGlobaleOuverte] = useState(false);
  /* Verrouillage automatique par inactivité : avertissement puis déconnexion
     forcée avec retour à l'écran de connexion. */
  const [avertissementInactivite, setAvertissementInactivite] = useState(null);
  const [raisonVerrouillage, setRaisonVerrouillage] = useState('');
  /* Durée d'inactivité avant verrouillage : configurable par l'administrateur
     (5 à 10 minutes), avec repli sur 10 minutes. L'avertissement s'affiche à
     mi-parcours. MINUTEUR_POLL_VISUEL_MS rythme l'analyse caméra discrète. */
  const MINUTEUR_POLL_VISUEL_MS = 120000;
  // Session multi-tenant : identité et entreprise renvoyées par le backend.
  const [utilisateurCourant, setUtilisateurCourant] = useState(() => lireEntreprise()?.utilisateur || null);
  const [entrepriseCourante, setEntrepriseCourante] = useState(() => lireEntreprise()?.entreprise || null);
  const [sousDomaine, setSousDomaine] = useState(() => {
    if (typeof window === 'undefined') return '';
    if (window.location.hostname.endsWith('skyserp.com')) return window.location.hostname.split('.')[0];
    const params = new URLSearchParams(window.location.search);
    return lireEntreprise()?.entreprise?.slug || params.get('entreprise') || '';
  });
  const [paysActif, setPaysActif] = useState("Côte d'Ivoire");
  const [depotActif, setDepotActif] = useState("Dépôt Principal");
  const [openSubMenus, setOpenSubMenus] = useState({});
  // Menu latéral en mode "tiroir" (drawer) sur mobile : masqué par défaut,
  // ouvert via le bouton hamburger, refermé après le choix d'un module.
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false);

  const PAYS_DEVISES = {
    "Côte d'Ivoire": { devise: "FCFA" },
    France: { devise: "EUR" },
    Sénégal: { devise: "FCFA" }
  };

  const DEPOTS_LISTE = [
    "Dépôt Principal",
    "Dépôt Secondaire",
    "Magasin Centre-Ville"
  ];

  const [usersList, setUsersList] = useState([]);
  const [chargementUtilisateurs, setChargementUtilisateurs] = useState(false);
  const [erreurChargementUtilisateurs, setErreurChargementUtilisateurs] = useState('');
  const [depensesPersonnelles, setDepensesPersonnelles] = useState(() => {
    const saved = lireStockageLocal('erp_depenses_personnelles', null);
    return saved || [
      { id: 1, libelle: 'Retrait personnel mensuel', montant: 120000, categorie: 'Retrait personnel', date: new Date().toISOString().slice(0, 10) }
    ];
  });
  const [notesList, setNotesList] = useState(() => lireStockageLocal('erp_notes', []));
  const [noteForm, setNoteForm] = useState({ titre: '', contenu: '' });
  const [depensesList, setDepensesList] = useState(() => lireStockageLocal('erp_depenses', [
    { id: 1, libelle: 'Loyer Magasin', montant: 250000, categorie: 'Fixe', date: '2026-09-01' },
    { id: 2, libelle: 'Facture Électricité', montant: 75000, categorie: 'Fixe', date: '2026-09-05' }
  ]));
  const [editingDepenseId, setEditingDepenseId] = useState(null);
  const [depenseForm, setDepenseForm] = useState({ libelle: '', montant: '', categorie: 'Fixe', date: new Date().toISOString().split('T')[0] });
  const [seuilCritique, setSeuilCritique] =   useState(() => Number(lireStockageLocal('erp_seuil_critique', 100000)));
  const [epargneCible, setEpargneCible] = useState(() => Number(lireStockageLocal('erp_epargne_cible', 500000)));

  useEffect(() => {
    if (isAuthenticated) return;
    enregistrerStockageLocal('erp_depenses_personnelles', depensesPersonnelles);
    enregistrerStockageLocal('erp_seuil_critique', seuilCritique);
    enregistrerStockageLocal('erp_epargne_cible', epargneCible);
  }, [depensesPersonnelles, seuilCritique, epargneCible, isAuthenticated]);

  const [invitationCompte, setInvitationCompte] = useState(null);
  const [userForm, setUserForm] = useState({ nom: '', email: '', role: 'Caissier', motDePasse: '' });

  useEffect(() => {
    if (isAuthenticated && utilisateurCourant?.role === 'Administrateur') {
      let annule = false;
      setChargementUtilisateurs(true);
      setErreurChargementUtilisateurs('');
      listerUtilisateursApi()
        .then(liste => {
          if (!annule) setUsersList(Array.isArray(liste) ? liste : []);
        })
        .catch(error => {
          if (annule) return;
          setUsersList([]);
          setErreurChargementUtilisateurs(messageErreur(error));
        })
        .finally(() => { if (!annule) setChargementUtilisateurs(false); });
      return () => { annule = true; };
    }
    setUsersList([]);
    setErreurChargementUtilisateurs('');
    return undefined;
  }, [isAuthenticated, currentUserRole, utilisateurCourant?.role]);

  /* ------------------------------------------------------------------
     VÉRIFICATION DE L'ADRESSE EMAIL
     Le mail de vérification contient un lien « ?verifierEmail=...&email=... ».
     Au chargement, on détecte ce lien, on confirme auprès du serveur, puis on
     nettoie l'URL. Tant que l'adresse n'est pas vérifiée, un bandeau invite à
     le faire (protection anti-adresses jetables / essais multiples). */
  const [emailVerifie, setEmailVerifie] = useState(true);
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [messageVerification, setMessageVerification] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const parametres = new URLSearchParams(window.location.search);
    const jeton = parametres.get('verifierEmail');
    const emailCible = parametres.get('email');
    if (!jeton || !emailCible) return undefined;

    let annule = false;
    const urlNettoyee = new URL(window.location.href);
    urlNettoyee.searchParams.delete('verifierEmail');
    urlNettoyee.searchParams.delete('email');
    window.history.replaceState({}, '', urlNettoyee.toString());
    setVerificationEnCours(true);
    verifierEmailApi(emailCible, jeton)
      .then(resultat => {
        if (annule) return;
        setEmailVerifie(Boolean(resultat?.verifie));
        setMessageVerification(resultat?.message || (resultat?.verifie ? 'Adresse e-mail confirmée.' : 'Lien invalide ou expiré.'));
      })
      .catch(() => {
        if (!annule) setMessageVerification('Vérification impossible pour le moment. Réessayez plus tard.');
      })
      .finally(() => {
        if (annule) return;
        setVerificationEnCours(false);
      });

    return () => { annule = true; };
  }, []);

  /* Reflète l'état de vérification renvoyé par le serveur (apiMoi). */
  useEffect(() => {
    if (utilisateurCourant && utilisateurCourant.emailVerifie === false) {
      setEmailVerifie(false);
    }
  }, [utilisateurCourant]);

  /* Le serveur a refusé une requête protégée (403 EMAIL_NON_VERIFIE) :
     l'adresse e-mail n'est pas confirmée. On force l'affichage du bandeau
     de vérification sans attendre le prochain apiMoi(). */
  useEffect(() => {
    const surEmailNonVerifie = () => setEmailVerifie(false);
    window.addEventListener('skys:email-non-verifie', surEmailNonVerifie);
    return () => window.removeEventListener('skys:email-non-verifie', surEmailNonVerifie);
  }, []);

  const [trialExpireDate, setTrialExpireDate] = useState(() => {
    const saved = lireCleIsolee('erp_trial_expire');
    if (saved) return Number(saved);
    /* FAILLE CORRIGÉE : auparavant, l'absence de la clé locale recréait
       systématiquement 3 jours d'essai. Vider le stockage du navigateur
       donnait donc un essai gratuit ILLIMITÉ. On ne pose plus de nouvelle
       échéance ici : elle est fournie par le SERVEUR (via apiMoi) et, à
       défaut, on marque l'essai comme déjà consommé pour ne pas l'offrir
       une seconde fois au même navigateur. */
    const dejaConsomme = lireCleIsolee('erp_essai_consomme') === 'true';
    if (dejaConsomme) {
      // Essai déjà utilisé : aucune nouvelle fenêtre gratuite.
      return Date.now() - 1000;
    }
    ecrireCleIsolee('erp_essai_consomme', 'true');
    const expireTime = Date.now() + DUREE_ESSAI_JOURS * 24 * 60 * 60 * 1000;
    ecrireCleIsolee('erp_trial_expire', expireTime);
    return expireTime;
  });

  // Blocage explicite renvoyé par le SERVEUR (402) : l'accès est coupé même si
  // l'horloge locale diverge. L'autorité est toujours le serveur.
  const [abonnementExpireServeur, setAbonnementExpireServeur] = useState(false);

  const [isSubscribed, setIsSubscribed] = useState(() => lireCleIsolee('erp_subscribed') === 'true');

  /* =========================================================
     NIVEAU D'ABONNEMENT (subscriptionLevel)
     - 'Essai'   : accès aux modules de base pendant la période d'essai
     - 'Solo'    : 1 compte
     - 'Standard': jusqu'à 5 comptes
     - 'Pro'     : comptes illimités + fonctionnalités avancées
     ========================================================= */
  const PALIERS_ABONNEMENT = {
    Essai: { libelle: 'Essai gratuit', prix: 'Gratuit (3 jours)', comptes: 1, modulesAvances: false, tresorerie: false, cameraEspion: false },
    Standard: { libelle: 'Standard / Boutique', prix: '10 000 FCFA / mois', comptes: 3, modulesAvances: false, tresorerie: false, cameraEspion: false },
    Pro: { libelle: 'Professionnel / ERP', prix: '25 000 FCFA / mois', comptes: 10, modulesAvances: true, tresorerie: false, cameraEspion: false },
    Enterprise: { libelle: 'Enterprise / Master', prix: '45 000 FCFA / mois', comptes: Infinity, modulesAvances: true, tresorerie: true, cameraEspion: true },
    Transport: { libelle: 'Transporteur (Spécial Transport)', prix: '5 000 FCFA / mois', comptes: 3, modulesAvances: false, tresorerie: false, cameraEspion: false, transport: true }
    };

    const [subscriptionLevel, setSubscriptionLevel] = useState(() => {
      const saved = lireCleIsolee('erp_subscription_level');
      if (saved && PALIERS_ABONNEMENT?.[saved]) return saved;
      return 'Essai';
    });

  useEffect(() => {
    ecrireCleIsolee('erp_subscription_level', subscriptionLevel);
  }, [subscriptionLevel]);

  // Fonctionnalités avancées réservées aux abonnés Pro (ou comptes illimités)
  const MODULES_NIVEAU_PRO = ['securite', 'comptabilite', 'reports', 'multiDepots'];

  const MODULES_ENTERPRISE = ['tresorerie'];

  const palierActif = PALIERS_ABONNEMENT?.[subscriptionLevel] || PALIERS_ABONNEMENT.Essai;

  const aAccesAvance = Boolean(palierActif?.modulesAvances);
  const aAccesTresorerie = Boolean(palierActif?.tresorerie);
  const aAccesCameraEspion = Boolean(palierActif?.cameraEspion);

  const estModuleAvanceBloque = id =>
    (MODULES_NIVEAU_PRO.includes(id) && !aAccesAvance && currentUserRole === 'Administrateur')
    || (MODULES_ENTERPRISE.includes(id) && !aAccesTresorerie && currentUserRole === 'Administrateur');

  useEffect(() => {
    const modulesAutorises = MODULES_AUTORISES_PAR_ROLE[currentUserRole] || MODULES_AUTORISES_PAR_ROLE.Caissier;
    const autorises = modulesAutorises.filter(id => !(
      MODULES_NIVEAU_PRO.includes(id)
      && !aAccesAvance
      && currentUserRole === 'Administrateur'
    ));
    if (!autorises.includes(activeTab)) {
      setActiveTab(autorises[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUserRole, aAccesAvance]);

  /* Surveillance de l'accès au module Dépenses : si un utilisateur sans
     habilitation tente d'afficher cet onglet (même en forçant l'état côté
     navigateur), on capture une preuve, on alerte l'administrateur et on
     redirige immédiatement vers un module autorisé. */
  useEffect(() => {
    if (activeTab !== 'depenses') return;
    const estAdmin = currentUserRole === 'Administrateur';
    if (estAdmin || autorisationDepenses) return;

    let annule = false;
    const surveiller = async () => {
      const image = await capturerFurtivement();
      if (annule) return;
      const detail = `Accès au module Dépenses tenté sans habilitation par le rôle « ${currentUserRole || 'inconnu'} » — accès redirigé.`;
      setSecurityEvents(events => ajouterEvenementSecurite(events, {
        id: Date.now(),
        utilisateur: authEmail || utilisateurCourant?.email || 'Utilisateur inconnu',
        type: 'Accès dépenses non autorisé',
        detail,
        niveau: 'Critique',
        preuveImage: image
      }));
      alerterSecurite(detail, { userEmail: authEmail, level: 'Critique', imageData: image }).catch(() => {});
      setActiveTab('dashboard');
    };
    surveiller();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUserRole, autorisationDepenses]);

  const joursRestants = joursRestantsEssai(trialExpireDate);
  const trialExpired = abonnementExpireServeur || (!isSubscribed && estExpireAbonnement(trialExpireDate));

  /* Relance AVANT expiration : un bandeau avertit le client dès qu'il ne
     reste plus qu'un jour, pour qu'il active un abonnement à temps au lieu
     de découvrir la coupure brutalement. */
  const relance = relancePaiement(trialExpireDate, isSubscribed);
  const [relanceMasquee, setRelanceMasquee] = useState(false);

  const [lang, setLang] = useState('FR');
  const t = translations[lang];
  const [bgColor, setBgColor] = useState(() => lireCleIsolee('erp_bgcolor') || '#f1f5f9');

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => lireCleIsolee('erp_notifications_enabled') !== 'false'
  );
  const [showNotifications, setShowNotifications] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState(null);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [ventesLocales, setVentesLocales] = useState([]);
  useEffect(() => {
    if (isAuthenticated) {
      setSecurityEvents([]);
      setVentesLocales([]);
    } else {
      setSecurityEvents(lireStockageLocal('erp_security_events', []));
      setVentesLocales(lireStockageLocal('erp_ventes_locales', []));
      setScanHistory(lireStockageLocal('erp_scan_history', []));
    }
  }, [isAuthenticated]);
  const [paiementIdempotence, setPaiementIdempotence] = useState(() =>
    typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  );

  // Le compteur d'échecs ne persiste pas entre les sessions dans le navigateur.

  /* Migration douce : les anciennes clés partagées (skys_demo_*) sont
     recopiées dans l'espace isolé du compte courant, puis supprimées pour
     qu'aucun autre compte ne puisse les lire. Exécuté une fois au montage. */
  useEffect(() => {
    const clesMetier = [
      'erp_products', 'erp_clients', 'erp_transports', 'erp_depenses',
      'erp_fournisseurs', 'erp_devis', 'erp_inventaire', 'erp_scan_history',
      'erp_security_events', 'erp_ventes_locales', 'erp_notes', 'erp_mouvements',
      'erp_dossiers', 'erp_vehicules', 'erp_geo_lieux'
    ];
    migrerAnciennesCles(clesMetier);
  }, []);

  /* Resynchronise l'état d'abonnement LOCAL avec l'autorité du serveur.
     Un 402 reçu autrefois (essai expiré, panne réseau, mauvaise URL d'API)
     laissait erp_trial_expire/erp_subscribed figés dans le navigateur, si bien
     que l'écran de blocage réapparaissait même après régularisation. Dès que
     le serveur confirme un abonnement valide, on lève ce verrou local. */
  const resynchroniserAbonnement = useCallback(entreprise => {
    if (!entreprise) return false;
    const echeance = entreprise.abonnementEcheance
      ? new Date(entreprise.abonnementEcheance).getTime()
      : null;
    const encoreValide = entreprise.abonnementActif !== false
      && (echeance === null || echeance > Date.now());
    if (!encoreValide) return false;

    setAbonnementExpireServeur(false);
    setIsSubscribed(true);
    ecrireCleIsolee('erp_subscribed', 'true');
    // Échéance locale alignée sur celle du serveur (jamais dans le passé).
    const nouvelleEcheance = echeance !== null ? echeance : Date.now() + 24 * 60 * 60 * 1000;
    ecrireCleIsolee('erp_trial_expire', nouvelleEcheance);
    setTrialExpireDate(nouvelleEcheance);
    return true;
  }, []);

  /* Restauration de session au chargement : un jeton est present dans
     le navigateur, mais seule une vérification serveur garantit qu'il
     est encore valide et que l'abonnement est toujours actif. */
  useEffect(() => {
    let annule = false;

    const restaurer = async () => {
      const jeton = lireJeton();
      if (!jeton) {
        setSessionEnVerification(false);
        return;
      }
      setCurrentUserRole('');
      try {
        const moi = await apiMoi();
        if (annule) return;

        setUtilisateurCourant(moi.utilisateur);
        setEntrepriseCourante(moi.entreprise);
        setSousDomaine(moi.entreprise?.slug || '');
        setCurrentUserRole(moi.utilisateur.role);
        // Le serveur fait autorité : un abonnement encore valide lève le
        // verrou local laissé par un ancien 402 (essai expiré, panne réseau).
        resynchroniserAbonnement(moi.entreprise);
        setIsAuthenticated(true);
      } catch {
        // Jeton expiré ou révoqué : l'intercepteur l'a déjà effacé.
        if (!annule) setIsAuthenticated(false);
      } finally {
        // La vérification est terminée : on peut afficher l'écran définitif.
        if (!annule) setSessionEnVerification(false);
      }
    };

    restaurer();
    return () => { annule = true; };
  }, [resynchroniserAbonnement]);

  /* L'API émet cet évènement quand un 401 invalide la session en cours
     d'utilisation : on renvoie l'utilisateur vers l'écran de connexion. */
  useEffect(() => {
    const surExpiration = () => {
      window.clearTimeout(verrouTresorerieTimer.current);
      setIsAuthenticated(false);
      setAccesTresorerie(false);
      setUsersList([]);
      setErreurChargementUtilisateurs('');
      setCurrentUserRole('');
      setEntrepriseCourante(null);
      setUtilisateurCourant(null);
      setAuthError('Votre session a expiré. Veuillez vous reconnecter.');
    };

    window.addEventListener('skys:session-expiree', surExpiration);
    return () => window.removeEventListener('skys:session-expiree', surExpiration);
  }, []);

  /* Bouton « Actualiser mon abonnement » de l'écran de blocage : interroge le
     serveur et lève l'écran si l'abonnement est en réalité encore valide. */
  const handleActualiserAbonnement = async () => {
    setAuthError('');
    try {
      const moi = await apiMoi();
      setEntrepriseCourante(moi.entreprise);
      const debloque = resynchroniserAbonnement(moi.entreprise);
      if (!debloque) {
        setAuthError("Votre abonnement n'est pas actif côté serveur. Merci de le régulariser.");
      }
    } catch (err) {
      setAuthError(messageErreur(err) || 'Impossible de vérifier votre abonnement. Réessayez.');
    }
  };

  /* Essai ou abonnement expiré (402 serveur) : le serveur a coupé l'accès.
     On force l'écran de blocage automatiquement, sans attendre une action de
     l'utilisateur. L'échéance locale est aussi avancée pour rester cohérent. */
  useEffect(() => {
    const surAbonnementExpire = () => {
      setSubscriptionLevel('Essai');
      setIsSubscribed(false);
      setAbonnementExpireServeur(true);
      ecrireCleIsolee('erp_subscribed', 'false');
      const passe = Date.now() - 1000;
      ecrireCleIsolee('erp_trial_expire', passe);
      setTrialExpireDate(passe);
      setIsAuthenticated(false);
      setAuthError("Votre période d'essai ou d'abonnement est expirée.");
    };

    window.addEventListener('skys:abonnement-expire', surAbonnementExpire);
    return () => window.removeEventListener('skys:abonnement-expire', surAbonnementExpire);
  }, []);

  /* Après une impression, on libère le filtre du devis pour que l'affichage
     normal (tous les clients) revienne. */
  useEffect(() => {
    const apresImpression = () => setDevisAImprimer(null);
    window.addEventListener('afterprint', apresImpression);
    return () => window.removeEventListener('afterprint', apresImpression);
  }, []);

  /* ------------------------------------------------------------------
     DÉTECTION D'ACTIVITÉ VISUELLE SUSPECTE
     Pendant une session ouverte, la caméra est analysée périodiquement
     (visage absent, plusieurs visages, changement brutal de scène).
     Chaque signal est journalisé et transmis à l'administrateur.
     ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const arreter = demarrerAnalyseVisuelle({
      capturer: () => capturerFurtivement(),
      intervalleMs: MINUTEUR_POLL_VISUEL_MS,
      onSuspect: signal => {
        const detail = `Activité visuelle suspecte — ${signal.type} : ${signal.detail}`;
        setSecurityEvents(events => ajouterEvenementSecurite(events, {
          utilisateur: authEmail || utilisateurCourant?.email || 'Utilisateur',
          type: `Surveillance visuelle : ${signal.type}`,
          detail,
          niveau: signal.niveau || 'Moyen',
          preuveImage: signal.image || null
        }));
        alerterSecurite(detail, {
          userEmail: authEmail || utilisateurCourant?.email || '',
          level: signal.niveau || 'Moyen',
          imageData: signal.image || null
        }).catch(() => {});
      }
    });

    return arreter;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (lectureLocalePermise()) ecrireCleIsolee('erp_notifications_enabled', notificationsEnabled);
  }, [notificationsEnabled, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      enregistrerStockageLocal('erp_security_events', securityEvents.slice(0, 100));
      enregistrerStockageLocal('erp_ventes_locales', ventesLocales.slice(0, 500));
    }
  }, [securityEvents, ventesLocales, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) enregistrerStockageLocal('erp_scan_history', scanHistory.slice(0, 500));
  }, [scanHistory, isAuthenticated]);

  useEffect(() => {
    if (lectureLocalePermise()) ecrireCleIsolee('erp_bgcolor', bgColor);
  }, [bgColor, isAuthenticated]);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [panier, setPanier] = useState([]);
  /* Module Vente de Gaz : lignes de vente (bouteille + prestation). */
  const [gazForm, setGazForm] = useState({ bouteille: 'B6', prestation: 'Recharge bouteille', quantite: 1, prixUnitaire: '', client: '', consigne: false, consigneMontant: 0, moyenPaiement: 'Espèces', livreur: '', destination: '' });
  const [gazVentes, setGazVentes] = useState([]);
  const [gazRecu, setGazRecu] = useState(null);
  const [selectedClientTx, setSelectedClientTx] = useState('');
  const [selectedPosCatalogItem, setSelectedPosCatalogItem] = useState('');
  const [devisList, setDevisList] = useState(() => lireStockageLocal('erp_devis', []));
  /* Devis en cours d'impression : seul ce client est imprimé (un reçu à la fois). */
  const [devisAImprimer, setDevisAImprimer] = useState(null);
  const [devisForm, setDevisForm] = useState({ client: '', quantite: 1, prixUnitaire: '', tva: 18, conditions: 'Paiement à 30 jours', remise: 0, validite: '2 semaines', statut: 'En attente' });
  const devisSousTotal = Number(devisForm.quantite || 0) * Number(devisForm.prixUnitaire || 0);
  const devisRemise = devisSousTotal * (Number(devisForm.remise || 0) / 100);
  const devisHT = devisSousTotal - devisRemise;
  const devisTVA = devisHT * (Number(devisForm.tva || 0) / 100);
  const devisTTC = devisHT + devisTVA;
  const [inventaireList, setInventaireList] = useState(() => lireStockageLocal('erp_inventaire', []));
  const [invForm, setInvForm] = useState({ ref: '', nom: '', stockPhysique: '' });
  const [invMode, setInvMode] = useState('AUTO');
  const [invLibreForm, setInvLibreForm] = useState({ ref: '', nom: '', stockTheorique: '', stockPhysique: '' });
  const [storeInfo, setStoreInfo] = useState(() => lireStockageLocal('erp_store_info', { nomMagasin: 'SKYS ERP Solution', adresse: 'Boulevard Principal, Abidjan', telephone: '+225 07 00 00 00 00', email: 'contact@quincaillerie-erp.ci', rccm: 'CI-ABJ-2026-B-12345', motto: 'La qualité au service des bâtisseurs', ...MENTIONS_LEGALES_PAR_DEFAUT }));
  /* Références de paiement DU COMMERÇANT : elles reçoivent l'argent des
     VENTES. Isolées par compte, distinctes du compte développeur. */
  const [paiementCommercant, setPaiementCommercant] = useState(() => lireStockageLocal('erp_paiement_commercant', PAIEMENT_COMMERCANT_PAR_DEFAUT));
  /* Personnalisation du reçu : pied de page, mention légale et couleur d'accent. */
  const [recuConfig, setRecuConfig] = useState(() => lireStockageLocal('erp_recu_config', { piedDePage: 'Merci de votre confiance !', mentionLegale: 'Aucun échange sans présentation de ce reçu.', couleur: '#0f172a', afficherRccm: true, afficherContact: true }));
  const [headerConfig, setHeaderConfig] = useState(() => lireStockageLocal('erp_headerconfig', { policeEnTete: 'Segoe UI', tailleTexteGlobal: '16px', tailleTitre: '20px', inactiviteMinutes: 10 }));
  /* Préférences d'accessibilité (handicap visuel / auditif). */
  const [prefsA11y, setPrefsA11y] = useState(() => lirePrefsA11y());

  /* Conteneur de l'écran affiché : sert de source à la lecture automatique
     à voix haute (titres, tableaux, libellés, boutons et champs). */
  const conteneurPrincipalRef = useRef(null);

  /* Persistance des informations du magasin et de la personnalisation du reçu. */
  useEffect(() => {
    enregistrerStockageLocal('erp_store_info', storeInfo);
  }, [storeInfo]);

  useEffect(() => {
    enregistrerStockageLocal('erp_recu_config', recuConfig);
  }, [recuConfig]);

  useEffect(() => {
    enregistrerStockageLocal('erp_paiement_commercant', paiementCommercant);
  }, [paiementCommercant]);

  /* Apparence : applique réellement la police et la taille globale des écritures.
     La plupart des composants figent leur fontSize en px ; on applique donc un
     facteur d'échelle global (zoom) calculé sur la taille de référence 16px,
     en plus d'hériter de la police choisie. Le bonus ordinateur (+8 %) et
     l'option accessibilité « texte agrandi » (+15 %) s'y ajoutent. */
  useEffect(() => {
    const police = headerConfig.policeEnTete || 'Segoe UI';
    const taillePx = Number(String(headerConfig.tailleTexteGlobal || '16px').replace('px', '')) || 16;
    const echelle = taillePx / 16;
    const estOrdinateur = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(min-width: 769px)').matches
      : true;
    const bonusOrdinateur = estOrdinateur ? 1.08 : 1;
    const bonusA11y = prefsA11y.texteAgrandi ? 1.15 : 1;
    const echelleFinale = echelle * bonusOrdinateur * bonusA11y;
    const pile = `"${police}", 'Segoe UI', sans-serif`;
    const racine = document.documentElement;
    racine.style.setProperty('--app-font-family', pile);
    racine.style.setProperty('--app-font-scale', String(echelleFinale));
    racine.style.fontFamily = pile;
    if (document.body) document.body.style.fontFamily = pile;
    const shell = document.querySelector('.app-shell');
    if (shell) {
      shell.style.zoom = String(echelleFinale);
      shell.style.fontFamily = pile;
    }
  }, [headerConfig.policeEnTete, headerConfig.tailleTexteGlobal, prefsA11y.texteAgrandi]);

  /* Applique et persiste les préférences d'accessibilité. */
  useEffect(() => {
    appliquerPrefsA11y(prefsA11y);
    enregistrerPrefsA11y(prefsA11y);
  }, [prefsA11y]);

  /* ------------------------------------------------------------------
     LECTURE AUTOMATIQUE À VOIX HAUTE
     Dès que l'option « Annonces vocales » est cochée, l'application est
     lue automatiquement : l'écran courant tout de suite, puis chaque
     changement de module/onglet, ainsi que toute information nouvelle
     (alerte, notification, message de résultat) dès son apparition.
     Décocher l'option arrête la lecture et vide la file d'attente.
     ------------------------------------------------------------------ */
  useEffect(() => {
    if (prefsA11y.annoncesVocales) {
      demarrerLectureAutoA11y(conteneurPrincipalRef.current);
    } else {
      arreterLectureAutoA11y();
    }
  }, [prefsA11y.annoncesVocales]);

  /* Nettoyage à la fermeture de l'application : on coupe la parole en cours
     et on détache l'observateur de contenus. */
  useEffect(() => () => arreterLectureAutoA11y(), []);

  /* Changement d'écran : le nouvel écran est lu automatiquement.
     Le court délai laisse React terminer le rendu du module ouvert.

     On ne calcule PAS ici le libellé du module : `getAllTabs` est défini plus
     bas dans le composant, et une `const` n'est pas hissée — l'appeler depuis
     cet effet provoquait « Cannot access 'getAllTabs' before initialization »
     au montage de l'application. Le titre du module est déjà présent à
     l'écran (en-tête de page) et se lit donc naturellement avec le contenu. */
  const moduleLisible = activeTab;
  useEffect(() => {
    if (!prefsA11y.annoncesVocales || !isAuthenticated) return undefined;
    const minuteur = window.setTimeout(() => {
      lireNouvelEcranA11y(null, conteneurPrincipalRef.current);
    }, 400);
    return () => window.clearTimeout(minuteur);
  }, [moduleLisible, prefsA11y.annoncesVocales, isAuthenticated]);

  /* ------------------------------------------------------------------
     RACCOURCIS CLAVIER D'ACCESSIBILITÉ (disponibles partout)
     • Alt + A : active/désactive les annonces vocales immédiatement ;
     • Alt + L : lit à voix haute le contenu de l'écran courant ;
     • Alt + S : arrête toute lecture en cours.
     Pensés pour les personnes malvoyantes qui ne peuvent pas ouvrir
     le menu de configuration au clic.
     ------------------------------------------------------------------ */
  useEffect(() => {
    const surToucheA11y = evenement => {
      if (!evenement.altKey || evenement.ctrlKey || evenement.metaKey) return;
      const touche = (evenement.key || '').toLowerCase();

      if (touche === 'a') {
        evenement.preventDefault();
        setPrefsA11y(prefs => {
          const actif = !prefs.annoncesVocales;
          const suivant = { ...prefs, annoncesVocales: actif };
          enregistrerPrefsA11y(suivant);
          // Confirmation immédiate, parlée si l'option vient de s'activer.
          annoncerA11y(
            actif ? 'Annonces vocales activées.' : 'Annonces vocales désactivées.',
            { priorite: 'assertive', parler: actif }
          );
          return suivant;
        });
        return;
      }

      if (touche === 'l') {
        evenement.preventDefault();
        const ok = lirePageA11y();
        if (!ok) annoncerA11y('Aucun contenu lisible détecté sur cet écran.', { priorite: 'polite', parler: true });
        return;
      }

      if (touche === 's') {
        evenement.preventDefault();
        arreterLectureA11y();
      }
    };

    window.addEventListener('keydown', surToucheA11y);
    return () => window.removeEventListener('keydown', surToucheA11y);
  }, []);

  /* ------------------------------------------------------------------
     VERROUILLAGE AUTOMATIQUE PAR INACTIVITÉ
     Durée configurable par l'administrateur (5 à 10 minutes, via
     Configuration → Apparence). La session est fermée et l'utilisateur
     revient à l'écran de connexion ; l'avertissement s'affiche à mi-parcours.
     Ce bloc est placé APRÈS la déclaration de headerConfig (sinon
     « Cannot access headerConfig before initialization »).
     ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    // Bornes de sécurité : entre 5 et 10 minutes, repli sur 10 min.
    const minutes = Math.min(10, Math.max(5, Number(headerConfig.inactiviteMinutes) || 10));
    const dureeMaxMs = minutes * 60 * 1000;
    const delaiAlerteMs = dureeMaxMs / 2;

    const arreter = demarrerSurveillanceInactivite({
      dureeMaxMs,
      delaiAlerteMs,
      onAvertir: secondesRestantes => setAvertissementInactivite(secondesRestantes),
      onActif: () => setAvertissementInactivite(null),
      onVerrouiller: () => {
        setAvertissementInactivite(null);
        setRaisonVerrouillage(`Session verrouillée automatiquement après ${minutes} minutes d'inactivité.`);
        logout();
      }
    });

    return arreter;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, headerConfig.inactiviteMinutes]);

  const [clients, setClients] = useState(() => lireStockageLocal('erp_clients', []));
  const [transports, setTransports] = useState(() => lireStockageLocal('erp_transports', []));
  const [vehicules, setVehicules] = useState(() => lireStockageLocal('erp_vehicules', []));
  const [depotPerso, setDepotPerso] = useState(() => lireStockageLocal('erp_depot_perso', ''));
  const [ficheVehicule, setFicheVehicule] = useState(null);
  const [dossiers, setDossiers] = useState([]);
  const [selectedDocPreview, setSelectedDocPreview] = useState(null);
  const [newDossierTitre, setNewDossierTitre] = useState('');
  const [newDossierFile, setNewDossierFile] = useState(null);
  useEffect(() => {
    if (isAuthenticated) setDepensesList([]);
  }, [isAuthenticated]);
  useEffect(() => {
    if (!isAuthenticated) enregistrerStockageLocal('erp_depenses', depensesList);
  }, [depensesList, isAuthenticated]);

  const [products, setProducts] = useState(() => {
    if (!localStorage.getItem('erp_legacy_products')) {
      const existant = localStorage.getItem('skys_demo_erp_products') || localStorage.getItem('erp_products');
      if (existant) localStorage.setItem('erp_legacy_products', existant);
    }
    if (!localStorage.getItem('erp_legacy_fournisseurs')) {
      const fournisseurs = JSON.parse(localStorage.getItem('skys_demo_erp_products') || localStorage.getItem('erp_products') || '[]')
        .map(produit => produit.fournisseur)
        .filter(Boolean);
      if (fournisseurs.length) localStorage.setItem('erp_legacy_fournisseurs', JSON.stringify([...new Set(fournisseurs)].map(nom => ({ nom }))));
    }
    return lireStockageLocal('erp_products', [
      // Un seul article d'exemple : le reste du catalogue est à saisir par l'utilisateur.
      { _id: '1', ref: 'EXEMPLE-001', nom: 'Article exemple (à modifier ou supprimer)', codeBarre: '0000000000000', famille: 'Divers', fournisseur: 'Fournisseur exemple', prixAchat: 1000, prix: 1500, quantiteStock: 10, minStock: 5, maxStock: 100, emplacement: 'Zone A', zone: 'Zone A', classe: 'Classe A' }
    ]);
  });

  // En mode démo, le catalogue et le stock restent persistés entre redémarrages.
  useEffect(() => {
    if (isAuthenticated) return;
    enregistrerStockageLocal('erp_products', products);
  }, [products, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) enregistrerStockageLocal('erp_clients', clients);
  }, [clients, isAuthenticated]);
  useEffect(() => {
    if (!isAuthenticated) {
      enregistrerStockageLocal('erp_transports', transports);
      enregistrerStockageLocal('erp_vehicules', vehicules);
      enregistrerStockageLocal('erp_depot_perso', depotPerso);
    }
  }, [transports, vehicules, depotPerso, isAuthenticated]);

  /* =========================================================
     NOTIFICATIONS DE STOCK BAS
     - seuil par produit (minStock), repli sur SEUIL_BAS
     - anti-doublon via localStorage
     - alerte navigateur + ouverture auto du panneau
     ========================================================= */
  /* =========================================================
   SYNCHRONISATION AVEC LE SERVEUR (multi-tenant)
   ------------------------------------------------------------
   Après connexion, le catalogue, les clients, les ventes et les
   mouvements sont lus depuis l'API. Les états locaux ci-dessus ne
   servent plus que de rendu ; ils sont réécrits après chaque
   rechargement serveur.
   ========================================================= */
  const {
    produits: produitsApi,
    clients: clientsApi,
    ventes: ventesApi,
    mouvements: mouvementsApi,
    fournisseurs: fournisseursServeur,
    commandes: commandesServeur,
    transports: transportsApi,
    depenses: depensesApi,
    abonnements: abonnementsApi,
    chargement: chargementDonnees,
    ajouterProduit,
    modifierProduit,
    supprimerProduit,
    ajusterStock,
    definirStockPhysique,
    ajouterClient,
    modifierClient,
    supprimerClient,
    enregistrerVente,
    ajouterFournisseur,
    ajouterCommande,
    receptionnerCommande,
    supprimerCommande,
    ajouterTransport,
    modifierTransport,
    supprimerTransport,
    ajouterDepense,
    modifierDepense,
    supprimerDepense,
    souscrireAbonnement
  } = useDonneesServeur({ connecte: isAuthenticated, entreprise: entrepriseCourante });

  // Le serveur est la référence dès qu'une session est ouverte.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (produitsApi.length || !chargementDonnees) setProducts(produitsApi);
  }, [produitsApi, isAuthenticated, chargementDonnees]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setClients(clientsApi);
  }, [clientsApi, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDerniereTransaction(ventesApi[0] || null);
  }, [ventesApi, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setMouvements(mouvementsApi.map(m => ({
      ...m, id: m._id, refProd: m.ref, nomProd: m.nom
    })));
  }, [mouvementsApi, isAuthenticated]);

  // Modules complémentaires branchés sur l'API multi-tenant.
  useEffect(() => {
    if (!isAuthenticated) return;
    setTransports(transportsApi);
  }, [transportsApi, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDepensesList(depensesApi);
  }, [depensesApi, isAuthenticated]);

  /* Bons de commande : le serveur devient la source de vérité après
     connexion. On convertit le format serveur (produits[]) vers le
     format plat du tableau, et on conserve les commandes locales non
     encore transmises (mode hors-ligne) pour ne pas les perdre. */
  useEffect(() => {
    if (!isAuthenticated || chargementDonnees) return;

    const lignesServeur = (commandesServeur || []).flatMap(commande => {
      const produits = Array.isArray(commande.produits) && commande.produits.length
        ? commande.produits
        : [{}];

      return produits.map((ligne, index) => ({
        _id: commande._id,
        // Clé unique de ligne : nécessaire car une commande peut
        // contenir plusieurs produits.
        id: `${commande._id}-${ligne.produitId || ligne.ref || index}`,
        commandeId: commande._id,
        reference: commande.reference,
        ref: ligne.ref || commande.reference,
        nom: ligne.nom || '',
        fournisseur: commande.fournisseur,
        prixAchat: Number(ligne.prixAchat) || 0,
        quantite: Number(ligne.quantite) || 0,
        mode: commande.mode,
        depot: commande.depot,
        date: commande.date,
        statut: commande.statut,
        dateReception: commande.dateReception
      }));
    });

    setPurchaseOrders(prev => {
      const enAttenteLocaux = prev.filter(
        commande => !commande._id && String(commande.id || '').length !== 24
      );
      return [...lignesServeur, ...enAttenteLocaux];
    });
  }, [commandesServeur, isAuthenticated, chargementDonnees]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const courant = abonnementsApi.find(a => a.actif) || abonnementsApi[0];
    if (courant?.palier && PALIERS_ABONNEMENT?.[courant.palier]) {
      setSubscriptionLevel(courant.palier);
      setIsSubscribed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abonnementsApi, isAuthenticated]);

  const SEUIL_BAS_DEFAUT = 5;    // repli si minStock non renseigné

  const calculerNiveauStock = produit => {
    const stock = Number(produit.quantiteStock) || 0;
    const seuil = Number(produit.minStock) > 0 ? Number(produit.minStock) : SEUIL_BAS_DEFAUT;
    const seuilCritique = Math.max(2, Math.round(seuil / 2));

    if (stock <= 0) return 'critique';
    if (stock <= seuilCritique) return 'critique';
    if (stock <= seuil) return 'bas';
    return null;
  };

  const stockBasNotifications = products
    .map(produit => {
      const niveau = calculerNiveauStock(produit);
      if (!niveau) return null;
      const seuil = Number(produit.minStock) > 0 ? Number(produit.minStock) : SEUIL_BAS_DEFAUT;
      const quantite = Number(produit.quantiteStock) || 0;
      return {
        id: produit._id,
        niveau,
        ref: produit.ref,
        titre: produit.nom,
        message: `${quantite} unité(s) en stock — seuil d'alerte : ${seuil}`,
        quantite,
        fournisseur: produit.fournisseur
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.quantite - b.quantite);   // le plus critique en premier

  const stockBasNonLues = stockBasNotifications.length;

  // Mémorise les articles déjà alertés pour éviter les doublons
  const alertesVuesRef = useRef(
    (() => {
      try {
        return JSON.parse(lireCleIsolee('erp_alertes_vues', '[]'));
      } catch {
        return [];
      }
    })()
  );

  useEffect(() => {
    if (!notificationsEnabled) return;

    const nouvelles = stockBasNotifications.filter(
      alerte => !alertesVuesRef.current.includes(alerte.id)
    );

    if (!nouvelles.length) return;

    // Notification navigateur sur l'article le plus critique
    if ('Notification' in window && window.Notification.permission === 'granted') {
      const alerte = nouvelles[0];
      new window.Notification('Stock bas - SKYS ERP Solution', {
        body: nouvelles.length > 1
          ? `${alerte.titre} et ${nouvelles.length - 1} autre(s) article(s) sous le seuil.`
          : `${alerte.titre} : ${alerte.message}`
      });
    }

    const maj = [...alertesVuesRef.current, ...nouvelles.map(a => a.id)];
    alertesVuesRef.current = maj;
    enregistrerStockageLocal('erp_alertes_vues', maj);
    setShowNotifications(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const marquerAlertesVues = () => {
    const vus = [...new Set([
      ...alertesVuesRef.current,
      ...stockBasNotifications.map(a => a.id)
    ])];
    alertesVuesRef.current = vus;
    enregistrerStockageLocal('erp_alertes_vues', vus);
  };

  const [stockParDepot, setStockParDepot] = useState(() => {
    const saved = lireStockageLocal('erp_stock_par_depot', null);
    if (saved) return saved;

    return products.reduce((stock, produit) => {
      stock[produit.ref] = DEPOTS_LISTE.reduce((depots, depot, index) => {
        depots[depot] = index === 0 ? Number(produit.quantiteStock) : 0;
        return depots;
      }, {});
      return stock;
    }, {});
  });

  useEffect(() => {
    if (!isAuthenticated) enregistrerStockageLocal('erp_stock_par_depot', stockParDepot);
  }, [stockParDepot, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setStockParDepot(produitsApi.reduce((stock, produit) => ({
      ...stock, [produit.ref]: { [DEPOTS_LISTE[0]]: Number(produit.quantiteStock) }
    }), {}));
  }, [produitsApi, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const [transferts, setTransferts] = useState(() => lireStockageLocal('erp_transferts', []));
  const [transferForm, setTransferForm] = useState({ ref: '', source: DEPOTS_LISTE[0], destination: DEPOTS_LISTE[1], quantite: '' });
  const [creditsList, setCreditsList] = useState(() => lireStockageLocal('erp_credits', []));
  const [creditForm, setCreditForm] = useState({ client: '', telephone: '', montant: '', echeance: '', note: '' });

  useEffect(() => {
    if (isAuthenticated) return;
    enregistrerStockageLocal('erp_transferts', transferts);
    enregistrerStockageLocal('erp_credits', creditsList);
  }, [transferts, creditsList, isAuthenticated]);

  /* Quantité disponible d'un article dans un dépôt donné. */
  const quantiteDisponibleTransfert = (ref, source) =>
    Number(stockParDepot[ref]?.[source] || 0);

  /* Sélection d'un article : la quantité disponible est renseignée
     automatiquement dans le champ, prête à être transférée. */
  const choisirArticleTransfert = ref => {
    const disponible = quantiteDisponibleTransfert(ref, transferForm.source);
    setTransferForm(form => ({
      ...form,
      ref,
      quantite: disponible > 0 ? String(disponible) : ''
    }));
  };

  const handleTransferSubmit = e => {
    e.preventDefault();
    const quantite = Number(transferForm.quantite);
    const stockSource = quantiteDisponibleTransfert(transferForm.ref, transferForm.source);
    if (!products.some(p => p.ref === transferForm.ref) || !DEPOTS_LISTE.includes(transferForm.source) || !DEPOTS_LISTE.includes(transferForm.destination) || !Number.isInteger(quantite) || transferForm.source === transferForm.destination || quantite <= 0 || quantite > stockSource) {
      alert('Vérifiez l’article, les dépôts et la quantité disponible.');
      return;
    }

    setStockParDepot(stock => ({
      ...stock,
      [transferForm.ref]: {
        ...(stock[transferForm.ref] || {}),
        [transferForm.source]: stockSource - quantite,
        [transferForm.destination]: Number(stock[transferForm.ref]?.[transferForm.destination] || 0) + quantite
      }
    }));
    setTransferts(transfers => [{
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      ref: transferForm.ref,
      article: products.find(product => product.ref === transferForm.ref)?.nom || transferForm.ref,
      source: transferForm.source,
      destination: transferForm.destination,
      quantite
    }, ...transfers]);
    setTransferForm({ ...transferForm, quantite: '' });
  };

  const handleCreditSubmit = e => {
    e.preventDefault();
    if (!creditForm.client || Number(creditForm.montant) <= 0 || !creditForm.echeance) return;
    setCreditsList(credits => [{ ...creditForm, id: Date.now(), montant: Number(creditForm.montant), statut: 'En cours' }, ...credits]);
    setCreditForm({ client: '', telephone: '', montant: '', echeance: '', note: '' });
  };

  const [selectedFamille, setSelectedFamille] = useState(FAMILLES_PRODUITS[0]);

  /* Sous-onglet du module « Paramètres généraux » :
     « administration » ou « geographie ». */
  const [sousOngletParametres, setSousOngletParametres] = useState('administration');

  const [categorieForm, setCategorieForm] = useState({ nom: '', description: '' });
  const [sousCategorieForm, setSousCategorieForm] = useState({ nom: '', categorie: '', description: '' });
  // Sous-catégories persistées localement : { id, nom, categorie, description }.
  const [sousCategories, setSousCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cleIsolee('sousCategories')) || '[]'); } catch { return []; }
  });

  /* Les catégories disponibles = familles de référence + catégories ajoutées. */
  const [categoriesAjoutees, setCategoriesAjoutees] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cleIsolee('categoriesAjoutees')) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(cleIsolee('sousCategories'), JSON.stringify(sousCategories)); } catch { /* stockage indisponible */ }
  }, [sousCategories]);

  useEffect(() => {
    try { localStorage.setItem(cleIsolee('categoriesAjoutees'), JSON.stringify(categoriesAjoutees)); } catch { /* stockage indisponible */ }
  }, [categoriesAjoutees]);

  /* Les catégories disponibles = familles de référence + catégories
     personnalisées + familles RÉELLEMENT présentes sur un article.
     Sans cette dernière partie, un article dont la famille a été saisie sans
     être créée dans l'onglet « Catégories » restait invisible : sa famille
     n'apparaissait pas dans le sélecteur de catégorie du catalogue. */
  const categoriesReference = useMemo(() => {
    const vues = new Set();
    const resultat = [];
    [
      ...FAMILLES_PRODUITS,
      ...categoriesAjoutees.map(c => c.nom).filter(Boolean),
      ...products.map(p => (p.famille || '').trim())
    ]
      .filter(Boolean)
      .forEach(famille => {
        const cle = normaliserFamille(famille);
        if (cle && !vues.has(cle)) {
          vues.add(cle);
          resultat.push(famille);
        }
      });
    return resultat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesAjoutees, products]);

  /* Familles réellement exploitables = familles de référence + catégories
     personnalisées + toute famille présente sur un article (données serveur).
     Sert au tableau de bord pour ne pas ignorer un article dont la famille
     a été saisie librement. */
  /* useMemo : la liste ne doit pas être recréée à chaque rendu, sinon les
     effets qui en dépendent boucleraient. */
  const famillesDashboard = useMemo(() => {
    const vues = new Set();
    const resultat = [];
    // On garde le libellé affiché tout en dédoublonnant sur la forme
    // normalisée : « Matelas » et « matelas » ne comptent qu'une seule fois.
    [...categoriesReference, ...products.map(p => (p.famille || '').trim())]
      .filter(Boolean)
      .forEach(famille => {
        const cle = normaliserFamille(famille);
        if (cle && !vues.has(cle)) {
          vues.add(cle);
          resultat.push(famille);
        }
      });
    return resultat;
  }, [categoriesReference, products]);

  /* Ajouter une catégorie personnalisée (hors familles de référence). */
  const ajouterCategorie = e => {
    e.preventDefault();
    const nom = categorieForm.nom.trim();
    if (!nom) { alert('Indiquez le nom de la catégorie.'); return; }
    if (categoriesReference.some(c => c.toLowerCase() === nom.toLowerCase())) {
      alert('Cette catégorie existe déjà.'); return;
    }
    setCategoriesAjoutees(liste => [...liste, { id: `${Date.now()}`, nom, description: categorieForm.description.trim() }]);
    setCategorieForm({ nom: '', description: '' });
  };

  const supprimerCategorie = nom => {
    setCategoriesAjoutees(liste => liste.filter(c => c.nom !== nom));
    setSousCategories(liste => liste.filter(item => item.categorie !== nom));
  };

  /* Ajouter une sous-catégorie rattachée à la catégorie parente choisie. */
  const ajouterSousCategorie = e => {
    e.preventDefault();
    const nom = sousCategorieForm.nom.trim();
    if (!sousCategorieForm.categorie) { alert('Choisissez d’abord la catégorie parente.'); return; }
    if (!nom) { alert('Indiquez le nom de la sous-catégorie.'); return; }
    setSousCategories(liste => [...liste, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nom,
      categorie: sousCategorieForm.categorie,
      description: sousCategorieForm.description.trim()
    }]);
    setSousCategorieForm({ nom: '', categorie: sousCategorieForm.categorie, description: '' });
  };

  const supprimerSousCategorie = id => {
    setSousCategories(liste => liste.filter(item => item.id !== id));
  };

  /* Familles qui contiennent RÉELLEMENT au moins un article. On se base sur
     famillesDashboard (familles de référence + catégories personnalisées +
     familles présentes côté serveur) : se limiter à FAMILLES_PRODUITS cachait
     les articles rangés dans une catégorie personnalisée. */
  const famillesDisponibles = famillesDashboard.filter(famille =>
    products.some(produit => normaliserFamille(produit.famille) === normaliserFamille(famille))
  );

  useEffect(() => {
    // Si aucune famille ne contient d'article, on retombe sur les familles de
    // référence ; sinon on garde la famille courante si elle est valide.
    const liste = famillesDisponibles.length ? famillesDisponibles : famillesDashboard;
    if (!liste.length) return;

    // Comparaison NORMALISÉE : sinon « Matelas » (sélection) et « matelas »
    // (liste) sont vus comme différents et la sélection est réinitialisée à
    // chaque rendu, rendant l'article introuvable dans le catalogue.
    const cleActive = normaliserFamille(selectedFamille);
    if (!liste.some(famille => normaliserFamille(famille) === cleActive)) {
      setSelectedFamille(liste[0]);
    }
  }, [famillesDisponibles, famillesDashboard, selectedFamille]);

  const [autoReappro, setAutoReappro] = useState(
    () => lireCleIsolee('erp_auto_reappro') === 'true'
  );
  const [refsReapproMasquees, setRefsReapproMasquees] = useState(() => lireStockageLocal('erp_reappro_masquees', []));
  useEffect(() => {
    if (!isAuthenticated) enregistrerStockageLocal('erp_reappro_masquees', refsReapproMasquees);
  }, [refsReapproMasquees, isAuthenticated]);

  const [purchaseOrders, setPurchaseOrders] = useState(() => {
    try {
      return JSON.parse(lireCleIsolee('erp_purchase_orders', '[]')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    ecrireCleIsolee('erp_auto_reappro', autoReappro);
  }, [autoReappro]);

  useEffect(() => {
    ecrireCleIsolee('erp_purchase_orders', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  /* Bon de commande pré-rempli par le réapprovisionnement automatique */
  const [bonCommandePrefill, setBonCommandePrefill] = useState(null);
  const [bonCommandeForm, setBonCommandeForm] = useState({ ref: '', nom: '', fournisseur: '', quantite: '', prixAchat: '', depot: '' });

  const handleDeletePurchaseOrder = async commande => {
    if (!(await confirmer('Supprimer cette commande d\'achat ?', 'Suppression'))) return;

    const idServeur = commande?._id || commande?.commandeId;

    // Commande présente côté serveur : on la supprime en base.
    if (isAuthenticated && idServeur) {
      const resultat = await supprimerCommande(idServeur);
      if (!resultat.ok) {
        await alerter(resultat.erreur || 'Suppression impossible.', 'Commande');
      }
      return;
    }

    const idLocal = commande?.id ?? commande;
    setPurchaseOrders(commandes => commandes.filter(item => item.id !== idLocal));
  };

  /* Un bon de commande local est « poussé » au serveur : le backend
     attend un tableau `produits`, on convertit donc la ligne unique.
     `useCallback` : la référence reste stable pour l'effet d'auto-
     réapprovisionnement, qui sinon boucle à chaque rendu. */
  const envoyerCommandeServeur = useCallback(async (ligne, produitComplet = {}) => {
    const produits = [{
      produitId: produitComplet._id || ligne.produitId || undefined,
      ref: ligne.ref,
      nom: ligne.nom,
      quantite: Number(ligne.quantite) || 0,
      prixAchat: Number(ligne.prixAchat) || 0
    }];

    return ajouterCommande({
      fournisseur: ligne.fournisseur,
      produits,
      mode: ligne.mode,
      depot: ligne.depot,
      commentaire: ligne.commentaire || ''
    });
  }, [ajouterCommande]);

  const creerCommande = (produit, mode = 'Manuelle', { ouvrirAchats = false } = {}) => {
    const quantiteManquante = Math.max(1, Number(produit.maxStock) - Number(produit.quantiteStock));

    // Pré-remissage instantané du bon de commande dans Achats & Fournisseurs
    setBonCommandePrefill({ ref: produit.ref, nom: produit.nom, quantiteManquante });
    setBonCommandeForm({
      ref: produit.ref,
      nom: produit.nom,
      fournisseur: produit.fournisseur || '',
      quantite: quantiteManquante,
      prixAchat: Number(produit.prixAchat) || 0,
      depot: depotActif
    });

    if (ouvrirAchats) setActiveTab('achats');

    /* Mode serveur : on crée la commande via l'API, qui reste la source
       de vérité. L'état local n'est pas modifié à la main : le prochain
       `charger()` le resynchronise. */
    if (isAuthenticated) {
      const dejaEnAttente = purchaseOrders.some(
        commande => commande.ref === produit.ref && commande.statut === 'À commander'
      );
      if (dejaEnAttente) return;

      envoyerCommandeServeur({
        ref: produit.ref,
        nom: produit.nom,
        fournisseur: produit.fournisseur,
        prixAchat: Number(produit.prixAchat) || 0,
        quantite: quantiteManquante,
        mode,
        depot: depotActif
      }, produit);
      return;
    }

    setPurchaseOrders(commandes => {
      const dejaEnAttente = commandes.some(
        commande => commande.ref === produit.ref && commande.statut === 'À commander'
      );

      if (dejaEnAttente) return commandes;

      return [{
        id: `${Date.now()}-${produit.ref}`,
        ref: produit.ref,
        nom: produit.nom,
        fournisseur: produit.fournisseur,
        prixAchat: Number(produit.prixAchat) || 0,
        quantite: quantiteManquante,
        mode,
        depot: depotActif,
        date: new Date().toISOString().split('T')[0],
        statut: 'À commander'
      }, ...commandes];
    });
  };

  const validerBonCommande = async e => {
    e.preventDefault();
    if (!bonCommandeForm.ref || !bonCommandeForm.fournisseur || Number(bonCommandeForm.quantite) <= 0) {
      alert('Référence, fournisseur et quantité sont obligatoires.');
      return;
    }

    // Enregistre le fournisseur côté serveur s'il n'existe pas encore.
    if (isAuthenticated) {
      const nom = bonCommandeForm.fournisseur.trim();
      const dejaConnu = fournisseursServeur.some(
        f => String(f.nom).toLowerCase() === nom.toLowerCase()
      );
      if (nom && !dejaConnu) {
        await ajouterFournisseur({ nom });
      }
    }

    creerCommande(
      {
        ref: bonCommandeForm.ref,
        nom: bonCommandeForm.nom,
        fournisseur: bonCommandeForm.fournisseur,
        prixAchat: Number(bonCommandeForm.prixAchat) || 0,
        maxStock: Number(bonCommandeForm.quantite),
        quantiteStock: 0
      },
      'Pré-remplie depuis Réapprovisionnement'
    );
    alert('Bon de commande créé et transmis au module Achats & Fournisseurs.');
    setBonCommandeForm({ ref: '', nom: '', fournisseur: '', quantite: '', prixAchat: '', depot: '' });
    setBonCommandePrefill(null);
  };

  useEffect(() => {
    if (!autoReappro) return;

    const produitsSousSeuil = products.filter(
      produit => Number(produit.quantiteStock) <= Number(produit.minStock)
    );

    /* Mode serveur : on transmet les bons de commande à l'API.
       `envoyerCommandeServeur` resynchronise ensuite via le hook. */
    if (isAuthenticated) {
      const dejaEnAttente = new Set(
        purchaseOrders
          .filter(commande => commande.statut === 'À commander')
          .map(commande => commande.ref)
      );

      produitsSousSeuil
        .filter(produit => !dejaEnAttente.has(produit.ref))
        .forEach(produit => {
          const quantite = Math.max(1, Number(produit.maxStock) - Number(produit.quantiteStock));
          envoyerCommandeServeur({
            ref: produit.ref,
            nom: produit.nom,
            fournisseur: produit.fournisseur,
            prixAchat: Number(produit.prixAchat) || 0,
            quantite,
            mode: 'Automatique',
            depot: depotActif
          }, produit);
        });
      return;
    }

    setPurchaseOrders(commandes => {
      const nouvellesCommandes = produitsSousSeuil
        .filter(produit => !commandes.some(
          commande => commande.ref === produit.ref && commande.statut === 'À commander'
        ))
        .map(produit => ({
          id: `${Date.now()}-${produit.ref}`,
          ref: produit.ref,
          nom: produit.nom,
          fournisseur: produit.fournisseur,
          prixAchat: Number(produit.prixAchat) || 0,
          quantite: Math.max(
            1,
            Number(produit.maxStock) - Number(produit.quantiteStock)
          ),
          mode: 'Automatique',
          depot: depotActif,
          date: new Date().toISOString().split('T')[0],
          statut: 'À commander'
        }));

      return nouvellesCommandes.length
        ? [...nouvellesCommandes, ...commandes]
        : commandes;
    });
  }, [products, autoReappro, depotActif, isAuthenticated, purchaseOrders, envoyerCommandeServeur]);

  const [publicite, setPublicite] = useState(() => {
    return lireStockageLocal('erp_publicite', {
      actif: true,
      titre: 'Bienvenue sur SKYS ERP Solution',
      message: 'Gérez votre stock, votre caisse et vos livraisons depuis un seul poste.',
      couleur: '#0f172a',
      lien: ''
    });
  });

  useEffect(() => {
    if (!isAuthenticated) enregistrerStockageLocal('erp_publicite', publicite);
  }, [publicite, isAuthenticated]);

  const [editingProdId, setEditingProdId] = useState(null);
  const [prodForm, setProdForm] = useState({
    ref: '', nom: '', codeBarre: '', famille: FAMILLES_PRODUITS[0], fournisseur: '', prixAchat: '', prix: '',
    quantiteStock: '', minStock: '', maxStock: '', emplacement: 'Zone A', zone: 'Zone A', classe: 'Classe A'
  });

  const recevoirCommande = async commande => {
    if (commande.statut === 'Réceptionnée') return;

    /* Mode serveur : on bascule le statut via l'API. Le backend horodate
       la réception ; le hook recharge ensuite la liste. */
    if (isAuthenticated && commande._id) {
      const resultat = await receptionnerCommande(commande._id);
      if (!resultat.ok) {
        await alerter(resultat.erreur || 'Réception impossible.', 'Commande');
      }
      return;
    }

    setProducts(currentProducts => currentProducts.map(produit => (
      produit.ref === commande.ref
        ? { ...produit, quantiteStock: Number(produit.quantiteStock) + Number(commande.quantite) }
        : produit
    )));
    setMouvements(currentMouvements => [{
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      type: 'RECEPTION',
      refProd: commande.ref,
      nomProd: commande.nom,
      quantite: Number(commande.quantite),
      motif: `Réception fournisseur - ${commande.fournisseur || 'Fournisseur non renseigné'}`
    }, ...currentMouvements]);
    setPurchaseOrders(currentOrders => currentOrders.map(item => (
      item.id === commande.id ? { ...item, statut: 'Réceptionnée', dateReception: new Date().toISOString().split('T')[0] } : item
    )));
  };

  const [mouvForm, setMouvForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'ENTREE',
    refProd: 'FIX-001',
    nomCustom: '',
    quantite: '',
    motif: 'Opération Standard'
  });

  /* Référentiel fournisseurs lu depuis l'API (module Achats & Fournisseurs). */
  const [selectedDistrictGeo, setSelectedDistrictGeo] = useState(() => lireCleIsolee('erp_geo_district') || DISTRICTS_CI[0]?.id || '');
  const [selectedRegionGeo, setSelectedRegionGeo] = useState(() => lireCleIsolee('erp_geo_region') || 'District Autonome d\'Abidjan');
  const [selectedPrefectureGeo, setSelectedPrefectureGeo] = useState(() => lireCleIsolee('erp_geo_prefecture') || 'Département d\'Abidjan');
  const [selectedVilleGeo, setSelectedVilleGeo] = useState(() => lireCleIsolee('erp_geo_ville') || 'Abidjan');
  const [paysGeo, setPaysGeo] = useState(() => lireCleIsolee('erp_geo_pays') || "Côte d'Ivoire");
  const [lieuGeo, setLieuGeo] = useState('');
  const [gpsGeo, setGpsGeo] = useState(null);
  /* Capteurs de l'appareil (mouvement, luminosité, batterie, réseau…). */
  const [capteursActifs, setCapteursActifs] = useState(false);
  const [etatCapteurs, setEtatCapteurs] = useState({ mouvement: null, orientation: null, luminosite: null, magnetometre: null, proximite: null, batterie: null, reseau: null });
  const [capteursSupportes, setCapteursSupportes] = useState([]);
  const [capteursNonSupportes, setCapteursNonSupportes] = useState([]);
  const [derniereAlerteCapteur, setDerniereAlerteCapteur] = useState('');
  const arretCapteursRef = useRef(null);
  const [latitudeManuelleGeo, setLatitudeManuelleGeo] = useState('');
  const [longitudeManuelleGeo, setLongitudeManuelleGeo] = useState('');
  const [statutGpsGeo, setStatutGpsGeo] = useState('');
  const [lieuxEnregistres, setLieuxEnregistres] = useState(() => lireStockageLocal('erp_geo_lieux', []));
  const [districtLibreGeo, setDistrictLibreGeo] = useState(() => lireCleIsolee('erp_geo_district_libre') || '');
  const [regionLibreGeo, setRegionLibreGeo] = useState(() => lireCleIsolee('erp_geo_region_libre') || '');
  const [departementLibreGeo, setDepartementLibreGeo] = useState(() => lireCleIsolee('erp_geo_departement_libre') || '');
  const [villeLibreGeo, setVilleLibreGeo] = useState(() => lireCleIsolee('erp_geo_ville_libre') || '');

  // Listes dérivées de la sélection courante
  const districtActifGeo = DISTRICTS_CI.find(d => d.id === selectedDistrictGeo) || DISTRICTS_CI[0];
  const regionsDuDistrict = useMemo(
    () => (districtActifGeo ? districtActifGeo.regions.map(r => r.nom) : []),
    [districtActifGeo]
  );
  const regionActifGeo = districtActifGeo?.regions.find(r => r.nom === selectedRegionGeo) || districtActifGeo?.regions[0];
  const prefecturesDeRegion = regionActifGeo ? regionActifGeo.prefectures : [];
  const prefectureActiveGeo = prefecturesDeRegion.find(p => p.nom === selectedPrefectureGeo) || prefecturesDeRegion[0];
  const sousPrefecturesPrefecture = useMemo(
    () => (prefectureActiveGeo ? prefectureActiveGeo.sousPrefectures : []),
    [prefectureActiveGeo]
  );
  const villesPrefecture = useMemo(
    () => [...new Set([prefectureActiveGeo?.chefLieu, ...sousPrefecturesPrefecture.map(s => s.chefLieu || s.nom)].filter(Boolean))],
    [prefectureActiveGeo, sousPrefecturesPrefecture]
  );

  // Cascade : district -> région -> préfecture -> ville
  useEffect(() => {
    if (!regionsDuDistrict.includes(selectedRegionGeo)) setSelectedRegionGeo(regionsDuDistrict[0] || '');
  }, [selectedDistrictGeo, selectedRegionGeo, regionsDuDistrict]);

  useEffect(() => {
    const prefectures = regionActifGeo?.prefectures || [];
    if (!prefectures.some(p => p.nom === selectedPrefectureGeo)) {
      setSelectedPrefectureGeo(prefectures[0]?.nom || '');
    }
  }, [selectedDistrictGeo, selectedRegionGeo, selectedPrefectureGeo, regionActifGeo]);

  useEffect(() => {
    if (!villesPrefecture.includes(selectedVilleGeo)) {
      setSelectedVilleGeo(villesPrefecture[0] || '');
    }
  }, [selectedDistrictGeo, selectedRegionGeo, selectedPrefectureGeo, selectedVilleGeo, villesPrefecture]);

  const capturerPositionGeo = () => {
    setGpsGeo(null);
    if (!navigator.geolocation || !window.isSecureContext) {
      setStatutGpsGeo('GPS indisponible : utilisez HTTPS (ou localhost) et autorisez la localisation. Saisissez les coordonnées manuellement ci-dessous.');
      return;
    }
    setStatutGpsGeo('Recherche de votre position actuelle…');
    navigator.geolocation.getCurrentPosition(
      position => {
        setGpsGeo({ latitude: position.coords.latitude, longitude: position.coords.longitude, precision: position.coords.accuracy });
        setStatutGpsGeo('Position obtenue. Vérifiez le lieu avant enregistrement.');
      },
      () => {
        setGpsGeo(null);
        setStatutGpsGeo('Localisation refusée ou indisponible. Saisissez les coordonnées manuellement ci-dessous.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  /* ------------------------------------------------------------------
     CAPTEURS DE L'APPAREIL
     Démarre tous les capteurs disponibles (mouvement, luminosité,
     magnétomètre, proximité, batterie, réseau). Chaque capteur absent
     est simplement signalé, sans bloquer les autres.
     ------------------------------------------------------------------ */
  const demarrerCapteurs = async () => {
    // Sur iOS, l'autorisation doit être demandée suite à un geste utilisateur.
    await demanderAutorisationsCapteurs();

    if (arretCapteursRef.current) arretCapteursRef.current();

    const { arreter, supportes, nonSupportes } = demarrerTousCapteurs({
      onLecture: etat => setEtatCapteurs({ ...etat }),
      onAlerte: alerte => {
        setDerniereAlerteCapteur(alerte.detail);
        notifier(alerte.detail, { critique: true });
        setSecurityEvents(events => ajouterEvenementSecurite(events, {
          utilisateur: authEmail || 'Utilisateur',
          type: 'Capteur : mouvement brusque',
          detail: alerte.detail,
          niveau: 'Moyen'
        }));
      }
    });

    arretCapteursRef.current = arreter;
    setCapteursSupportes(supportes);
    setCapteursNonSupportes(nonSupportes);
    setCapteursActifs(true);
  };

  const arreterCapteurs = () => {
    if (arretCapteursRef.current) {
      arretCapteursRef.current();
      arretCapteursRef.current = null;
    }
    setCapteursActifs(false);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      ecrireCleIsolee('erp_geo_pays', paysGeo);
      ecrireCleIsolee('erp_geo_district', selectedDistrictGeo);
      ecrireCleIsolee('erp_geo_region', selectedRegionGeo);
      ecrireCleIsolee('erp_geo_prefecture', selectedPrefectureGeo);
      ecrireCleIsolee('erp_geo_ville', selectedVilleGeo);
      ecrireCleIsolee('erp_geo_district_libre', districtLibreGeo);
      ecrireCleIsolee('erp_geo_region_libre', regionLibreGeo);
      ecrireCleIsolee('erp_geo_departement_libre', departementLibreGeo);
      ecrireCleIsolee('erp_geo_ville_libre', villeLibreGeo);
      enregistrerStockageLocal('erp_geo_lieux', lieuxEnregistres.slice(0, 200));
    }
  }, [paysGeo, selectedDistrictGeo, selectedRegionGeo, selectedPrefectureGeo, selectedVilleGeo, districtLibreGeo, regionLibreGeo, departementLibreGeo, villeLibreGeo, lieuxEnregistres, isAuthenticated]);

  const enregistrerLieuGeo = e => {
    e.preventDefault();
    const latitudeBrute = String(gpsGeo?.latitude ?? latitudeManuelleGeo).trim();
    const longitudeBrute = String(gpsGeo?.longitude ?? longitudeManuelleGeo).trim();
    const latitude = Number(latitudeBrute);
    const longitude = Number(longitudeBrute);
    if (!paysGeo.trim() || !lieuGeo.trim() || !latitudeBrute || !longitudeBrute || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      setStatutGpsGeo('Veuillez saisir un pays, un lieu et des coordonnées GPS valides.');
      return;
    }
    const nouvelId = typeof window.crypto?.randomUUID === 'function' ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setLieuxEnregistres(liste => [{ id: nouvelId, pays: paysGeo.trim(),
    district: paysGeo === "Côte d'Ivoire" ? districtActifGeo?.nom : districtLibreGeo.trim(),
    region: paysGeo === "Côte d'Ivoire" ? selectedRegionGeo : regionLibreGeo.trim(),
    departement: paysGeo === "Côte d'Ivoire" ? selectedPrefectureGeo : departementLibreGeo.trim(),
    ville: paysGeo === "Côte d'Ivoire" ? selectedVilleGeo : villeLibreGeo.trim(),
    nom: lieuGeo.trim(), latitude, longitude, precision: gpsGeo?.precision ?? null }, ...liste]);
    setGpsGeo(null);
    setLatitudeManuelleGeo('');
    setLongitudeManuelleGeo('');
    setStatutGpsGeo('Lieu ajouté et enregistré localement sur cet appareil.');
    setLieuGeo('');
  };

  const [editingClientId, setEditingClientId] = useState(null);
  const [clientForm, setClientForm] = useState(CLIENT_INITIAL);

  const [editingTransportId, setEditingTransportId] = useState(null);
  const [transpForm, setTranspForm] = useState({ nomResponsable: '', prenomsResponsable: '', vehicule: '', immatriculation: '', nombreVoyage: 1, destination: '', client: '', frais: '', commentaires: '' });

  // La flotte, les dépôts personnalisés et les dossiers sont déclarés avec les autres états locaux.

  useEffect(() => {
    if (typeof indexedDB === 'undefined') return undefined;

    let annule = false;
    let urlsTemporaires = [];

    lireDossiersEnregistres()
      .then(documents => {
        const documentsAvecUrl = documents.map(document => ({
          ...document,
          image: URL.createObjectURL(document.fichier)
        }));

        urlsTemporaires = documentsAvecUrl.map(document => document.image);

        if (!annule) {
          setDossiers(documentsAvecUrl);
        } else {
          urlsTemporaires.forEach(url => URL.revokeObjectURL(url));
        }
      })
      .catch(error => {
        console.error('Impossible de charger les justificatifs :', error);
      });

    return () => {
      annule = true;
      urlsTemporaires.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const paiements = [
    { id: 1, nom: 'Espèces', type: 'Cash', desc: 'Paiement direct en espèces', logo: 'cash', moyen: 'Espèces' },
    { id: 2, nom: 'Carte bancaire / Kkiapay', type: 'Card', desc: 'Confirmation prestataire requise', logo: 'visa', moyen: 'Carte bancaire / Kkiapay' },
    { id: 3, nom: 'Orange Money', type: 'Orange', desc: 'Confirmation prestataire requise', logo: 'orange', moyen: 'Mobile Money : Orange Money' },
    { id: 4, nom: 'MTN MoMo', type: 'MTN', desc: 'Confirmation prestataire requise', logo: 'mtn', moyen: 'Mobile Money : MTN MoMo' },
    { id: 5, nom: 'Moov Money', type: 'Moov', desc: 'Confirmation prestataire requise', logo: 'moov', moyen: 'Mobile Money : Moov Money' },
    { id: 6, nom: 'Wave', type: 'Wave', desc: 'Confirmation prestataire requise', logo: 'wave', moyen: 'Mobile Money : Wave' }
  ];

  /* =========================================================
     MOYENS DE PAIEMENT (menu déroulant professionnel)
     ========================================================= */
  const MOYENS_PAIEMENT = paiements.map(moyen => moyen.moyen);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Espèces');
  const [reportPeriod, setReportPeriod] = useState('mensuel');
  // Famille affichée dans le module déroulant du tableau de bord.
  const [familleDashboard, setFamilleDashboard] = useState(FAMILLES_PRODUITS[0] || '');

  /* Le tableau de bord doit pointer sur une famille RÉELLEMENT présente ET si
     possible non vide : sinon l'article fraîchement enregistré reste invisible
     (la sélection par défaut « Quincaillerie de fixation » contient 0 article).
     (Placé APRÈS la déclaration de familleDashboard pour éviter tout
     « used before defined ».) */
  useEffect(() => {
    if (!famillesDashboard.length) return;

    const contient = nom => products.some(
      p => normaliserFamille(p.famille) === normaliserFamille(nom)
    );

    // On ne recale que si la famille courante n'existe plus OU n'a aucun article
    // alors qu'une autre famille en possède.
    if (!famillesDashboard.includes(familleDashboard) || !contient(familleDashboard)) {
      const premiereAvecArticle = famillesDashboard.find(contient);
      if (premiereAvecArticle && premiereAvecArticle !== familleDashboard) {
        setFamilleDashboard(premiereAvecArticle);
      } else if (!famillesDashboard.includes(familleDashboard)) {
        setFamilleDashboard(famillesDashboard[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [famillesDashboard, familleDashboard, products]);

  /* Choix de règlement / palier dans le module Abonnements */
  const [abonnementPaiement, setAbonnementPaiement] = useState('Carte bancaire');
  const [abonnementPalier, setAbonnementPalier] = useState('Professionnel / ERP');
  const [cleKkiapayAbonnement, setCleKkiapayAbonnement] = useState('');
  const [prixServeurAbonnements, setPrixServeurAbonnements] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setCleKkiapayAbonnement('');
      setPrixServeurAbonnements(null);
      return;
    }
    let annule = false;
    configPaiementPubliqueApi()
      .then(config => {
        if (annule) return;
        setCleKkiapayAbonnement(config?.abonnement?.cleKkiapay || '');
        setPrixServeurAbonnements(config?.prixAbonnements || null);
      })
      .catch(() => {
        if (annule) return;
        setCleKkiapayAbonnement('');
        setPrixServeurAbonnements(null);
      });
    return () => { annule = true; };
  }, [isAuthenticated]);

  /* =========================================================
     ENVOI AUTOMATIQUE DU LIEN DE CONNEXION PAR MAIL
     POST /api/email/ lien-connexion
     Le lien contient l'email + un jeton d'activation à usage unique.
     ========================================================= */
  const envoyerLienConnexionParMail = async invitation => {
    const corps = {
      to: invitation.email,
      nom: invitation.nom,
      role: invitation.role,
      codeInitial: invitation.code,
      lienConnexion: invitation.lienConnexion,
      slug: entrepriseCourante?.slug || ''
    };

    try {
      // Même base d'URL que services/api.js (web, Android et iOS).
      const reponse = await fetch(`${apiUrl}/api/email/lien-connexion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(lireJeton() ? { Authorization: `Bearer ${lireJeton()}` } : {}) },
        body: JSON.stringify(corps)
      });

      const resultat = await reponse.json().catch(() => ({}));
      if (!reponse.ok || resultat.envoye !== true) {
        throw new Error(resultat.error || `HTTP ${reponse.status}`);
      }
      return resultat;
    } catch (error) {
      console.warn('Envoi du mail indisponible :', error.message);
      return { envoye: false, erreur: error.message };
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setAuthError('Connexion impossible : aucun accès à Internet pour le moment. Vérifiez votre connexion (Wi-Fi ou données mobiles) puis réessayez.');
      return;
    }

    if (isRegistering) {
      if (!authEmail || !authPassword || !authNom) {
        setAuthError('Veuillez remplir tous les champs !');
        return;
      }

      // Acceptation des conditions obligatoire (commerce électronique en CI).
      if (!accepteConditions) {
        setAuthError('Vous devez accepter les conditions générales d\'utilisation et la politique de confidentialité pour créer un compte.');
        return;
      }

      if (authPassword.length < 12 || authPassword.length > 256) {
        setAuthError('Le mot de passe doit contenir entre 12 et 256 caractères.');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) {
        setAuthError('Veuillez utiliser une adresse email valide.');
        return;
      }

      if (authPassword !== authConfirmPassword) {
        setAuthError('Les deux mots de passe ne correspondent pas.');
        return;
      }

      // Onboarding complet côté serveur : profil entreprise + compte
      // administrateur + activation de l'abonnement.
      try {
        const resultat = await apiInscription({
          raisonSociale: authNom,
          slug: sousDomaine,
          email: authEmail,
          motDePasse: authPassword,
          nom: authNom
        });

        enregistrerSession(resultat.jeton, resultat.utilisateur, resultat.entreprise);
        setUtilisateurCourant(resultat.utilisateur);
        setCurrentUserRole(resultat.utilisateur.role);
        setEntrepriseCourante(resultat.entreprise);
        setSousDomaine(resultat.entreprise?.slug || '');
        setIsAuthenticated(true);
        setAuthPassword('');
        setAuthConfirmPassword('');
      } catch (err) {
        setAuthError(messageErreur(err));
      }
      return;
    }

    // Connexion réelle : le backend vérifie l'empreinte du mot de passe,
    // verrouille le compte après 5 échecs et renvoie un jeton signé
    // contenant le companyId de l'entreprise.
    try {
      /* Contrôle de cohérence : l'email doit être une adresse valide AVANT
         d'appeler le serveur. Sans ce test, une saisie incomplète (espace,
         caractère manquant) produisait un « Connexion impossible » trompeur
         qui accusait la connexion Internet alors que la faute était au champ. */
      const emailSaisi = String(authEmail || '').trim();
      if (!emailSaisi) {
        setAuthError('Indiquez votre adresse email pour vous connecter.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailSaisi)) {
        setAuthError('Adresse email invalide. Vérifiez la saisie (exemple : nom@domaine.com).');
        return;
      }
      if (!authPassword) {
        setAuthError('Indiquez votre mot de passe pour vous connecter.');
        return;
      }

      const resultat = await apiConnexion(emailSaisi, authPassword, sousDomaine);

      setCurrentUserRole(resultat.utilisateur.role);
      setEntrepriseCourante(resultat.entreprise);
      setUtilisateurCourant(resultat.utilisateur);
      setSousDomaine(resultat.entreprise?.slug || '');

      enregistrerSession(resultat.jeton, resultat.utilisateur, resultat.entreprise);
      setIsAuthenticated(true);
      // Une nouvelle connexion réussie lève le blocage renvoyé par le serveur
      // et remet à jour l'échéance locale d'après l'autorité du serveur.
      resynchroniserAbonnement(resultat.entreprise);
      // Garder seulement la valeur temporaire en mémoire jusqu'à son changement forcé.
      if (resultat.utilisateur.forcePasswordChange) {
        setAuthPassword(authPassword);
      } else {
        setAuthPassword('');
      }
      setAuthConfirmPassword('');
      // Le verrouillage autoritatif est géré côté serveur.
      setTentativesConnexion(0);
      setRaisonVerrouillage('');
      setAvertissementInactivite(null);
      // Mot de passe temporaire : changement obligatoire à la première connexion.
      setDoitChangerMotDePasse(Boolean(resultat.utilisateur.forcePasswordChange));
      setNouveauMotDePasseObligatoire('');
      setConfirmationNouveauMotDePasse('');
      setErreurChangement('');
    } catch (err) {
      const message = messageErreur(err);
      const nouveauCompteur = tentativesConnexion + 1;
      setTentativesConnexion(nouveauCompteur);
      if (err?.response?.status === 423 || err?.response?.status === 429) {
        setAuthError(message);
        return;
      }
      setAuthError(message);
    }
  };

  /* Changement du mot de passe temporaire, imposé à la première connexion. */
  const handleChangementMotDePasseObligatoire = async e => {
    e.preventDefault();
    setErreurChangement('');

    if (nouveauMotDePasseObligatoire.length < 12 || nouveauMotDePasseObligatoire.length > 256) {
      setErreurChangement('Le nouveau mot de passe doit contenir entre 12 et 256 caractères.');
      return;
    }
    if (nouveauMotDePasseObligatoire !== confirmationNouveauMotDePasse) {
      setErreurChangement('Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      await changerMotDePasseApi(authPassword, nouveauMotDePasseObligatoire);
      setDoitChangerMotDePasse(false);
      setNouveauMotDePasseObligatoire('');
      setConfirmationNouveauMotDePasse('');
      alert('Mot de passe mis à jour. Bienvenue dans SKYS ERP Solution !');
    } catch (err) {
      setErreurChangement(messageErreur(err));
    }
  };

  const logout = () => {
    window.clearTimeout(verrouTresorerieTimer.current);
    window.clearTimeout(verrouModuleTimer.current);
    // On libère les capteurs de l'appareil pour ne pas les laisser actifs.
    if (arretCapteursRef.current) {
      try { arretCapteursRef.current(); } catch { /* ignoré */ }
      arretCapteursRef.current = null;
    }
    setCapteursActifs(false);
    setAccesTresorerie(false);
    setModulesDebloques([]);
    setModuleEnVerification(null);
    setCurrentUserRole('');
    setActiveTab('dashboard');
    /* Isolation des comptes : on efface toutes les données locales du compte
       courant AVANT de retirer la session. Ainsi, aucun compte suivant ne
       peut lire les informations laissées par le précédent. */
    effacerDonneesCompte();
    // Efface le jeton : sans lui, l'API refusera toute requête.
    effacerSession();
    setIsAuthenticated(false);
    setEntrepriseCourante(null);
    setUtilisateurCourant(null);
  };

  /* Notification accessible : combine le message visuel classique, l'alerte
     visuelle/vibration (sourds) et l'annonce vocale (aveugles) selon les
     préférences. Utilisée pour les événements importants. */
  const notifier = (message, { critique = false } = {}) => {
    if (prefsA11y.alertesVisuelles) {
      alerteVisuelleA11y(message, { dureeMs: critique ? 8000 : 5000 });
    }
    /* Lecture automatique : l'information est prononcée dès son apparition
       (les alertes critiques passent en tête de file). */
    lireInfoA11y(message, { urgent: critique });
    annoncerA11y(message, {
      priorite: critique ? 'assertive' : 'polite',
      parler: prefsA11y.annoncesVocales && !critique
    });
    return message;
  };

  const ouvrirModule = id => {
    if (id === 'tresorerie') {
      if (utilisateurCourant?.role !== 'Administrateur') return;
      setAccesTresorerie(false);
      setConfirmationAdmin('');
      setMotDePasseTresorerieConfirme('');
      setErreurAdmin('');
    }
    // Module sensible : on prépare l'écran de déverrouillage s'il n'est pas
    // encore ouvert pour cette session.
    if (MODULES_SENSIBLES[id] && !modulesDebloques.includes(id)) {
      setModuleEnVerification(id);
      setSaisieModule('');
      setMotDePasseModulesConfirme('');
      setErreurModule('');
    }
    setActiveTab(id);
    // Sur mobile, le choix d'un module referme le tiroir de navigation.
    setMenuMobileOuvert(false);
  };

  /* Déverrouillage d'un module sensible : première fois on définit le mot de
     passe, ensuite on le vérifie. L'accès reste ouvert 5 minutes. */
  const verifierAccesModule = e => {
    e.preventDefault();
    const id = moduleEnVerification;
    if (!id) return;

    if (!motDePasseModules) {
      if (saisieModule.length < 6) { setErreurModule('Le mot de passe doit contenir au moins 6 caractères.'); return; }
      if (saisieModule !== motDePasseModulesConfirme) { setErreurModule('Les deux saisies ne correspondent pas.'); return; }
      enregistrerStockageLocal('erp_modules_mdp', saisieModule);
      setMotDePasseModules(saisieModule);
      setModulesDebloques(liste => [...liste, id]);
      setSaisieModule('');
      setMotDePasseModulesConfirme('');
      setErreurModule('');
      setModuleEnVerification(null);
      return;
    }

    if (saisieModule === motDePasseModules) {
      setModulesDebloques(liste => [...liste, id]);
      setSaisieModule('');
      setErreurModule('');
      setModuleEnVerification(null);
      window.clearTimeout(verrouModuleTimer.current);
      verrouModuleTimer.current = window.setTimeout(() => {
        setModulesDebloques([]);
      }, 5 * 60 * 1000);
      return;
    }

    setErreurModule('Mot de passe incorrect.');
  };

  /* Modification du mot de passe trésorerie via des dialogues compatibles
     Android/iOS (window.prompt y est inopérant). */
  const modifierMotDePasseTresorerie = async () => {
    const actuel = await demander('Saisissez le mot de passe trésorerie actuel.', { titre: 'Mot de passe actuel', typeChamp: 'password' });
    if (actuel === null) return;
    if (actuel !== motDePasseTresorerie) {
      await alerter('Mot de passe incorrect.', 'Erreur');
      return;
    }
    const nouveau = await demander('Nouveau mot de passe trésorerie (6 caractères minimum).', { titre: 'Nouveau mot de passe', typeChamp: 'password' });
    if (nouveau === null) return;
    if (!nouveau || nouveau.length < 6) {
      await alerter('Nouveau mot de passe trop court (6 caractères minimum).', 'Erreur');
      return;
    }
    enregistrerStockageLocal('erp_tresorerie_mdp', nouveau);
    setMotDePasseTresorerie(nouveau);
    await alerter('Mot de passe trésorerie modifié avec succès.', 'Succès');
  };

  const verifierAccesTresorerie = async e => {
    e.preventDefault();
    if (utilisateurCourant?.role !== 'Administrateur') {
      setErreurAdmin('Accès réservé à un administrateur authentifié.');
      return;
    }
    if (!motDePasseTresorerie) {
      if (confirmationAdmin.length < 6) { setErreurAdmin('Le mot de passe doit contenir au moins 6 caractères.'); return; }
      if (confirmationAdmin !== motDePasseTresorerieConfirme) { setErreurAdmin('Les deux saisies ne correspondent pas.'); return; }
      enregistrerStockageLocal('erp_tresorerie_mdp', confirmationAdmin);
      setMotDePasseTresorerie(confirmationAdmin);
      setConfirmationAdmin('');
      setMotDePasseTresorerieConfirme('');
      setErreurAdmin('');
      return;
    }
    if (confirmationAdmin === motDePasseTresorerie) {
      setAccesTresorerie(true);
      setConfirmationAdmin('');
      setErreurAdmin('');
      window.clearTimeout(verrouTresorerieTimer.current);
      verrouTresorerieTimer.current = window.setTimeout(() => {
        setAccesTresorerie(false);
        setActiveTab('dashboard');
      }, 5 * 60 * 1000);
      return;
    }
    if (!utilisateurCourant?.email || !confirmationAdmin) {
      setErreurAdmin('Reconnectez-vous avec votre compte administrateur.');
      return;
    }
    setErreurAdmin('');
    try {
      await apiConnexion(utilisateurCourant.email, confirmationAdmin, entrepriseCourante?.slug || '');
      setAccesTresorerie(true);
      setConfirmationAdmin('');
      window.clearTimeout(verrouTresorerieTimer.current);
      verrouTresorerieTimer.current = window.setTimeout(() => {
        setAccesTresorerie(false);
        setActiveTab('dashboard');
      }, 5 * 60 * 1000);
    } catch {
      setErreurAdmin('Mot de passe trésorerie ou administrateur incorrect.');
      setConfirmationAdmin('');
    }
  };

  const handlePaySubscription = async (provider) => {
    const map = {
      'Solo': 'Standard',
      'Standard': 'Standard',
      'Pro / Illimité': 'Pro',
      'Professionnel / ERP': 'Pro',
      'Enterprise / Master': 'Enterprise',
      'Standard / Boutique': 'Standard',
      'Transporteur (Spécial Transport)': 'Transport',
      'Transporteur': 'Transport',
      'Essai': 'Essai'
    };
    const niveau = map[provider] || (PALIERS_ABONNEMENT[provider] ? provider : 'Standard');
    const nomPalierBackend = ({
      'Solo': 'Standard',
      'Standard / Boutique': 'Standard',
      'Standard': 'Standard',
      'Pro / Illimité': 'Pro',
      'Professionnel / ERP': 'Pro',
      'Enterprise / Master': 'Enterprise',
      'Transporteur (Spécial Transport)': 'Transport',
      'Transporteur': 'Transport'
    })[provider] || niveau;
    const palierCourant = PALIERS_ABONNEMENT?.[niveau] || PALIERS_ABONNEMENT.Essai;
    const montantServeur = Number(prixServeurAbonnements?.[nomPalierBackend]);
    const montant = Number.isFinite(montantServeur) && montantServeur > 0
      ? montantServeur
      : Number(PALIERS.find(p => p.code === niveau)?.prix) || 0;
    if (!montant) {
      return alerter('Le tarif officiel du palier est indisponible côté serveur. Réessayez plus tard.', 'Abonnement');
    }

    /* La souscription n'est possible que pour une SESSION OUVERTE : le serveur
       rattache l'abonnement au companyId du jeton. Sur l'écran de blocage, on
       mémorise donc le palier choisi et on invite à se connecter. */
    if (!isAuthenticated) {
      setAbonnementPalier(palierCourant.libelle);
      setAuthError(`Connectez-vous pour activer le palier ${palierCourant.libelle} (${palierCourant.prix}).`);
      return alerter(
        `Connectez-vous pour activer le palier ${palierCourant.libelle} (${palierCourant.prix}). Vos données sont conservées.`,
        'Connexion requise'
      );
    }

    /* PAIEMENT D'ABONNEMENT : l'argent doit aller au DÉVELOPPEUR (éditeur
       de SKYS ERP Solution), jamais au commerçant. On utilise donc la clé
       du compte développeur, non modifiable par le client. */
    const paiementEnLigne = /carte|kkiapay/i.test(abonnementPaiement || '');

    /* finaliser() n'active l'abonnement qu'après VÉRIFICATION SERVEUR de la
       transaction. Le frontend ne peut pas décider qu'un paiement est réglé. */
    const finaliser = async (transactionId = null) => {
      let referencePaiementVerifie = null;
      if (paiementEnLigne) {
        if (!transactionId) {
          await alerter(
            "Paiement non confirmé : aucune référence de transaction reçue. Votre abonnement n'a pas été activé.",
            'Abonnement'
          );
          return;
        }
        try {
          const verification = await verifierPaiementApi(transactionId, 'abonnement', { palier: niveau });
          if (!verification?.transaction?.reference) throw new Error('Paiement non validé par le serveur.');
          referencePaiementVerifie = verification.transaction.reference;
        } catch (err) {
          await alerter(messageErreur(err), 'Vérification du paiement');
          return;
        }
      }

      if (!paiementEnLigne || !referencePaiementVerifie) {
        await alerter('Un paiement vérifié est requis pour activer un abonnement.', 'Abonnement');
        return;
      }
      if (!cleKkiapayAbonnement) {
        await alerter(
          "Le paiement en ligne n'est pas encore activé par l'éditeur (clé Kkiapay absente côté serveur). Contactez le commercial pour régler votre abonnement.",
          'Paiement indisponible'
        );
        return;
      }
      const resultat = await souscrireAbonnement({
        idempotencyKey: `sub-${referencePaiementVerifie}`,
        palier: niveau,
        periode: 'mensuel',
        referenceTransaction: referencePaiementVerifie,
        moyenPaiement: 'Carte bancaire'
      });
      if (!resultat?.ok) {
        await alerter(resultat?.erreur || 'Souscription non confirmée.', 'Abonnement');
        return;
      }
      setSubscriptionLevel(niveau);
      setIsSubscribed(true);
      ecrireCleIsolee('erp_subscribed', 'true');
      await alerter(`Abonnement ${palierCourant.libelle} activé (${palierCourant.prix}).`, 'Abonnement activé');
    };

    /* Sans clé publique Kkiapay (cas actuel : /api/paiements/config renvoie
       cleKkiapay vide), le widget ne peut pas s'ouvrir. On l'annonce
       EXPLICITEMENT au lieu de ne rien faire silencieusement. */
    if (paiementEnLigne && !cleKkiapayAbonnement) {
      await alerter(
        "Le paiement en ligne n'est pas encore activé (clé Kkiapay non configurée côté serveur). Contactez le commercial : votre abonnement sera activé après règlement.",
        'Activation par le commercial'
      );
      return;
    }

    if (paiementEnLigne && typeof window.openKkiapayWidget !== 'function') {
      await alerter(
        "Le module de paiement Kkiapay n'est pas chargé. Vérifiez votre connexion puis rechargez la page.",
        'Paiement indisponible'
      );
      return;
    }

    if (paiementEnLigne && cleKkiapayAbonnement) {
      window.openKkiapayWidget({
        amount: montant,
        position: 'center',
        key: cleKkiapayAbonnement,
        callback: async reponse => {
          // Kkiapay renvoie la référence de transaction : le serveur la vérifie.
          const transactionId = reponse?.transactionId || reponse?.transaction_id || reponse?.id || null;
          await finaliser(transactionId);
        }
      });
      return;
    }

    await alerter(
      'Le renouvellement exige un paiement Kkiapay confirmé. Aucun renouvellement manuel n’est activé.',
      'Abonnement'
    );
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated || utilisateurCourant?.role !== 'Administrateur') {
      alert('Seul un administrateur authentifié peut gérer les utilisateurs.');
      return;
    }
    if (!userForm.nom || !userForm.email) return;
    if (userForm.motDePasse && (userForm.motDePasse.length < 12 || userForm.motDePasse.length > 256)) {
      alert('Le mot de passe doit contenir entre 12 et 256 caractères (ou laissez le champ vide).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
      alert('Veuillez saisir une adresse email valide.');
      return;
    }
    if (usersList.some(user => user.email?.toLowerCase() === userForm.email.trim().toLowerCase())) {
      alert('Cette adresse email est déjà utilisée.');
      return;
    }
    try {
      const utilisateur = await creerUtilisateurApi({
        nom: userForm.nom,
        email: userForm.email,
        role: userForm.role,
        // Vide => le backend génère un mot de passe temporaire.
        motDePasse: userForm.motDePasse || undefined
      });
      setUsersList(liste => [utilisateur, ...liste.filter(element => (element._id || element.id) !== (utilisateur._id || utilisateur.id))]);
      setErreurChargementUtilisateurs('');
      const invitation = {
        nom: utilisateur.nom || userForm.nom,
        email: utilisateur.email || userForm.email,
        role: utilisateur.role || userForm.role,
        lienConnexion: `${window.location.origin}${window.__SKYS_APP_BASE__ || ''}/`
      };
      setUserForm({ nom: '', email: '', role: 'Caissier', motDePasse: '' });
      let resultatMail;
      try {
        // Ne jamais envoyer ni inclure le mot de passe temporaire dans un email.
        resultatMail = await envoyerLienConnexionParMail(invitation);
      } catch (mailError) {
        resultatMail = { envoye: false, erreur: mailError.message };
      }
      setInvitationCompte({
        nom: invitation.nom,
        email: invitation.email,
        role: invitation.role,
        mailEnvoye: resultatMail.envoye,
        motDePasseTemporaire: utilisateur.motDePasseTemporaire || null
      });
      listerUtilisateursApi()
        .then(liste => {
          setUsersList(Array.isArray(liste) ? liste : []);
          setErreurChargementUtilisateurs('');
        })
        .catch(error => setErreurChargementUtilisateurs(messageErreur(error)));
      if (utilisateur.motDePasseTemporaire) {
        alert(`Compte créé.\nMot de passe temporaire : ${utilisateur.motDePasseTemporaire}\nCommuniquez-le à l'employé : il devra le changer à sa première connexion.`);
      } else if (!resultatMail.envoye) {
        alert('Compte créé. Aucun email n’a pu être envoyé : communiquez les identifiants manuellement.');
      }
    } catch (error) {
      alert(messageErreur(error));
    }
  };

  const handleDeleteUser = async (id) => {
    if (!isAuthenticated || utilisateurCourant?.role !== 'Administrateur') return;
    if (await confirmer("Désactiver cet utilisateur ?", 'Désactivation')) {
      supprimerUtilisateurApi(id)
        .then(() => listerUtilisateursApi())
        .then(setUsersList)
        .catch(error => alert(messageErreur(error)));
    }
  };

  /* Déblocage d'un compte bloqué après trop de réinitialisations de mot de
     passe. L'administrateur choisit : débloquer l'accès ou maintenir le
     blocage. Réservé à l'administrateur. */
  const handleDebloquerUser = async (id, decision) => {
    if (!isAuthenticated || utilisateurCourant?.role !== 'Administrateur') return;
    if (decision === 'laisser' && !(await confirmer('Maintenir le blocage de ce compte ?', 'Blocage'))) return;
    try {
      const resultat = await debloquerUtilisateurApi(id, decision);
      const liste = await listerUtilisateursApi();
      setUsersList(liste);
      if (resultat?.message) alert(resultat.message);
    } catch (error) {
      alert(messageErreur(error));
    }
  };

  /* ------------------------------------------------------------------
     SURVEILLANCE DES DÉPENSES
     Un utilisateur non administrateur (ou sans autorisation accordée par
     l'administrateur) qui touche au module Dépenses est filmé, l'incident
     est journalisé et l'administrateur est notifié. L'action est refusée.
     Renvoie true si l'accès est autorisé, false sinon.
     ------------------------------------------------------------------ */
  const surveillerAccesDepenses = async (action) => {
    const estAdmin = utilisateurCourant?.role === 'Administrateur' || currentUserRole === 'Administrateur';
    if (estAdmin || autorisationDepenses) return true;

    const detail = `Tentative ${action} sur le module Dépenses refusée — rôle « ${currentUserRole || 'inconnu'} » sans autorisation administrateur.`;

    setSecurityEvents(events => ajouterEvenementSecurite(events, {
      id: Date.now(),
      utilisateur: authEmail || utilisateurCourant?.email || 'Utilisateur inconnu',
      type: 'Accès dépenses non autorisé',
      detail,
      niveau: 'Critique'
    }));

    alerterSecurite(detail, {
      userEmail: authEmail || utilisateurCourant?.email || '',
      level: 'Critique'
    }).catch(() => {});

    notifier('Accès refusé : le module Dépenses est réservé à l’administrateur.', { critique: true });
    return false;
  };

  const handleDepenseSubmit = async (e) => {
    e.preventDefault();
    if (!depenseForm.libelle || !depenseForm.montant) return;

    if (!(await surveillerAccesDepenses(editingDepenseId ? 'de modification' : 'de création'))) return;

    if (isAuthenticated) {
      const donnees = {
        libelle: depenseForm.libelle,
        montant: Number(depenseForm.montant),
        categorie: depenseForm.categorie,
        date: depenseForm.date
      };

      const resultat = editingDepenseId
        ? await modifierDepense(editingDepenseId, donnees)
        : await ajouterDepense(donnees);

      if (!resultat.ok) {
        alert(resultat.erreur);
        return;
      }

      setEditingDepenseId(null);
      setDepenseForm({ libelle: '', montant: '', categorie: 'Fixe', date: new Date().toISOString().split('T')[0] });
      return;
    }

    if (editingDepenseId) {
      setDepensesList(depensesList.map(d => d.id === editingDepenseId ? { ...depenseForm, id: editingDepenseId, montant: Number(depenseForm.montant) } : d));
      setEditingDepenseId(null);
    } else {
      setDepensesList([...depensesList, { ...depenseForm, id: Date.now(), montant: Number(depenseForm.montant) }]);
    }
    setDepenseForm({ libelle: '', montant: '', categorie: 'Fixe', date: new Date().toISOString().split('T')[0] });
    alert("Dépense enregistrée avec succès !");
  };

  const handleEditDepense = async (d) => {
    if (!(await surveillerAccesDepenses('de modification'))) return;
    setEditingDepenseId(d._id || d.id);
    setDepenseForm({ libelle: d.libelle, montant: d.montant, categorie: d.categorie, date: (d.date || '').toString().slice(0, 10) || new Date().toISOString().split('T')[0] });
  };

  const handleDeleteDepense = async (id) => {
    if (!(await surveillerAccesDepenses('de suppression'))) return;
    if (!(await confirmer("Supprimer cette dépense ?", 'Suppression'))) return;

    if (isAuthenticated) {
      supprimerDepense(id).then(resultat => {
        if (!resultat.ok) alert(resultat.erreur);
      });
      return;
    }

    setDepensesList(depensesList.filter(d => d.id !== id));
  };

  const retirerDevis = async id => {
    const propose = devisList.find(d => d.id === id);
    if (propose?.quantite > 1) {
      setDevisList(devisList.map(d => d.id === id ? { ...d, quantite: d.quantite - 1, montantHT: d.prixUnitaire * (d.quantite - 1), montantTVA: d.prixUnitaire * (d.quantite - 1) * (Number(d.tva || 0) / 100), montant: d.prixUnitaire * (d.quantite - 1) * (1 + Number(d.tva || 0) / 100) } : d));
      return;
    }
    if (await confirmer(`Retirer le devis ${id} ?`, 'Suppression')) setDevisList(devisList.filter(d => d.id !== id));
  };

  const handleDevisSubmit = (e) => {
    e.preventDefault();
    if (!devisForm.client || Number(devisForm.prixUnitaire) <= 0) return;
    const tva = Number(devisForm.tva) || 0;
    const quantite = Number(devisForm.quantite) || 1;
    const prixUnitaire = Number(devisForm.prixUnitaire) || 0;
    const sousTotal = quantite * prixUnitaire;
    const montantHT = sousTotal * (1 - (Number(devisForm.remise) || 0) / 100);
    const montantTVA = montantHT * (tva / 100);
    setDevisList([...devisList, {
      ...devisForm,
      id: 'DEV-' + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString().split('T')[0],
      quantite, prixUnitaire, tva,
      remise: Number(devisForm.remise) || 0,
      sousTotal, montantHT, montantTVA,
      montant: montantHT + montantTVA
    }]);
    setDevisForm({ client: '', quantite: 1, prixUnitaire: '', tva: 18, conditions: 'Paiement à 30 jours', remise: 0, validite: '2 semaines', statut: 'En attente' });
    // Le montant affiché vient du calcul réel, pas du formulaire réinitialisé.
    notifier(`Devis créé avec succès pour ${devisForm.client}. Total TTC : ${(montantHT + montantTVA).toLocaleString()} FCFA.`);
  };

  const handleInventaireSubmit = async e => {
    e.preventDefault();
    const prodTarget = products.find(p => p.ref === invForm.ref);
    if (!prodTarget) { alert("Référence article introuvable !"); return; }
    const qtePhysique = Number(invForm.stockPhysique);
    if (!Number.isInteger(qtePhysique) || qtePhysique < 0) { alert('Saisissez une quantité entière positive ou nulle.'); return; }
    if (isAuthenticated) {
      const resultat = await definirStockPhysique(prodTarget._id, qtePhysique);
      if (!resultat.ok) { alert(resultat.erreur); return; }
      setInvForm({ ref: '', nom: '', stockPhysique: '' });
      return;
    }
    const ecartCalcul = qtePhysique - prodTarget.quantiteStock;
    setInventaireList([...inventaireList, { id: Date.now(), ref: prodTarget.ref, nom: prodTarget.nom, stockTheorique: prodTarget.quantiteStock, stockPhysique: qtePhysique, ecart: ecartCalcul, date: new Date().toISOString().split('T')[0] }]);
    setInvForm({ ref: '', nom: '', stockPhysique: '' });
    alert("Inventaire physique enregistré avec succès !");
  };

  const handleInventaireLibreSubmit = (e) => {
    e.preventDefault();
    if (isAuthenticated) {
      alert('La saisie libre d’inventaire n’est pas disponible en session serveur.');
      return;
    }
    const theorique = Number(invLibreForm.stockTheorique) || 0;
    const physique = Number(invLibreForm.stockPhysique) || 0;
    setInventaireList([...inventaireList, {
      id: Date.now(),
      ref: invLibreForm.ref.trim().toUpperCase(),
      nom: invLibreForm.nom.trim(),
      stockTheorique: theorique,
      stockPhysique: physique,
      ecart: physique - theorique,
      date: new Date().toISOString().split('T')[0]
    }]);
    setInvLibreForm({ ref: '', nom: '', stockTheorique: '', stockPhysique: '' });
    alert('Inventaire (saisie libre) enregistré.');
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    // Tous les champs sont obligatoires, sauf le code-barres (optionnel)
    const champsObligatoires = ['ref', 'nom', 'fournisseur', 'famille', 'prixAchat', 'prix', 'minStock', 'maxStock'];
    const manquant = champsObligatoires.find(champ => prodForm[champ] === '' || prodForm[champ] === null || prodForm[champ] === undefined);
    if (manquant) {
      alert('Tous les champs sont obligatoires, à l\'exception du Code-barres.');
      return;
    }

    const donnees = {
      ref: prodForm.ref,
      nom: prodForm.nom,
      codeBarre: prodForm.codeBarre || '',
      famille: prodForm.famille,
      fournisseur: prodForm.fournisseur,
      prixAchat: Number(prodForm.prixAchat),
      prix: Number(prodForm.prix),
      quantiteStock: prodForm.quantiteStock === '' ? 0 : Number(prodForm.quantiteStock),
      minStock: Number(prodForm.minStock),
      maxStock: Number(prodForm.maxStock),
      zone: prodForm.zone || prodForm.emplacement || 'Zone A',
      classe: prodForm.classe || 'Classe A'
    };

    if (!isAuthenticated) {
      // Hors session serveur : on reste en local.
      if (editingProdId) {
        setProducts(products.map(p => p._id === editingProdId ? { ...p, ...donnees } : p));
      } else {
        setProducts([...products, { ...donnees, _id: Date.now().toString() }]);
      }
      resetProdForm();
      return;
    }

    const resultat = editingProdId
      ? await modifierProduit(editingProdId, donnees)
      : await ajouterProduit(donnees);

    if (resultat.ok) resetProdForm();
    else alert(resultat.erreur);
  };

  const handleEditProd = (p) => { setEditingProdId(p._id); setProdForm({ ...p }); };
  const handleDeleteProduct = async (id) => {
    const article = products.find(produit => String(produit._id || produit.id) === String(id));
    if (!article) return;
    const confirme = await confirmer(
      `Retirer « ${article.nom} » (${article.ref}) du catalogue et de la gestion de stock ? Son historique de ventes sera conservé.`,
      'Retirer l’article'
    );
    if (!confirme) return;

    if (isAuthenticated) {
      const resultat = await supprimerProduit(id);
      if (!resultat.ok) {
        alert(resultat.erreur);
        return;
      }
      setRefsReapproMasquees(refs => refs.filter(ref => ref !== article.ref));
      return;
    }

    setProducts(current => current.filter(produit => String(produit._id || produit.id) !== String(id)));
    setRefsReapproMasquees(refs => refs.filter(ref => ref !== article.ref));
  };

  const resetProdForm = () => {
    setEditingProdId(null);
    setProdForm({ ref: '', nom: '', codeBarre: '', famille: FAMILLES_PRODUITS[0], fournisseur: '', prixAchat: '', prix: '', quantiteStock: '', minStock: '', maxStock: '', emplacement: 'Zone A', zone: 'Zone A', classe: 'Classe A' });
  };

  /* Génération automatique d'un article depuis un code scanné inconnu :
     on relie le code à la fiche catalogue en pré-remplissant la référence
     et le code-barres, puis on ouvre le module Catalogue prêt à compléter. */
  const preparerArticleDepuisCode = (code) => {
    const valeur = String(code || '').trim();
    if (!valeur) return;
    setEditingProdId(null);
    setProdForm(prev => ({
      ...prev,
      ref: prev.ref || valeur,
      codeBarre: valeur,
      famille: prev.famille || FAMILLES_PRODUITS[0]
    }));
    setActiveTab('quincaillerie');
  };

  const handleMouvementSubmit = async e => {
    e.preventDefault();
    const prodTarget = products.find(p => p.ref === mouvForm.refProd);
    const qte = Number(mouvForm.quantite);
    if (!prodTarget || !Number.isInteger(qte) || qte <= 0) {
      alert('Sélectionnez un article et une quantité entière strictement positive.');
      return;
    }
    if (isAuthenticated) {
      const resultat = await ajusterStock(prodTarget._id, qte, mouvementSubTab, mouvForm.motif, depotActif);
      if (!resultat.ok) { alert(resultat.erreur); return; }
      setMouvForm({ date: new Date().toISOString().split('T')[0], type: 'ENTREE', refProd: '', nomCustom: '', quantite: '', motif: '' });
      return;
    }
    const nomArticle = mouvForm.nomCustom || prodTarget.nom;

    if (prodTarget && (mouvementSubTab === 'ENTREE' || mouvementSubTab === 'ACHAT' || mouvementSubTab === 'RECEPTION')) {
      const newStock = prodTarget.quantiteStock + qte;
      setProducts(products.map(p => p.ref === mouvForm.refProd ? { ...p, quantiteStock: newStock } : p));
    } else if (prodTarget && mouvementSubTab === 'SORTIE') {
      const newStock = prodTarget.quantiteStock - qte;
      setProducts(products.map(p => p.ref === mouvForm.refProd ? { ...p, quantiteStock: newStock } : p));
    }

    setMouvements([{ id: Date.now(), date: mouvForm.date, type: mouvementSubTab, refProd: mouvForm.refProd || 'REF-LIBRE', nomProd: nomArticle, quantite: qte, motif: mouvForm.motif }, ...mouvements]);
    setMouvForm({ date: new Date().toISOString().split('T')[0], type: 'ENTREE', refProd: '', nomCustom: '', quantite: '', motif: '' });
    alert("Mouvement enregistré !");
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    if (!REGIONS_VILLES[clientForm.region]?.includes(clientForm.ville)) {
      alert('Choisissez une ville appartenant à la région sélectionnée.');
      return;
    }

    if (isAuthenticated) {
      const donnees = {
        nom: clientForm.nom,
        email: clientForm.email || '',
        telephone: clientForm.telephone || '',
        region: clientForm.region,
        ville: clientForm.ville,
        district: clientForm.district || ''
      };
      const operation = editingClientId
        ? modifierClient(editingClientId, donnees)
        : ajouterClient(donnees);
      const resultat = await operation;

      if (resultat.ok) {
        setEditingClientId(null);
        setClientForm(CLIENT_INITIAL);
      } else {
        alert(resultat.erreur);
      }
      return;
    }

    if (editingClientId) {
      setClients(clients.map(c => c.id === editingClientId ? { ...clientForm, id: editingClientId } : c));
      setEditingClientId(null);
    } else {
      setClients([...clients, { ...clientForm, id: Date.now() }]);
    }
    setClientForm(CLIENT_INITIAL);
  };

  const handleEditClient = c => {
    setEditingClientId(c._id || c.id);
    setClientForm({ nom: c.nom, email: c.email, telephone: c.telephone, region: c.region, ville: c.ville });
  };
  const handleDeleteClient = async id => {
    if (!(await confirmer('Supprimer ce client ?', 'Suppression'))) return;
    if (isAuthenticated) {
      const resultat = await supprimerClient(id);
      if (!resultat.ok) alert(resultat.erreur);
    } else setClients(clients.filter(c => c.id !== id));
  };

  const handleTransportSubmit = async (e) => {
    e.preventDefault();

    const donnees = {
      nomResponsable: transpForm.nomResponsable,
      prenomsResponsable: transpForm.prenomsResponsable,
      vehicule: transpForm.vehicule,
      immatriculation: transpForm.immatriculation,
      nombreVoyage: Number(transpForm.nombreVoyage) || 1,
      destination: transpForm.destination,
      client: transpForm.client,
      frais: Number(transpForm.frais),
      commentaires: transpForm.commentaires
    };

    if (isAuthenticated) {
      const resultat = editingTransportId
        ? await modifierTransport(editingTransportId, donnees)
        : await ajouterTransport(donnees);

      if (!resultat.ok) {
        alert(resultat.erreur);
        return;
      }

      setEditingTransportId(null);
      setTranspForm({ nomResponsable: '', prenomsResponsable: '', vehicule: '', immatriculation: '', nombreVoyage: 1, destination: '', client: '', frais: '', commentaires: '' });

      // Mémorise la nouvelle immatriculation dans la flotte
      const plaque = String(transpForm.immatriculation || '').trim().toUpperCase();
      if (plaque && !vehicules.some(vehicule => String(vehicule.immatriculation).toUpperCase() === plaque)) {
        setVehicules(liste => [...liste, { id: Date.now(), immatriculation: plaque, type: transpForm.vehicule, capacite: '—', conducteur: `${transpForm.nomResponsable} ${transpForm.prenomsResponsable}` }]);
      }
      return;
    }

    if (editingTransportId) {
      setTransports(transports.map(tr => tr.id === editingTransportId ? { ...transpForm, id: editingTransportId, frais: Number(transpForm.frais), nombreVoyage: Number(transpForm.nombreVoyage) || 1, date: tr.date } : tr));
      setEditingTransportId(null);
    } else {
      setTransports([...transports, { ...transpForm, id: Date.now(), frais: Number(transpForm.frais), nombreVoyage: Number(transpForm.nombreVoyage) || 1, date: new Date().toISOString().split('T')[0] }]);
      // Mémorise la nouvelle immatriculation dans la flotte
      const plaque = String(transpForm.immatriculation || '').trim().toUpperCase();
      if (plaque && !vehicules.some(vehicule => String(vehicule.immatriculation).toUpperCase() === plaque)) {
        setVehicules(liste => [...liste, { id: Date.now(), immatriculation: plaque, type: transpForm.vehicule, capacite: '—', conducteur: `${transpForm.nomResponsable} ${transpForm.prenomsResponsable}` }]);
      }
    }
    setTranspForm({ nomResponsable: '', prenomsResponsable: '', vehicule: '', immatriculation: '', nombreVoyage: 1, destination: '', client: '', frais: '', commentaires: '' });
    alert("Expédition enregistrée !");
  };

  const handleEditTransport = tr => {
    setEditingTransportId(tr._id || tr.id);
    setTranspForm({
      nomResponsable: tr.nomResponsable,
      prenomsResponsable: tr.prenomsResponsable,
      vehicule: tr.vehicule,
      immatriculation: tr.immatriculation || '',
      nombreVoyage: tr.nombreVoyage || 1,
      destination: tr.destination,
      client: tr.client,
      frais: tr.frais,
      commentaires: tr.commentaires || ''
    });
  };

  const handleDeleteTransport = async id => {
    if (!(await confirmer('Supprimer cet enregistrement de transport ?', 'Suppression'))) return;

    if (isAuthenticated) {
      supprimerTransport(id).then(resultat => {
        if (!resultat.ok) alert(resultat.erreur);
      });
      return;
    }

    setTransports(transports.filter(tr => tr.id !== id));
  };

  const handleDeleteDossier = async dossier => {
    if (!(await confirmer(`Supprimer le document « ${dossier.titre} » ?`, 'Suppression'))) return;

    try {
      await supprimerDossierEnregistre(dossier.id);
      URL.revokeObjectURL(dossier.image);
      setDossiers(documents => documents.filter(document => document.id !== dossier.id));

      if (selectedDocPreview?.id === dossier.id) {
        setSelectedDocPreview(null);
      }
    } catch (error) {
      console.error('Impossible de supprimer le justificatif :', error);
      alert('La suppression du document a échoué.');
    }
  };

  const handleUploadDossier = async e => {
    e.preventDefault();

    const formulaire = e.currentTarget;
    const fichier = newDossierFile;

    if (!newDossierTitre.trim() || !fichier) {
      alert('Veuillez saisir un titre et choisir un fichier.');
      return;
    }

    const dossier = {
      id: Date.now(),
      titre: newDossierTitre.trim(),
      nomFichier: fichier.name,
      type: fichier.type,
      fichier
    };

    try {
      await enregistrerDossier(dossier);

      setDossiers(docs => [
        ...docs,
        { ...dossier, image: URL.createObjectURL(fichier) }
      ]);

      setNewDossierTitre('');
      setNewDossierFile(null);
      formulaire.reset();
      alert('Justificatif enregistré.');
    } catch (error) {
      console.error('Impossible d’enregistrer le justificatif :', error);
      alert('Enregistrement impossible. Vérifiez l’espace disponible dans le navigateur.');
    }
  };

  const ajouterAuPanier = (produit) => {
    const existant = panier.find(item => item._id === produit._id);
    if (existant) {
      setPanier(panier.map(item => item._id === produit._id ? { ...item, qteVente: item.qteVente + 1 } : item));
    } else {
      setPanier([...panier, { ...produit, qteVente: 1 }]);
    }
  };

  /* Réduire la quantité de l'article sélectionné (ou du dernier ajouté) :
     décrémente la quantité, et retire l'article du panier quand elle tombe à 0. */
  const reduireQuantitePanier = (produit) => {
    const cible = produit || panier[panier.length - 1];
    if (!cible) return;
    setPanier(liste => liste
      .map(item => item._id === cible._id ? { ...item, qteVente: item.qteVente - 1 } : item)
      .filter(item => item.qteVente > 0)
    );
  };

  const retirerDuPanier = (id) => setPanier(panier.filter(item => item._id !== id));
  const totalPanier = panier.reduce((acc, item) => acc + (item.prix * item.qteVente), 0);

const lancerPaiementKkiapay = async () => {
    if (panier.length === 0) return alert("Panier vide !");

    // Un mode externe ne doit jamais être enregistré comme réglé avant
    // confirmation vérifiée par le prestataire ou par l'administrateur.
    if (selectedPaymentMethod === 'Espèces') {
      const confirmation = await confirmer(
        `Moyen de paiement sélectionné : ${selectedPaymentMethod}.\n\nConfirmez-vous la réception des espèces avant de valider la vente ?`,
        'Confirmation d\'encaissement'
      );
      if (!confirmation) return;
      return validerTransaction();
    }

    if (!['Carte bancaire / Kkiapay', 'Carte bancaire'].includes(selectedPaymentMethod)) {
      return alerter(`Le paiement ${selectedPaymentMethod} nécessite le prestataire correspondant. Aucune vente ne sera enregistrée sans confirmation serveur.`);
    }

    /* PAIEMENT DE VENTE : l'argent doit aller sur le compte DU COMMERÇANT.
       On utilise donc SA clé Kkiapay, jamais celle du développeur. */
    const configVente = configKkiapayVente(paiementCommercant, totalPanier);
    if (!configVente.cle) {
      return alerter(
        "Paiement en ligne non configuré. Renseignez votre clé Kkiapay dans Configuration → « Moyens de paiement du commerçant » pour recevoir les paiements de vos ventes. En attendant, encaissez en espèces.",
        'Paiement du commerçant'
      );
    }
    if (typeof window.openKkiapayWidget !== "function") {
      return alerter("Le module de paiement Kkiapay n'est pas chargé. Vérifiez le script CDN dans index.html.");
    }
    window.openKkiapayWidget({
      amount: configVente.montant,
      position: "center",
      key: configVente.cle,
      callback: async reponse => {
        // La vente n'est enregistrée qu'après VÉRIFICATION SERVEUR du paiement.
        const transactionId = reponse?.transactionId || reponse?.transaction_id || reponse?.id || null;
        if (!transactionId) {
          await alerter("Paiement non confirmé : aucune référence reçue. La vente n'a pas été enregistrée.", 'Paiement');
          return;
        }
        try {
          // Créer d'abord la vente au prix catalogue serveur; le stock n'est
          // modifié qu'après la vérification de ce paiement précis.
          const client = clients.find(c => String(c.id || c._id) === String(selectedClientTx));
          const creation = await enregistrerVente({
            idempotencyKey: paiementIdempotence,
            clientId: client?._id || null,
            clientNom: client?.nom || selectedClientTx || 'Client Comptoir',
            lignes: panier.map(item => ({ produitId: item._id, quantite: item.qteVente })),
            remise: 0,
            tva: Number(entrepriseCourante?.tauxTva) || 0,
            moyenPaiement: 'Kkiapay',
            operateur: utilisateurCourant?.nom || '',
            depot: 'Dépôt Principal'
          });
          if (!creation.ok) {
            await alerter(creation.erreur, 'Création de la vente');
            return;
          }
          const verification = await verifierPaiementApi(transactionId, 'vente', { venteId: creation.resultat._id });
          if (!verification?.transaction) {
            await alerter("Paiement en attente de vérification. Vérifiez la vente avant toute nouvelle tentative.", 'Paiement');
            return;
          }
          const ventePayee = {
            ...creation.resultat,
            statutPaiement: 'payee',
            transactionPaiement: verification.transaction.reference
          };
          setVentesLocales(ventes => [ventePayee, ...ventes].slice(0, 500));
          setDerniereTransaction({
            id: ventePayee.reference,
            date: new Date().toLocaleString(),
            client: ventePayee.clientNom,
            items: panier,
            total: ventePayee.total,
            paiement: ventePayee.moyenPaiement
          });
          setPanier([]);
          setPaiementIdempotence(window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
          setBarcodeInput('');
          setSelectedClientTx('');
          setSelectedPosCatalogItem('');
          setScanResult(null);
          alerter('Paiement vérifié et vente enregistrée.', 'Paiement accepté');
        } catch (err) {
          await alerter(messageErreur(err), 'Vérification du paiement');
        }
      }
    });
  };

  /* =========================================================
     VENTE DE GAZ — logique métier
     Calcule le montant (recharge/vente + consigne), enregistre la
     vente et prépare le reçu professionnel.
     ========================================================= */
  const prixGazTotal = () => {
    const quantite = Number(gazForm.quantite) || 0;
    const prixUnitaire = Number(gazForm.prixUnitaire) || 0;
    const consigne = gazForm.consigne ? Number(gazForm.consigneMontant) || 0 : 0;
    return { quantite, prixUnitaire, consigne, sousTotal: quantite * prixUnitaire, total: quantite * prixUnitaire + consigne };
  };

  const validerVenteGaz = () => {
    const { quantite, prixUnitaire, consigne, total } = prixGazTotal();
    if (!quantite || quantite <= 0) return alert('Saisissez une quantité valide.');
    if (!prixUnitaire || prixUnitaire <= 0) return alert('Saisissez un prix unitaire valide.');

    const bouteille = BOUTEILLES_GAZ.find(b => b.code === gazForm.bouteille);
    const vente = {
      id: `GAZ-${Date.now()}`,
      date: new Date().toLocaleString('fr-FR'),
      client: gazForm.client || 'Client comptoir',
      bouteille: bouteille ? bouteille.libelle : gazForm.bouteille,
      prestation: gazForm.prestation,
      quantite,
      prixUnitaire,
      consigne,
      total,
      moyenPaiement: gazForm.moyenPaiement,
      livreur: gazForm.livreur || '',
      destination: gazForm.destination || ''
    };

    setGazVentes(liste => [vente, ...liste].slice(0, 200));
    setGazRecu(vente);
    setGazForm(prev => ({ ...prev, quantite: 1, prixUnitaire: '', client: '', consigne: false, consigneMontant: 0, livreur: '', destination: '' }));
    notifier(`Vente de gaz enregistrée : ${total.toLocaleString()} FCFA.`);
  };

  const validerTransaction = async () => {
    if (panier.length === 0) return alert("Panier vide !");
    const confirmationModesExternes = MOYENS_PAIEMENT.filter(moyen => moyen !== 'Espèces');
    if (confirmationModesExternes.includes(selectedPaymentMethod)) {
      alert(`Vérification serveur obligatoire pour ${selectedPaymentMethod}. Aucune vente n’a été enregistrée.`);
      return;
    }
    const lignes = [...panier];
    if (selectedPaymentMethod === 'Espèces' && typeof window.confirm === 'function' && !window.confirm('Confirmez-vous la réception de la totalité du paiement en espèces ?')) return;
    const total = totalPanier;

    if (isAuthenticated) {
      // Le serveur décrémente le stock en transaction et journalise
      // les mouvements : ne rien faire en local pour éviter un doublon.
      const client = clients.find(c => String(c.id || c._id) === String(selectedClientTx));

      const resultat = await enregistrerVente({
        idempotencyKey: paiementIdempotence,
        clientId: client?._id || null,
        clientNom: clients.find(c => String(c._id || c.id) === String(selectedClientTx))?.nom || selectedClientTx || 'Client Comptoir',
        lignes: lignes.map(item => ({
          produitId: item._id,
          quantite: item.qteVente,
          prixUnitaire: item.prix
        })),
        remise: 0,
        tva: Number(entrepriseCourante?.tauxTva) || 0,
        moyenPaiement: selectedPaymentMethod,
        operateur: utilisateurCourant?.nom || '',
        depot: 'Dépôt Principal'
      });

      if (!resultat.ok) {
        alert(resultat.erreur);
        return;
      }

      const vente = resultat.resultat;
      setDerniereTransaction({
        id: vente.reference,
        date: new Date().toLocaleString(),
        client: vente.clientNom,
        items: lignes,
        total: vente.total,
        paiement: vente.moyenPaiement
      });

      setPanier([]);
      setPaiementIdempotence(typeof window.crypto?.randomUUID === 'function' ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      setBarcodeInput('');
      setSelectedClientTx('');
      setSelectedPosCatalogItem('');
      setScanResult(null);
      alert(`Transaction validée ! ${lignes.length} ligne(s) enregistrée(s).`);
      return;
    }

    // Hors session serveur : comportement local historique.
    let updatedProducts = [...products];
    panier.forEach(item => {
      updatedProducts = updatedProducts.map(p => p._id === item._id ? { ...p, quantiteStock: p.quantiteStock - item.qteVente } : p);
    });
    setProducts(updatedProducts);

    // Historique automatique : SORTIE de stock pour chaque ligne vendue
    const mouvementsVentes = lignes.map(item => ({
      id: `${Date.now()}-${item._id}`,
      date: new Date().toISOString().split('T')[0],
      type: 'SORTIE',
      refProd: item.ref,
      nomProd: item.nom,
      quantite: item.qteVente,
      motif: `Vente comptoir - ${selectedClientTx || 'Client Comptoir'}`
    }));
    setMouvements(listeMouvements => [...mouvementsVentes, ...listeMouvements]);

    const venteLocale = {
      id: 'REC-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toLocaleString(),
      client: selectedClientTx || 'Client Comptoir',
      items: lignes,
      total,
      paiement: selectedPaymentMethod
    };
    setDerniereTransaction(venteLocale);
    setVentesLocales(ventes => [venteLocale, ...ventes].slice(0, 500));

    // Nettoyage automatique des champs pour l'opération suivante
    setPanier([]);
    setBarcodeInput('');
    setSelectedClientTx('');
    setSelectedPosCatalogItem('');
    setScanResult(null);
    alert(`Transaction validée ! ${lignes.length} ligne(s) enregistrée(s) dans l'historique des mouvements.`);
  };

  const imprimerRecuFacture = () => {
    imprimer();
  };

  /* =========================================================
     SCANNER UNIVERSEL
     Associe un code-barres lu (EAN-13, code article, etc.)
     à la base articles, puis remplit nom + prix automatiquement.
     ========================================================= */
  const rechercherParCode = code => {
    const brut = String(code || '').trim();
    if (!brut) return null;

    const normalise = valeur => String(valeur || '').toLowerCase().replace(/[\s-_]/g, '');
    const cible = normalise(brut);

    return products.find(produit =>
      normalise(produit.ref) === cible
      || normalise(produit.codeBarre || '') === cible
      || (produit.ean && normalise(produit.ean) === cible)
    ) || null;
  };

  const traiterCodeScanne = (code, { ajouter = true } = {}) => {
    const brut = String(code || '').trim();
    if (!brut) return false;

    const produit = isAuthenticated
      ? products.find(article => {
        const normalise = valeur => String(valeur || '').toLowerCase().replace(/[\s-_]/g, '');
        const cible = normalise(brut);
        return normalise(article.ref) === cible
          || normalise(article.codeBarre) === cible
          || normalise(article.ean) === cible;
      }) || null
      : rechercherParCode(brut);

    setScanHistory(historique => [{ id: `${Date.now()}-${Math.random()}`, code: brut, article: produit?.nom || null, date: new Date().toISOString() }, ...historique].slice(0, 500));

    if (!produit) {
      // Code lu mais absent du catalogue : aucune alerte bloquante.
      // On conserve la valeur dans le champ de saisie manuelle pour que
      // l'utilisateur puisse la compléter ou l'ajouter au catalogue.
      setScanResult({ code: brut, trouvé: false });
      setBarcodeInput(brut);
      return false;
    }

    // Nom et prix alimentés automatiquement
    setScanResult({ code: brut, trouvé: true, produit });

    if (ajouter) {
      setPanier(panierActuel => {
        const dejaPresent = panierActuel.find(item => item._id === produit._id);
        return dejaPresent
          ? panierActuel.map(item => item._id === produit._id ? { ...item, qteVente: item.qteVente + 1 } : item)
          : [...panierActuel, { ...produit, qteVente: 1 }];
      });
      setSelectedPosCatalogItem(produit._id);
    }

    setBarcodeInput('');
    return true;
  };

  const handleBarcodeScan = (e) => {
    e.preventDefault();
    const code = barcodeInputRef.current || barcodeInput;
    barcodeInputRef.current = '';
    setBarcodeInput('');
    traiterCodeScanne(code);
    requestAnimationFrame(() => scannerInputRef.current?.focus());
  };

  // La douchette USB agit comme un clavier : utiliser l'input dédié évite
  // toute capture globale susceptible d'interférer avec les autres formulaires.
  const traiterEntreeDouchette = event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const code = event.currentTarget.value.trim();
    barcodeInputRef.current = '';
    setBarcodeInput('');
    if (code) traiterCodeScanne(code);
    requestAnimationFrame(() => scannerInputRef.current?.focus());
  };

  useEffect(() => {
    if (activeTab !== 'transaction') return undefined;
    let timeout;
    const listenForScanner = event => {
      const target = event.target;
      const isEditable = target?.matches?.('input, textarea, select, [contenteditable="true"]');
      if (isEditable && target !== scannerInputRef.current) return;

      const now = Date.now();
      if (now - scanLastKeyTimeRef.current > 100) scanBufferRef.current = '';
      scanLastKeyTimeRef.current = now;
      if (event.key === 'Enter') {
        const scanned = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        if (scanned) {
          event.preventDefault();
          barcodeInputRef.current = '';
          setBarcodeInput('');
          traiterCodeScanne(scanned);
          timeout = window.setTimeout(() => scannerInputRef.current?.focus(), 0);
        }
      } else if (event.key?.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        scanBufferRef.current += event.key;
      }
    };
    window.addEventListener('keydown', listenForScanner);
    return () => {
      window.removeEventListener('keydown', listenForScanner);
      window.clearTimeout(timeout);
      scanBufferRef.current = '';
    };
  }, [activeTab, products, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  /* =========================================================
     CAMERA : le composant ScannerHtml5 gere lui-meme le flux video
        et le changement de camera. Aucun <video> React a monter ici.
     ========================================================= */

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!noteForm.titre || !noteForm.contenu) return;
    setNotesList([{ id: Date.now(), ...noteForm, date: new Date().toLocaleDateString() }, ...notesList]);
    setNoteForm({ titre: '', contenu: '' });
  };

  const handleDeleteNote = (id) => setNotesList(notesList.filter(n => n.id !== id));

  const totalValeurStock = products.reduce((acc, item) => acc + (Number(item.prix) * Number(item.quantiteStock) || 0), 0);
  const totalFraisTransport = transports.reduce((acc, item) => acc + (Number(item.frais) || 0), 0);
  const totalDepensesReelles = depensesList.reduce((acc, item) => acc + (Number(item.montant) || 0), 0);
  const totalAchatsRecus = purchaseOrders
    .filter(commande => commande.statut === 'Réceptionnée')
    .reduce((total, commande) => total + (Number(commande.prixAchat) * Number(commande.quantite)), 0);

  /* ------------------------------------------------------------------
     INDICATEURS FINANCIERS — cohérence de période
     Toutes les valeurs sont ramenées à la MÊME période : le chiffre
     d'affaires, les charges ET les achats sont multipliés par le même
     facteur. Auparavant, seul le côté charges l'était, ce qui faussait
     le bénéfice. Aucune charge forfaitaire fictive n'est ajoutée.
     ------------------------------------------------------------------ */
  const periodMultiplier = reportPeriod === 'mensuel' ? 1 : reportPeriod === 'trimestriel' ? 3 : 12;

  // Chiffre d'affaires réel (ventes uniquement : les frais de transport
  // sont des produits annexes, comptés séparément).
  const ventesBrutes = isAuthenticated
    ? ventesApi.reduce((sum, vente) => sum + (Number(vente.total) || 0), 0)
    : ventesLocales.reduce((sum, vente) => sum + (Number(vente.total) || 0), 0);
  const caVentes = ventesBrutes * periodMultiplier;

  // Charges réelles de la période : dépenses + achats + frais de transport.
  const chargesPeriode = (totalDepensesReelles + totalAchatsRecus + totalFraisTransport) * periodMultiplier;

  // Résultat net = ventes + produits annexes (transport) - charges réelles.
  const caTotalEstime = caVentes + totalFraisTransport * periodMultiplier;
  const beneficeNet = caTotalEstime - chargesPeriode;

  /* ------------------------------------------------------------------
     RÉSUMÉ AUTOMATIQUE — analyse des données réelles
     Produit un texte de synthèse : santé financière, stock, alertes,
     tendances et recommandations concrètes.
     ------------------------------------------------------------------ */
  const resumeAutomatique = useMemo(() => {
    const phrases = [];
    const marge = caTotalEstime > 0 ? (beneficeNet / caTotalEstime) * 100 : 0;
    const articlesStockBas = products.filter(p => Number(p.quantiteStock) <= Number(p.minStock));
    const enRupture = products.filter(p => Number(p.quantiteStock) <= 0);
    const nombreClients = clients.length;
    const nombreVentes = isAuthenticated ? ventesApi.length : ventesLocales.length;

    // 1. Santé financière
    if (caTotalEstime <= 0 && chargesPeriode <= 0) {
      phrases.push("Aucune activité financière enregistrée pour cette période. Enregistrez des ventes et des dépenses pour voir apparaître une analyse.");
    } else if (beneficeNet > 0) {
      phrases.push(`L'activité est bénéficiaire sur la période : un résultat net de ${beneficeNet.toLocaleString()} FCFA pour ${caTotalEstime.toLocaleString()} FCFA de chiffre d'affaires, soit une marge de ${marge.toFixed(1)} %.`);
      if (marge >= 30) phrases.push('La marge est confortable : la structure de coûts est maîtrisée.');
      else if (marge < 10) phrases.push('La marge reste faible : surveillez les prix d\'achat et les charges pour sécuriser la rentabilité.');
    } else if (beneficeNet < 0) {
      phrases.push(`Attention : la période est déficitaire avec ${Math.abs(beneficeNet).toLocaleString()} FCFA de perte. Les charges (${chargesPeriode.toLocaleString()} FCFA) dépassent le chiffre d'affaires (${caTotalEstime.toLocaleString()} FCFA).`);
      phrases.push('Réduisez les dépenses non essentielles ou augmentez les ventes pour rétablir l\'équilibre.');
    } else {
      phrases.push(`L'activité est à l'équilibre sur la période : ${caTotalEstime.toLocaleString()} FCFA de chiffre d'affaires pour ${chargesPeriode.toLocaleString()} FCFA de charges.`);
    }

    // 2. Comparaison charges / CA
    if (caTotalEstime > 0) {
      const ratioCharges = (chargesPeriode / caTotalEstime) * 100;
      if (ratioCharges > 90 && beneficeNet >= 0) {
        phrases.push(`Les charges représentent ${ratioCharges.toFixed(0)} % du chiffre d'affaires : la marge de manœuvre est très réduite.`);
      }
    }

    // 3. Ventes et clients
    if (nombreVentes === 0) {
      phrases.push("Aucune vente n'a été enregistrée sur la période.");
    } else {
      const panierMoyen = caVentes / nombreVentes;
      phrases.push(`${nombreVentes} vente(s) enregistrée(s), pour un panier moyen de ${panierMoyen.toLocaleString(undefined, { maximumFractionDigits: 0 })} FCFA.`);
      if (nombreClients === 0) phrases.push('Aucun client enregistré : pensez à fidéliser votre clientèle en créant des fiches clients.');
    }

    // 4. État du stock
    if (products.length === 0) {
      phrases.push('Le catalogue est vide : ajoutez des articles pour activer le suivi du stock.');
    } else {
      phrases.push(`Le catalogue compte ${products.length} article(s) pour une valeur totale de ${totalValeurStock.toLocaleString()} FCFA.`);
      if (enRupture.length > 0) {
        phrases.push(`Alerte : ${enRupture.length} article(s) en rupture de stock : ${enRupture.slice(0, 3).map(p => p.nom).join(', ')}${enRupture.length > 3 ? '…' : ''}. Réapprovisionnement urgent conseillé.`);
      }
      if (articlesStockBas.length > 0) {
        phrases.push(`Attention : ${articlesStockBas.length} article(s) sous le seuil d'alerte : lancez les commandes fournisseurs pour éviter les ruptures.`);
      } else if (enRupture.length === 0) {
        phrases.push('Tous les stocks sont au-dessus de leur seuil d\'alerte : situation saine.');
      }
    }

    // 5. Dépenses
    if (totalDepensesReelles > 0) {
      const plusGrosse = [...depensesList].sort((a, b) => Number(b.montant) - Number(a.montant))[0];
      phrases.push(`Les dépenses totalisent ${totalDepensesReelles.toLocaleString()} FCFA${plusGrosse ? `, dont la plus importante : « ${plusGrosse.libelle} » (${Number(plusGrosse.montant).toLocaleString()} FCFA)` : ''}.`);
    }

    // 6. Achats fournisseurs
    if (totalAchatsRecus > 0) {
      phrases.push(`Les achats réceptionnés représentent ${totalAchatsRecus.toLocaleString()} FCFA sur la période.`);
    }
    const commandesEnAttente = purchaseOrders.filter(c => c.statut !== 'Réceptionnée').length;
    if (commandesEnAttente > 0) {
      phrases.push(`${commandesEnAttente} commande(s) fournisseur en attente de réception.`);
    }

    // 7. Conclusion / recommandation prioritaire
    if (beneficeNet < 0) {
      phrases.push('Recommandation prioritaire : revoir les charges et relancer les ventes.');
    } else if (enRupture.length > 0) {
      phrases.push('Recommandation prioritaire : réapprovisionner les articles en rupture.');
    } else if (articlesStockBas.length > 0) {
      phrases.push('Recommandation prioritaire : anticiper le réapprovisionnement des articles en alerte.');
    } else if (caTotalEstime > 0 && marge >= 10) {
      phrases.push('Recommandation : la situation est saine, poursuivez le suivi régulier.');
    }

    return phrases.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caTotalEstime, chargesPeriode, beneficeNet, products, clients, depensesList, purchaseOrders, transports, reportPeriod, isAuthenticated, ventesApi.length, ventesLocales.length]);

  const exporterRapportCsv = () => {
    const lignes = [
      ['Indicateur', 'Montant'],
      ['Période', reportPeriod],
      ['Chiffre d’affaires', `${caTotalEstime} FCFA`],
      ['Charges d’exploitation', `${chargesPeriode} FCFA`],
      ['Bénéfice net', `${beneficeNet} FCFA`]
    ];
    const csv = lignes.map(ligne => ligne.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `rapport-${reportPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  };

  /* Écran bloquant : tant que le mot de passe temporaire n'a pas été changé,
     l'utilisateur ne peut pas accéder à l'application. */
  if (isAuthenticated && doitChangerMotDePasse) {
    return (
      <div
        className="login-shell sensitive-password-shell"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0284c7 100%)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto', fontFamily: "'Segoe UI', sans-serif" }}
      >
        <div className="login-card sensitive-password-card" style={{ backgroundColor: '#fff', padding: '28px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 12px 34px rgba(0,0,0,0.28)' }}>
          <h1 style={{ color: '#0f172a', margin: '0 0 6px', fontWeight: 'bold', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px' }}><Icone nom="tresorerie" taille={20} /> Première connexion</h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '18px' }}>
            Votre mot de passe est temporaire. Pour continuer, choisissez un nouveau mot de passe personnel.
          </p>
          <form onSubmit={handleChangementMotDePasseObligatoire} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              placeholder="Mot de passe temporaire"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="password"
              placeholder="Nouveau mot de passe (12 caractères min.)"
              value={nouveauMotDePasseObligatoire}
              onChange={e => setNouveauMotDePasseObligatoire(e.target.value)}
              minLength={12}
              maxLength={256}
              required
              autoComplete="new-password"
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="password"
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmationNouveauMotDePasse}
              onChange={e => setConfirmationNouveauMotDePasse(e.target.value)}
              minLength={12}
              maxLength={256}
              required
              autoComplete="new-password"
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
            {erreurChangement && <p style={{ color: '#ef4444', fontSize: '12px', margin: 0 }}>{erreurChangement}</p>}
            <button type="submit" style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', padding: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
              Enregistrer mon mot de passe
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* Essai/abonnement expiré (détecté localement ou signalé par le serveur) :
     l'écran de blocage prime sur l'écran de connexion. Sinon, un 402 serveur
     renverrait l'utilisateur vers la connexion sans expliquer la coupure. */
  if (trialExpired) {
    const dejaAbonneExpire = isSubscribed || abonnementExpireServeur;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '20px', overflowY: 'auto', fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '720px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', color: '#64748b' }}>
            <Icone nom={dejaAbonneExpire ? 'calendrier' : 'verrou'} taille={44} epaisseur={1.5} />
          </div>
          <h1 style={{ fontSize: '22px', color: '#1e293b', marginBottom: '8px' }}>
            {dejaAbonneExpire ? 'Votre abonnement a expiré' : 'Votre période d’essai est expirée'}
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0 auto 22px', maxWidth: '520px' }}>
            Vos données sont conservées en sécurité. Activez un abonnement pour reprendre immédiatement la gestion de votre activité — sans ressaisie, tout est déjà là.
          </p>

          {/* Paliers présentés avec leurs avantages : incitation au paiement. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', textAlign: 'left', marginBottom: '20px' }}>
            {PALIERS.map(palier => (
              <div
                key={palier.code}
                style={{
                  backgroundColor: '#fff',
                  border: palier.recommande ? `2px solid ${palier.couleur}` : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px',
                  position: 'relative'
                }}
              >
                {palier.recommande && (
                  <span style={{ position: 'absolute', top: '-10px', right: '12px', backgroundColor: palier.couleur, color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '999px' }}>
                    RECOMMANDÉ
                  </span>
                )}
                <h3 style={{ margin: '0 0 2px', fontSize: '14px', color: palier.couleur }}>{palier.libelle}</h3>
                <p style={{ margin: '0 0 8px', fontWeight: 'bold', color: '#0f172a', fontSize: '16px' }}>{palier.prixTexte}</p>
                <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#64748b' }}>{palier.comptesTexte}</p>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#334155', lineHeight: '1.6' }}>
                  {palier.avantages.map(avantage => (
                    <li key={avantage} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginBottom: '2px' }}>
                      <Icone nom="succes" taille={13} couleur={palier.couleur} />
                      <span>{avantage}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handlePaySubscription(palier.code)}
                  style={{ marginTop: '12px', width: '100%', backgroundColor: palier.couleur, color: 'white', border: 'none', padding: '9px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Activer ce palier
                </button>
              </div>
            ))}
          </div>

          {/* Règlement rapide par mobile money. */}
          <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', margin: '0 0 8px' }}>Régler par Mobile Money :</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <button onClick={() => handlePaySubscription('wave')} style={{ backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '9px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <PastilleMobileMoney operateur="wave" taille={15} /> Wave
            </button>
            <button onClick={() => handlePaySubscription('orange')} style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '9px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <PastilleMobileMoney operateur="orange" taille={15} /> Orange Money
            </button>
            <button onClick={() => handlePaySubscription('moov')} style={{ backgroundColor: '#047857', color: 'white', border: 'none', padding: '9px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <PastilleMobileMoney operateur="moov" taille={15} /> Moov
            </button>
            <button onClick={() => handlePaySubscription('mtn')} style={{ backgroundColor: '#eab308', color: '#111', border: 'none', padding: '9px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <PastilleMobileMoney operateur="mtn" taille={15} /> MTN
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleActualiserAbonnement}
              style={{ flex: 1, minWidth: '180px', backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '11px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <Icone nom="succes" taille={15} /> J’ai déjà payé — Actualiser mon abonnement
            </button>
            <a
              href={lienContactCommercial(COMPTE_DEVELOPPEUR?.operateur, storeInfo?.nomMagasin)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, minWidth: '180px', textAlign: 'center', backgroundColor: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '11px', borderRadius: '6px', fontWeight: 'bold', textDecoration: 'none' }}
            >
              Contacter le commercial
            </a>
            <button
              type="button"
              onClick={logout}
              style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '11px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Se déconnecter
            </button>
          </div>

          {authError && (
            <p role="alert" style={{ marginTop: '14px', fontSize: '12px', color: '#b91c1c', textAlign: 'left' }}>{authError}</p>
          )}
        </div>
      </div>
    );
  }

  /* Vérification de session en cours : ni ERP, ni connexion. Afficher l'ERP
     maintenant laisserait apercevoir le tableau de bord avant que le serveur
     n'ait confirmé le jeton. */
  if (sessionEnVerification) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0284c7 100%)', color: '#fff', overflowY: 'auto', fontFamily: "'Segoe UI', sans-serif" }}>
        <div className="session-loader" aria-hidden="true" />
        <p role="status" style={{ margin: 0, fontSize: '14px', letterSpacing: '0.4px' }}>
          Vérification de votre session…
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="login-shell"
        style={{ background: `linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0284c7 100%)` }}
      >
        {isResetPassword ? (
          <div className="login-card" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', textAlign: 'center' }}>
            <h1 style={{ fontSize: '18px', color: '#0f172a', margin: '4px 0 6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Icone nom="verrou" taille={18} /> Réinitialisation du mot de passe</h1>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Saisissez votre adresse email : un lien de réinitialisation vous sera envoyé.
            </p>

            {resetEnvoye ? (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#166534', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Icone nom="succes" taille={15} /> Demande prise en compte</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#166534' }}>Si ce compte existe, consultez votre boîte de réception et le dossier spam.</p>
              </div>
            ) : (
              <form onSubmit={async e => {
                e.preventDefault();
                setResetEnCours(true);
                setAuthError('');
                try {
                  /* Le compte peut être réinitialisé même si le slug n'est pas
                     connu à l'écran de connexion : l'API envoie alors des liens
                     pour chaque entreprise qui possède cette adresse. */
                  await demanderReinitialisationMotDePasseApi(resetEmail.trim(), resetSlug.trim());
                  setResetEnvoye(true);
                } catch (err) {
                  console.error('[SKYS] Échec de la demande de réinitialisation :', {
                    status: err?.response?.status || null,
                    code: err?.code || null,
                    message: err?.response?.data?.error || err?.message || 'Erreur inconnue'
                  });
                  setAuthError(messageErreur(err));
                } finally {
                  setResetEnCours(false);
                }
              }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Entreprise (sous-domaine, ex. maquincaillerie)"
                  value={resetSlug}
                  onChange={e => setResetSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <input type="email" placeholder="Adresse email du compte" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                {authError && <p role="alert" style={{ color: '#dc2626', fontSize: '12px' }}>{authError}</p>}
                <button type="submit" disabled={resetEnCours} style={{ padding: '12px', fontSize: '14px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{resetEnCours ? 'Envoi en cours…' : 'Envoyer'}</button>
              </form>
            )}

            <button type="button" onClick={() => { setIsResetPassword(false); setResetEnvoye(false); setResetEnCours(false); setAuthError(''); }} style={{ marginTop: '14px', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Retour à la connexion</button>
          </div>
        ) : (
        <div className="login-card" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', textAlign: 'center' }}>
          {/* En-tête de marque : badge SVG (aucune image externe, donc jamais
              de logo manquant) + nom du produit + parenthèse de contexte. */}
          <div className="login-brand">
            <div className="login-brand-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l1.5-5h15L21 9" />
                <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
                <path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
                <path d="M9 20v-5h6v5" />
              </svg>
            </div>
            <div className="login-brand-texte">
              <span className="login-brand-nom">SKYS ERP</span>
              <span className="login-brand-slogan">Solution de gestion</span>
            </div>
          </div>
          <h1 className="login-title" style={{ color: '#0f172a', margin: '16px 0 4px', fontWeight: 'bold' }}>{isRegistering ? t.registerTitle : t.loginTitle}</h1>
          {/* Sous-titre affiché uniquement à l'inscription : plus de phrase
              d'invite superflue sur l'écran de connexion. */}
          {isRegistering && (
            <p className="login-sub" style={{ color: '#64748b', marginBottom: '18px' }}>{t.registerSub}</p>
          )}
          {raisonVerrouillage && (
            <p style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12px', padding: '9px 11px', borderRadius: '6px', margin: '0 0 12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Icone nom="verrou" taille={14} /> {raisonVerrouillage}
            </p>
          )}

          <form className="login-form" onSubmit={handleAuthSubmit} autoComplete="on" style={{ display: 'flex', flexDirection: 'column' }}>
            {isRegistering && (
              <div className="login-field">
                <label htmlFor="login-nom" className="login-label">Nom complet / Raison sociale</label>
                <input id="login-nom" type="text" placeholder={t.nomPlaceholder} value={authNom} onChange={e => setAuthNom(e.target.value)} style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
              </div>
            )}
            {isRegistering && (
              <div className="login-field">
                <label htmlFor="login-sous-domaine" className="login-label">Sous-domaine</label>
                <input
                  id="login-sous-domaine"
                  type="text"
                  placeholder="ex. maquincaillerie"
                  value={sousDomaine}
                  onChange={e => setSousDomaine(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  required
                />
                {sousDomaine && (
                  <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#0284c7', textAlign: 'left' }}>Accès : {sousDomaine}.skyserp.com</span>
                )}
              </div>
            )}
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">Adresse Email ou Login</label>
              {/* Connexion : identifiant libre (email ou login) → type="text" pour
                  ne pas bloquer la soumission sur un login sans « @ ».
                  Inscription : un vrai email est requis → type="email". */}
              <input
                id="login-email"
                type={isRegistering ? 'email' : 'text'}
                name="username"
                autoComplete="username"
                data-lpignore="true"
                placeholder={t.emailPlaceholder}
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                required
              />
            </div>
            <div className="login-field">
              {!isRegistering && (
                <button type="button" onClick={() => { setIsResetPassword(true); setResetEnvoye(false); setAuthError(''); }} className="login-forgot">Mot de passe oublié ?</button>
              )}
              <label htmlFor="login-password" className="login-label">Mot de passe</label>
              <input id="login-password" type={showPassword ? 'text' : 'password'} name="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} data-lpignore="true" placeholder={t.passPlaceholder} value={authPassword} onChange={e => setAuthPassword(e.target.value)} minLength={isRegistering ? 12 : undefined} maxLength={256} style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
            </div>
            {isRegistering && (
              <div className="login-field">
                <label htmlFor="login-confirm-password" className="login-label">Confirmer le mot de passe</label>
                <input id="login-confirm-password" type={showPassword ? 'text' : 'password'} placeholder="Confirmer le mot de passe" value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} minLength={12} maxLength={256} style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#475569', padding: '2px 0' }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} /> {showPassword ? t.hidePass : t.showPass}
              </label>
            </div>

            {authError && <p role="alert" style={{ color: '#ef4444', fontSize: '12px', margin: '0' }}>{authError}</p>}

            {isRegistering && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: '#475569', cursor: 'pointer', textAlign: 'left' }}>
                <input type="checkbox" checked={accepteConditions} onChange={e => setAccepteConditions(e.target.checked)} style={{ marginTop: '2px' }} required />
                <span>
                  {TEXTES_INSCRIPTION.conditionsUtilisation}
                  <br />
                  <span style={{ color: '#64748b' }}>{TEXTES_INSCRIPTION.traitementDonnees}</span>
                </span>
              </label>
            )}

            <button className="login-btn" type="submit" disabled={isRegistering && !accepteConditions} style={{ backgroundColor: (isRegistering && !accepteConditions) ? '#94a3b8' : '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (isRegistering && !accepteConditions) ? 'not-allowed' : 'pointer' }}>{isRegistering ? t.registerBtn : t.enter}</button>
          </form>

          <div className="login-block">
            <div className="login-divider"><span>Ou continuer avec</span></div>
            <div className="login-social-grid">
              {[
                { nom: 'Google' },
                { nom: 'Facebook' },
                { nom: 'WhatsApp' },
                { nom: 'LinkedIn' }
              ].map(provider => {
                const IconeMarque = MARQUES[provider.nom];
                return (
                <button
                  key={provider.nom}
                  className="login-social"
                  type="button"
                  onClick={() => alert(`La connexion ${provider.nom} doit être configurée.`)}
                >
                  {IconeMarque ? <IconeMarque taille={16} /> : null} {provider.nom}
                </button>
                );
              })}
            </div>
          </div>

          <div className="login-switch">
            <span>{isRegistering ? 'Déjà un compte ?' : "Vous n'avez pas de compte ?"}</span>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="login-switch-btn">{isRegistering ? 'Se connecter' : 'Créer un compte'}</button>
          </div>
        </div>
        )}
      </div>
    );
  }

  /* Module « Paramètres généraux » : Administration et Géographie y sont
     réunis en sous-onglets. */
  const idsParametresGeneraux = ['parametresGeneraux'];

  const dropdownTabIds = [
    'dashboard',
    'quincaillerie',
    'multiDepots',
    'transaction',
    'recherche',
    'mouvements',
    'reappro',
    'achats',
    'depenses',
    'devis',
    'inventaire',
    'transport',
    'clients',
    'credits',
    'dossiers',
    'paiements',
    'abonnements',
    'comptabilite',
    'reports',
    'securite',
    'tresorerie',
    'parametresGeneraux',
    'notes',
    'versions',
    'aide'
];

const dropdownLabels = {
  quincaillerie: 'Catégorie',
  mouvements: 'Mouvements',
  inventaire: 'Inventaire',
  reappro: 'Alertes',
  reports: 'Rapports',
  parametresGeneraux: 'Paramètres Généraux',
};

const getAllTabs = () => {
  let tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: 'tableauDeBord', roles: ['Administrateur'] },
    { id: 'quincaillerie', label: t.stock, icon: 'stock', roles: ['Administrateur', 'Magasinier'] },
    { id: 'multiDepots', label: 'Stock Multi-dépôts', icon: 'multiDepots', roles: ['Administrateur', 'Magasinier'] },
    { id: 'transaction', label: t.transaction, icon: 'caisse', roles: ['Administrateur', 'Caissier'] },
    { id: 'gaz', label: 'Vente de Gaz', icon: 'gaz', roles: ['Administrateur', 'Caissier'] },
    { id: 'recherche', label: t.recherche, icon: 'recherche', roles: ['Administrateur', 'Caissier', 'Magasinier'] },
    { id: 'mouvements', label: t.mouvements, icon: 'mouvements', roles: ['Administrateur', 'Magasinier'] },
    { id: 'reappro', label: t.reappro, icon: 'reappro', roles: ['Administrateur', 'Magasinier'] },
    { id: 'achats', label: 'Achats & Fournisseurs', icon: 'achats', roles: ['Administrateur', 'Magasinier'] },
    { id: 'depenses', label: t.depenses, icon: 'depenses', roles: ['Administrateur'] },
    { id: 'devis', label: t.devis, icon: 'devis', roles: ['Administrateur', 'Caissier'] },
    { id: 'inventaire', label: t.inventaire, icon: 'inventaire', roles: ['Administrateur', 'Magasinier'] },
    { id: 'transport', label: t.transport, icon: 'transport', roles: ['Administrateur'] },
    { id: 'clients', label: t.clients, icon: 'clients', roles: ['Administrateur', 'Caissier'] },
    { id: 'credits', label: 'Crédits & Dettes', icon: 'credits', roles: ['Administrateur', 'Caissier'] },
    { id: 'dossiers', label: t.dossiers, icon: 'dossiers', roles: ['Administrateur'] },
    { id: 'paiements', label: t.paiements, icon: 'paiements', roles: ['Administrateur', 'Caissier'] },
    { id: 'abonnements', label: 'Abonnements', icon: 'abonnements', roles: ['Administrateur'] },
    { id: 'comptabilite', label: 'Comptabilité automatique', icon: 'comptabilite', roles: ['Administrateur'] },
    { id: 'reports', label: t.reports, icon: 'rapports', roles: ['Administrateur'] },
    { id: 'securite', label: 'Sécurité & Incidents', icon: 'securite', roles: ['Administrateur'] },
    { id: 'tresorerie', label: 'Trésorerie & Épargne', icon: 'tresorerie', roles: ['Administrateur'] },
    { id: 'parametresGeneraux', label: 'Paramètres Généraux', icon: 'parametres', roles: ['Administrateur'] },
    { id: 'notes', label: t.notes, icon: 'notes', roles: ['Administrateur', 'Caissier', 'Magasinier'] },
    { id: 'versions', label: t.versions, icon: 'versions', roles: ['Administrateur', 'Caissier', 'Magasinier'] },
    { id: 'aide', label: t.aide, icon: 'aide', roles: ['Administrateur', 'Caissier', 'Magasinier'] }
  ];
  return tabs.filter(tb => tb.roles.includes(currentUserRole))
    .filter(tab => !estModuleAvanceBloque(tab.id));
};

return (
  <div className="app-shell" style={{ backgroundColor: bgColor, fontFamily: "var(--app-font-family, 'Segoe UI', sans-serif)" }}>
    {/* Voile sombre derrière le tiroir sur mobile : un clic referme le menu. */}
    {menuMobileOuvert && (
      <div
        className="app-sidebar-overlay"
        onClick={() => setMenuMobileOuvert(false)}
        aria-hidden="true"
      />
    )}
    <aside
      className={`sidebar app-sidebar${menuMobileOuvert ? ' app-sidebar-ouverte' : ''}`}
      style={{
        backgroundColor: '#0f172a',
        color: 'white',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: '"Poppins", "Segoe UI", sans-serif',
        fontSize: '15px',
        letterSpacing: '0.5px',
        lineHeight: '1.5'
      }}
    >
      {/* Bouton de fermeture du tiroir : visible uniquement sur mobile. */}
      <button
        type="button"
        className="app-sidebar-close"
        onClick={() => setMenuMobileOuvert(false)}
        aria-label="Fermer le menu de navigation"
      >
        <Icone nom="fermer" taille={16} />
      </button>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: '#0f172a',
          paddingBottom: '10px'
        }}
      >
        <SkysLogo centered sombre largeur={112} legende={t.brandTagline} />
      </div>

        <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '6px', marginBottom: '12px', textAlign: 'center' }}>
          <span style={{ display: 'block', color: '#94a3b8', fontSize: '11px' }}>
            {isSubscribed
              ? `Abonnement : ${libellePalier(subscriptionLevel)} · Actif`
              : `Essai gratuit : ${joursRestants} jour${joursRestants > 1 ? 's' : ''} restant${joursRestants > 1 ? 's' : ''}`}
          </span>
        </div>

        <div style={{ position: 'sticky', top: 0, zIndex: 15, marginBottom: '15px', padding: '10px 10px 12px', backgroundColor: '#0f172a' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px' }}>
          <label
            htmlFor="categorie-principale"
            style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}
          >
            <Icone nom="archive" taille={14} /> Catégories principales
          </label>

          <select
            id="categorie-principale"
            value={dropdownTabIds.includes(activeTab) ? activeTab : ''}
            onChange={e => ouvrirModule(e.target.value)}
            style={{ width: '100%', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
          >
            <option value="">-- Sélectionner une catégorie --</option>
            {getAllTabs()
              .filter(tab => dropdownTabIds.includes(tab.id) && !idsParametresGeneraux.includes(tab.id))
              .map(tab => (
                <option key={tab.id} value={tab.id}>
                  {dropdownLabels[tab.id] || tab.label}
                </option>
              ))}
            {(() => {
              const ongletsParametres = getAllTabs().filter(tab => idsParametresGeneraux.includes(tab.id));
              if (!ongletsParametres.length) return null;
              return (
                <optgroup label="Paramètres généraux">
                  {ongletsParametres.map(tab => (
                    <option key={tab.id} value={tab.id}>
                      {dropdownLabels[tab.id] || tab.label}
                    </option>
                  ))}
                </optgroup>
              );
            })()}
          </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpenSubMenus(current => ({ ...current, modules: !(current.modules ?? true) }))}
          aria-expanded={openSubMenus.modules ?? true}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', marginBottom: '6px', backgroundColor: '#1e293b', color: '#38bdf8', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Icone nom="liste" taille={14} /> Modules disponibles</span>
          <span>{(openSubMenus.modules ?? true) ? <Icone nom="bas" taille={14} /> : <Icone nom="suivant" taille={14} />}</span>
        </button>

        {(openSubMenus.modules ?? true) && <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
          {getAllTabs()
            .filter(tab => !idsParametresGeneraux.includes(tab.id))
            .map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => ouvrirModule(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  backgroundColor: activeTab === tab.id ? '#0284c7' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: activeTab === tab.id ? 'bold' : 'normal'
                }}
              >
                <Icone nom={tab.icon} taille={16} /> {tab.label}
              </button>
            ))}

          {/* Regroupement « Paramètres généraux » : Géographie + Administration. */}
          {(() => {
            const ongletsParametres = getAllTabs().filter(tab => idsParametresGeneraux.includes(tab.id));
            if (!ongletsParametres.length) return null;
            return (
              <div style={{ marginTop: '8px', borderTop: '1px solid #334155', paddingTop: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 4px 6px', color: '#38bdf8', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Icone nom="parametres" taille={13} /> Paramètres généraux
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {ongletsParametres.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => ouvrirModule(tab.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        backgroundColor: activeTab === tab.id ? '#0284c7' : 'transparent',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: activeTab === tab.id ? 'bold' : 'normal'
                      }}
                    >
                      <Icone nom={tab.icon} taille={16} /> {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>}

        <button
          type="button"
          onClick={logout}
          style={{
            marginTop: '15px',
            padding: '10px 12px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Déconnexion
        </button>
      </aside>

   <main
    className="app-main"
    ref={conteneurPrincipalRef}
    style={{ backgroundColor: bgColor }}
  >
    <div className="app-header" style={{ backgroundColor: bgColor }}>
      <button
        type="button"
        className="app-menu-toggle"
        onClick={() => setMenuMobileOuvert(open => !open)}
        aria-label="Ouvrir le menu de navigation"
        aria-expanded={menuMobileOuvert}
        title="Menu de navigation"
      >
        <Icone nom="menu" taille={16} />
      </button>
      <img
        src={logoImage}
        alt="SKYS ERP Solution"
        className="app-header-logo"
        style={{ height: '30px', width: 'auto', display: 'block', flex: '0 0 auto' }}
      />
      <span className="app-header-title">
        {t.title} · {(() => { const current = getAllTabs().find(tab => tab.id === activeTab); return current ? current.label : 'Module'; })()}
        {estModuleAvanceBloque(activeTab) && <Icone nom="verrou" taille={13} style={{ marginLeft: '5px' }} />}
      </span>
      <div className="app-header-right">
        <MontrePro compact />
        <button
          className="app-bell"
          type="button"
          onClick={() => setShowNotifications(open => !open)}
          aria-label="Afficher les notifications"
          aria-expanded={showNotifications}
          title="Notifications"
        >
          <Icone nom="reappro" taille={18} />
          {stockBasNonLues > 0 && (
            <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', padding: '0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#dc2626', color: '#fff', fontSize: '10px', fontWeight: 'bold', borderRadius: '999px' }}>
              {stockBasNonLues}
            </span>
          )}
        </button>
      </div>

          {showNotifications && (
            <div className="notif-panel">
              <button
                type="button"
                aria-label="Fermer les notifications"
                onClick={() => setShowNotifications(false)}
                style={{ position: 'absolute', top: '8px', right: '8px', border: 'none', background: 'transparent', color: '#64748b', fontSize: '15px', lineHeight: 1, cursor: 'pointer', padding: '2px 5px', display: 'flex' }}
              >
                <Icone nom="fermer" taille={15} />
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><Icone nom="reappro" taille={14} /> Notifications</strong>
                {stockBasNonLues > 0 && (
                  <button
                    type="button"
                    onClick={marquerAlertesVues}
                    style={{ border: 'none', background: 'none', color: '#0284c7', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                  >
                    Tout marquer comme vu
                  </button>
                )}
              </div>

              {!notificationsEnabled && (
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0' }}>Les notifications sont désactivées.</p>
              )}

              {notificationsEnabled && stockBasNotifications.length === 0 && (
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>Aucun article en stock bas. <Icone nom="succes" taille={14} couleur="#16a34a" /></p>
              )}

              {notificationsEnabled && stockBasNotifications.map(alerte => (
                <div
                  key={alerte.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px',
                    marginTop: '8px', padding: '8px 10px',
                    backgroundColor: alerte.niveau === 'critique' ? '#fef2f2' : '#fffbeb',
                    border: '1px solid ' + (alerte.niveau === 'critique' ? '#fecaca' : '#fde68a'),
                    borderRadius: '6px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>{alerte.titre}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>{alerte.message}</p>
                    {alerte.fournisseur && (
                      <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>Fournisseur : {alerte.fournisseur}</p>
                    )}
                  </div>
                  <span style={{
                    flex: 'none', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '999px',
                    backgroundColor: alerte.niveau === 'critique' ? '#fee2e2' : '#fef3c7',
                    color: alerte.niveau === 'critique' ? '#991b1b' : '#92400e'
                  }}>
                    {alerte.niveau === 'critique' ? 'CRITIQUE' : 'BAS'}
                  </span>
                </div>
              ))}

              {currentUserRole === 'Administrateur' && securityEvents[0] && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                  <strong style={{ color: '#dc2626', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Icone nom="alerteSecurite" taille={14} /> Alerte sécurité</strong>
                  <p style={{ fontSize: '12px', color: '#475569', margin: '5px 0' }}>{securityEvents[0].detail}</p>
                  {securityEvents[0].preuveImage && (
                    <img src={securityEvents[0].preuveImage} alt="Preuve de sécurité" style={{ width: '100%', maxHeight: '130px', objectFit: 'cover', borderRadius: '6px' }} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <div className="dashboard-view">
            <div style={{ marginBottom: '14px' }}>
              <h2 className="dashboard-title" style={{ display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="tableauDeBord" taille={22} /> Tableau de Bord & Indicateurs Graphiques</h2>
            </div>

            {/* Bandeau « vérifiez votre e-mail » : invitation à confirmer
                l'adresse (protection contre les adresses jetables). */}
            {!emailVerifie && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                <Icone nom="email" taille={18} couleur="#1d4ed8" />
                <span style={{ flex: 1, minWidth: '200px', fontSize: '13px', fontWeight: 600, color: '#1e40af' }}>
                  {messageVerification || 'Confirmez votre adresse e-mail pour sécuriser votre compte.'}
                </span>
                <button
                  type="button"
                  disabled={verificationEnCours}
                  onClick={async () => {
                    setVerificationEnCours(true);
                    try {
                      const r = await renvoyerVerificationEmailApi(utilisateurCourant?.email || authEmail);
                      setMessageVerification(r?.message || 'E-mail de vérification renvoyé.');
                    } catch {
                      setMessageVerification('Envoi impossible pour le moment. Réessayez plus tard.');
                    } finally {
                      setVerificationEnCours(false);
                    }
                  }}
                  style={{ backgroundColor: '#1d4ed8', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: verificationEnCours ? 'wait' : 'pointer' }}
                >
                  {verificationEnCours ? 'Envoi…' : 'Renvoyer l’e-mail'}
                </button>
              </div>
            )}

            {/* Relance AVANT expiration : incite le client à activer son
                abonnement avant que l'accès ne soit coupé. */}
            {relance.afficher && !relanceMasquee && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', backgroundColor: relance.jours <= 0 ? '#fef2f2' : '#fffbeb', border: `1px solid ${relance.jours <= 0 ? '#fecaca' : '#fde68a'}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                <Icone nom="avertissement" taille={18} couleur={relance.jours <= 0 ? '#dc2626' : '#b45309'} />
                <span style={{ flex: 1, minWidth: '200px', fontSize: '13px', fontWeight: 600, color: relance.jours <= 0 ? '#991b1b' : '#92400e' }}>
                  {relance.message}
                </span>
                <button
                  type="button"
                  onClick={() => { setSousOngletParametres('administration'); setActiveTab('abonnements'); }}
                  style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Activer mon abonnement
                </button>
                <button
                  type="button"
                  onClick={() => setRelanceMasquee(true)}
                  aria-label="Masquer la relance"
                  style={{ backgroundColor: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}
                >
                  <Icone nom="fermer" taille={14} />
                </button>
              </div>
            )}
            {publicite.actif && (
              <div className="ad-banner" style={{ background: `linear-gradient(100deg, ${publicite.couleur} 0%, #1e3a8a 45%, #312e81 75%, #0f172a 100%)` }}>
                <div className="ad-viewport">
                  <span className="ad-track">
                    <span style={{ marginRight: '10px', display: 'inline-flex', verticalAlign: 'middle' }}><Icone nom="etoile" taille={14} /></span>
                    <strong style={{ letterSpacing: '0.4px' }}>{publicite.titre}</strong>
                    <span style={{ margin: '0 14px', opacity: 0.6 }}>•</span>
                    <span style={{ fontWeight: '500' }}>{publicite.message}</span>
                    {publicite.lien && (
                      <span style={{ marginLeft: '18px', textDecoration: 'underline', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="suivant" taille={14} /> {publicite.lien}</span>
                    )}
                    <span style={{ margin: '0 14px', opacity: 0.6 }}>•</span>
                    <span style={{ fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="inventaire" taille={14} /> Stock</span>
                      <span>·</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="caisse" taille={14} /> Caisse</span>
                      <span>·</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="transport" taille={14} /> Livraison</span>
                      <span>·</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="rapports" taille={14} /> KPI</span>
                    </span>
                  </span>
                </div>
              </div>
            )}
            <div className="dashboard-welcome">
              <div>
                <h3>Bonjour, {storeInfo.nomMagasin}</h3>
                <p>Voici l’état actuel de votre activité et les actions prioritaires.</p>
              </div>
              <div className="dashboard-alert-badge">{products.filter(product => Number(product.quantiteStock) <= Number(product.minStock)).length} alerte(s) stock</div>
            </div>
            <div className="dashboard-actions">
              <button type="button" onClick={() => setActiveTab('transaction')}>＋ Nouvelle vente</button>
              <button type="button" onClick={() => setActiveTab('quincaillerie')}>＋ Nouvel article</button>
              <button type="button" onClick={() => setActiveTab('reappro')}>Voir le réapprovisionnement</button>
            </div>
            <div className="dashboard-charts">
              <div className="dashboard-panel">
                <h3 className="dashboard-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="rapports" taille={16} /> Articles par famille</h3>
                <label htmlFor="famille-dashboard" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Choisir une famille
                </label>
                <select
                  id="famille-dashboard"
                  value={familleDashboard}
                  onChange={e => setFamilleDashboard(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
                >
                  {famillesDashboard.map(fam => {
                    const count = products.filter(p => normaliserFamille(p.famille) === normaliserFamille(fam)).length;
                    return <option key={fam} value={fam}>{fam} — {count} article(s)</option>;
                  })}
                </select>
                {(() => {
                  const count = products.filter(p => normaliserFamille(p.famille) === normaliserFamille(familleDashboard)).length;
                  const pct = products.length ? (count / products.length) * 100 : 0;
                  // Une couleur distincte et stable par famille (index dans la liste).
                  const PALETTE_FAMILLES = ['#0284c7', '#16a34a', '#eab308', '#f97316', '#8b5cf6', '#0891b2', '#db2777', '#65a30d', '#dc2626', '#0d9488', '#7c3aed', '#ca8a04'];
                  const rang = Math.max(0, famillesDashboard.indexOf(familleDashboard));
                  const couleurFamille = PALETTE_FAMILLES[rang % PALETTE_FAMILLES.length];
                  return (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px', gap: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: couleurFamille, flexShrink: 0 }}></span>
                          <span style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{familleDashboard}</span>
                        </span>
                        <span style={{ fontWeight: 'bold', color: couleurFamille, whiteSpace: 'nowrap', marginLeft: '8px' }}>{count} article(s) · {pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ width: '100%', backgroundColor: '#eef2f7', borderRadius: '5px', height: '10px', overflow: 'hidden' }}>
                        <div style={{ width: pct > 0 ? `${Math.max(pct, 1)}%` : '0%', backgroundColor: couleurFamille, height: '100%', borderRadius: '5px', transition: 'width 0.3s ease' }}></div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="dashboard-panel dashboard-finance">
                <h3 className="dashboard-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="graphiqueCirculaire" taille={16} /> Diagramme Circulaire - Santé Financière</h3>
                <div className="dashboard-donut" style={{ background: 'conic-gradient(#16a34a 0% 65%, #0284c7 65% 85%, #ef4444 85% 100%)' }}></div>
                <div className="dashboard-legend">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', backgroundColor: '#16a34a', display: 'inline-block', borderRadius: '50%' }}></span> Bénéfices (65%)</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', backgroundColor: '#0284c7', display: 'inline-block', borderRadius: '50%' }}></span> Investissements (20%)</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', backgroundColor: '#ef4444', display: 'inline-block', borderRadius: '50%' }}></span> Charges (15%)</span>
                </div>
              </div>
            </div>

            {/* Histogramme en bâtonnets : nombre d'articles par famille. */}
            <div className="dashboard-panel" style={{ marginTop: '16px' }}>
              <h3 className="dashboard-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="tendanceHausse" taille={16} /> Nombre d’articles par famille</h3>
              {products.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '13px', margin: '10px 0' }}>Aucun article enregistré pour le moment.</p>
              ) : (() => {
                const donnees = famillesDashboard
                  .map(fam => ({ fam, count: products.filter(p => normaliserFamille(p.famille) === normaliserFamille(fam)).length }))
                  .filter(entree => entree.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 8);
                if (!donnees.length) return <p style={{ color: '#64748b', fontSize: '13px', margin: '10px 0' }}>Aucune famille renseignée sur vos articles.</p>;
                const maximum = Math.max(...donnees.map(d => d.count));
                // Échelle arrondie vers le haut pour des graduations lisibles.
                const echelleMax = Math.max(4, Math.ceil(maximum / 4) * 4);
                const graduations = [echelleMax, Math.round(echelleMax * 0.75), Math.round(echelleMax * 0.5), Math.round(echelleMax * 0.25), 0];
                const hauteurZone = 170;
                const couleurs = ['#0284c7', '#16a34a', '#eab308', '#f97316', '#8b5cf6', '#0891b2', '#db2777', '#65a30d'];
                return (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', maxWidth: '620px', margin: '0 auto' }}>
                      {/* Axe vertical : graduations */}
                      <div style={{ width: '34px', height: `${hauteurZone}px`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: '6px', fontSize: '10px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                        {graduations.map(g => <span key={g}>{g}</span>)}
                      </div>
                      {/* Zone de tracé avec grille */}
                      <div style={{ position: 'relative', flex: 1, height: `${hauteurZone}px`, borderLeft: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                        {graduations.map((g, i) => (
                          <div key={g} style={{ position: 'absolute', left: 0, right: 0, top: `${(i / (graduations.length - 1)) * 100}%`, borderTop: i === graduations.length - 1 ? 'none' : '1px dashed #e2e8f0' }}></div>
                        ))}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '12px', padding: '0 12px' }}>
                          {donnees.map((entree, idx) => {
                            const hauteur = maximum ? Math.max((entree.count / echelleMax) * hauteurZone, 4) : 4;
                            const couleur = couleurs[idx % couleurs.length];
                            return (
                              <div key={entree.fam} style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={`${entree.fam} : ${entree.count} article(s)`}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', marginBottom: '3px', fontVariantNumeric: 'tabular-nums' }}>{entree.count}</span>
                                <div style={{ width: '26px', maxWidth: '70%', height: `${hauteur}px`, background: `linear-gradient(180deg, ${couleur} 0%, ${couleur}d9 100%)`, borderRadius: '4px 4px 0 0', boxShadow: '0 1px 3px rgba(15,23,42,0.18)', transition: 'height 0.3s ease' }}></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {/* Légende numérotée sous le graphique */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px 14px', maxWidth: '620px', margin: '12px auto 0' }}>
                      {donnees.map((entree, idx) => (
                        <span key={entree.fam} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: couleurs[idx % couleurs.length], flexShrink: 0 }}></span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entree.fam}>{entree.fam}</span>
                          <strong style={{ marginLeft: 'auto', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{entree.count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'quincaillerie' && (
          <Stock
            t={t}
            bgColor={bgColor}
            products={products}
            FAMILLES_PRODUITS={FAMILLES_PRODUITS}
            fournisseursServeur={fournisseursServeur}
            selectedFamille={selectedFamille}
            setSelectedFamille={setSelectedFamille}
            sousCategories={sousCategories}
            categorieForm={categorieForm}
            setCategorieForm={setCategorieForm}
            sousCategorieForm={sousCategorieForm}
            setSousCategorieForm={setSousCategorieForm}
            categoriesReference={categoriesReference}
            ajouterCategorie={ajouterCategorie}
            supprimerCategorie={supprimerCategorie}
            ajouterSousCategorie={ajouterSousCategorie}
            supprimerSousCategorie={supprimerSousCategorie}
            totalValeurStock={totalValeurStock}
            prodForm={prodForm}
            setProdForm={setProdForm}
            editingProdId={editingProdId}
            handleProductSubmit={handleProductSubmit}
            resetProdForm={resetProdForm}
            handleEditProd={handleEditProd}
            handleDeleteProduct={handleDeleteProduct}
          />
        )}

        {activeTab === 'multiDepots' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="multiDepots" taille={22} /> Stock Multi-dépôts</h2>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Dépôt à consulter :</label>
              <select
                value={depotActif}
                onChange={e => setDepotActif(e.target.value)}
                title="Dépôt consulté — cliquez pour changer de dépôt actif"
                style={{ width: '100%', maxWidth: '360px', padding: '9px', borderRadius: '6px', border: '1px solid #0284c7', backgroundColor: '#f0f9ff', color: '#075985', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {DEPOTS_LISTE.map(depot => <option key={depot} value={depot}>{depot}</option>)}
              </select>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}><Icone nom="position" taille={13} /> Dépôt consulté : cliquez sur ce champ pour changer de dépôt actif.</p>
            </div>

            <form onSubmit={handleTransferSubmit} style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '10px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', alignItems: 'start' }}>
              <input
                type="text"
                list="liste-articles-transfert"
                placeholder="Article à transférer"
                value={transferForm.ref}
                onChange={e => choisirArticleTransfert(e.target.value)}
                required
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <datalist id="liste-articles-transfert">
                {products.map(product => <option key={product._id} value={product.ref}>{product.nom}</option>)}
              </datalist>
              <input
                type="text"
                list="liste-depots-source"
                placeholder="Depuis dépôt"
                value={transferForm.source}
                onChange={e => { const source = e.target.value; setTransferForm(form => ({ ...form, source, quantite: form.ref ? (quantiteDisponibleTransfert(form.ref, source) > 0 ? String(quantiteDisponibleTransfert(form.ref, source)) : '') : form.quantite })); }}
                required
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <datalist id="liste-depots-source">
                {DEPOTS_LISTE.map(depot => <option key={depot} value={depot} />)}
              </datalist>
              <input
                type="text"
                list="liste-depots-destination"
                placeholder="Vers un autre dépôt"
                value={transferForm.destination}
                onChange={e => setTransferForm({ ...transferForm, destination: e.target.value })}
                required
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <datalist id="liste-depots-destination">
                {DEPOTS_LISTE.map(depot => <option key={depot} value={depot} />)}
              </datalist>
              <input type="number" min="1" max={quantiteDisponibleTransfert(transferForm.ref, transferForm.source) || undefined} step="1" aria-label="Quantité de stock à transférer" placeholder="Quantité à transférer" value={transferForm.quantite} onChange={e => setTransferForm({ ...transferForm, quantite: e.target.value })} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <span style={{ justifySelf: 'start', alignSelf: 'center', padding: '6px 12px', borderRadius: '999px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '12px', color: '#075985', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <Icone nom="inventaire" taille={14} /> {transferForm.ref ? `${quantiteDisponibleTransfert(transferForm.ref, transferForm.source)} unité(s) dans ${transferForm.source}` : 'Sélectionnez un article'}
              </span>
              <button type="submit" style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Transférer</button>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {DEPOTS_LISTE.map(depot => {
                const totalDepot = products.reduce((total, produit) => total + Number(stockParDepot[produit.ref]?.[depot] || 0), 0);
                return (
                  <div key={depot} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <strong>{depot}</strong>
                    <p style={{ margin: '5px 0 0', color: '#0284c7', fontSize: '20px', fontWeight: 'bold' }}>{totalDepot} unités</p>
                  </div>
                );
              })}
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'default', userSelect: 'none' }}>
              <p style={{ margin: '10px 12px 0', fontSize: '11px', color: '#64748b' }}>
                <Icone nom="liste" taille={13} /> Tableau de consultation des stocks par dépôt (lecture seule).
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '10px' }}>Réf.</th>
                    <th style={{ padding: '10px' }}>Article</th>
                    {DEPOTS_LISTE.map(depot => <th key={depot} style={{ padding: '10px' }}>{depot}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {products.map(produit => (
                    <tr key={produit._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{produit.ref}</td>
                      <td style={{ padding: '10px' }}>{produit.nom}</td>
                      {DEPOTS_LISTE.map(depot => (
                        <td key={depot} style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>
                          {Number(stockParDepot[produit.ref]?.[depot] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>Historique des transferts</h3>
              {transferts.length === 0 ? <p style={{ color: '#64748b' }}>Aucun transfert enregistré.</p> : transferts.map(transfert => <p key={transfert.id} style={{ margin: '8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>{formatDate(transfert.date)} - <strong>{transfert.article}</strong> : {transfert.quantite} unité(s), {transfert.source} → {transfert.destination}</p>)}
            </div>
          </div>
        )}

        {activeTab === 'transaction' && (
          <Caisse
            t={t}
            headerConfig={headerConfig}
            recuConfig={recuConfig}
            storeInfo={storeInfo}
            selectedClientTx={selectedClientTx}
            selectedPaymentMethod={selectedPaymentMethod}
            setSelectedPaymentMethod={setSelectedPaymentMethod}
            MOYENS_PAIEMENT={MOYENS_PAIEMENT}
            panier={panier}
            totalPanier={totalPanier}
            handleBarcodeScan={handleBarcodeScan}
            scannerInputRef={scannerInputRef}
            barcodeInput={barcodeInput}
            barcodeInputRef={barcodeInputRef}
            setBarcodeInput={setBarcodeInput}
            traiterEntreeDouchette={traiterEntreeDouchette}
            setCameraOpen={setCameraOpen}
            cameraOpen={cameraOpen}
            cameraError={cameraError}
            setCameraError={setCameraError}
            traiterCodeScanne={traiterCodeScanne}
            scanResult={scanResult}
            preparerArticleDepuisCode={preparerArticleDepuisCode}
            products={products}
            selectedPosCatalogItem={selectedPosCatalogItem}
            setSelectedPosCatalogItem={setSelectedPosCatalogItem}
            ajouterAuPanier={ajouterAuPanier}
            reduireQuantitePanier={reduireQuantitePanier}
            retirerDuPanier={retirerDuPanier}
            validerTransaction={validerTransaction}
            lancerPaiementKkiapay={lancerPaiementKkiapay}
            imprimerRecuFacture={imprimerRecuFacture}
          />
        )}
        {/* ================= MODULE VENTE DE GAZ ================= */}
        {activeTab === 'gaz' && (
          <div>
            <h2 className="no-print" style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="gaz" taille={22} /> Vente de Gaz</h2>
            <p className="no-print" style={{ color: '#64748b', fontSize: '13px', marginTop: 0 }}>
              Vente de bouteilles, recharge, consigne et livraison. Un reçu professionnel est généré après chaque vente.
            </p>

            <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
              {/* Formulaire de vente */}
              <div style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <h3 style={{ marginTop: 0, color: '#0284c7', fontSize: '15px' }}>Nouvelle vente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label htmlFor="gaz-bouteille" style={{ fontSize: '12px', fontWeight: 'bold' }}>Bouteille / format</label>
                  <select id="gaz-bouteille" value={gazForm.bouteille} onChange={e => setGazForm({ ...gazForm, bouteille: e.target.value })} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    {BOUTEILLES_GAZ.map(b => <option key={b.code} value={b.code}>{b.libelle}</option>)}
                  </select>

                  <label htmlFor="gaz-prestation" style={{ fontSize: '12px', fontWeight: 'bold' }}>Prestation</label>
                  <select id="gaz-prestation" value={gazForm.prestation} onChange={e => setGazForm({ ...gazForm, prestation: e.target.value })} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    {PRESTATIONS_GAZ.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label htmlFor="gaz-qte" style={{ fontSize: '12px', fontWeight: 'bold' }}>Quantité</label>
                      <input id="gaz-qte" type="number" min="1" value={gazForm.quantite} onChange={e => setGazForm({ ...gazForm, quantite: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label htmlFor="gaz-prix" style={{ fontSize: '12px', fontWeight: 'bold' }}>Prix unitaire (FCFA)</label>
                      <input id="gaz-prix" type="number" min="0" value={gazForm.prixUnitaire} onChange={e => setGazForm({ ...gazForm, prixUnitaire: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={gazForm.consigne} onChange={e => setGazForm({ ...gazForm, consigne: e.target.checked, consigneMontant: e.target.checked ? (BOUTEILLES_GAZ.find(b => b.code === gazForm.bouteille)?.prixConsigne || 0) : 0 })} />
                    Consigne bouteille (caution)
                  </label>
                  {gazForm.consigne && (
                    <input type="number" min="0" value={gazForm.consigneMontant} onChange={e => setGazForm({ ...gazForm, consigneMontant: e.target.value })} placeholder="Montant de la consigne" style={{ padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  )}

                  <label htmlFor="gaz-client" style={{ fontSize: '12px', fontWeight: 'bold' }}>Client (facultatif)</label>
                  <input id="gaz-client" type="text" placeholder="Nom du client" value={gazForm.client} onChange={e => setGazForm({ ...gazForm, client: e.target.value })} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />

                  <label htmlFor="gaz-paiement" style={{ fontSize: '12px', fontWeight: 'bold' }}>Moyen de paiement</label>
                  <select id="gaz-paiement" value={gazForm.moyenPaiement} onChange={e => setGazForm({ ...gazForm, moyenPaiement: e.target.value })} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    {MOYENS_PAIEMENT.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label htmlFor="gaz-livreur" style={{ fontSize: '12px', fontWeight: 'bold' }}>Livreur</label>
                      <input id="gaz-livreur" type="text" placeholder="Nom du livreur" value={gazForm.livreur} onChange={e => setGazForm({ ...gazForm, livreur: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label htmlFor="gaz-dest" style={{ fontSize: '12px', fontWeight: 'bold' }}>Destination</label>
                      <input id="gaz-dest" type="text" placeholder="Lieu de livraison" value={gazForm.destination} onChange={e => setGazForm({ ...gazForm, destination: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>Sous-total</span><span>{prixGazTotal().sousTotal.toLocaleString()} FCFA</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>Consigne</span><span>{prixGazTotal().consigne.toLocaleString()} FCFA</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', borderTop: '1px solid #cbd5e1', marginTop: '6px', paddingTop: '6px' }}><span>TOTAL</span><span>{prixGazTotal().total.toLocaleString()} FCFA</span></div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={validerVenteGaz} style={{ flex: 1, backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Valider la vente</button>
                    <button type="button" onClick={() => { if (!gazRecu) { alert('Validez d’abord une vente de gaz pour générer le reçu.'); return; } imprimer(); }} style={{ backgroundColor: '#475569', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' }}><Icone nom="imprimer" taille={15} /> Reçu</button>
                  </div>
                </div>
              </div>

              {/* Historique des ventes de gaz */}
              <div style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <h3 style={{ marginTop: 0, color: '#0284c7', fontSize: '15px' }}>Ventes de gaz récentes ({gazVentes.length})</h3>
                {gazVentes.length === 0 ? <p style={{ color: '#64748b', fontSize: '13px' }}>Aucune vente de gaz enregistrée.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                        <th style={{ padding: '7px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '7px', textAlign: 'left' }}>Client</th>
                        <th style={{ padding: '7px', textAlign: 'left' }}>Article</th>
                        <th style={{ padding: '7px', textAlign: 'center' }}>Qté</th>
                        <th style={{ padding: '7px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gazVentes.slice(0, 15).map(v => (
                        <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '7px' }}>{v.date}</td>
                          <td style={{ padding: '7px', fontWeight: 'bold' }}>{v.client}</td>
                          <td style={{ padding: '7px' }}>{v.bouteille} — {v.prestation}</td>
                          <td style={{ padding: '7px', textAlign: 'center' }}>{v.quantite}</td>
                          <td style={{ padding: '7px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>{v.total.toLocaleString()} FCFA</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Reçu professionnel imprimable pour la dernière vente de gaz */}
            {gazRecu && (
              <div data-recu-client className="print-only" style={{ color: '#0f172a', marginTop: '20px' }}>
                <div style={{ borderBottom: `3px solid ${recuConfig.couleur || '#0f172a'}`, paddingBottom: '10px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '22px', color: recuConfig.couleur || '#0f172a' }}>{storeInfo.nomMagasin}</h1>
                    <p style={{ margin: '2px 0 0', fontSize: '11px' }}>{storeInfo.motto}</p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '11px' }}>
                    {recuConfig.afficherContact && <p style={{ margin: 0 }}>{storeInfo.adresse}</p>}
                    {recuConfig.afficherContact && <p style={{ margin: 0 }}>Tél : {storeInfo.telephone}</p>}
                    {recuConfig.afficherRccm && <p style={{ margin: 0 }}>RCCM : {storeInfo.rccm}</p>}
                  </div>
                </div>
                <h2 style={{ textAlign: 'center', fontSize: '15px', letterSpacing: '2px', margin: '0 0 10px', color: recuConfig.couleur || '#0f172a' }}>REÇU — VENTE DE GAZ</h2>
                <p style={{ fontSize: '11px', margin: '0 0 8px' }}>
                  Date : <strong>{gazRecu.date}</strong> · Client : <strong>{gazRecu.client}</strong> · Règlement : <strong>{gazRecu.moyenPaiement}</strong>
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: recuConfig.couleur || '#0f172a', color: '#fff' }}>
                      <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'left' }}>Article</th>
                      <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'center', width: '60px' }}>Qté</th>
                      <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'right', width: '100px' }}>Prix unit.</th>
                      <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'right', width: '110px' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{gazRecu.bouteille} — {gazRecu.prestation}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>{gazRecu.quantite}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right' }}>{Number(gazRecu.prixUnitaire).toLocaleString()} FCFA</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{(gazRecu.quantite * gazRecu.prixUnitaire).toLocaleString()} FCFA</td>
                    </tr>
                    {gazRecu.consigne > 0 && (
                      <tr>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Consigne bouteille (caution)</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>1</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right' }}>{Number(gazRecu.consigne).toLocaleString()} FCFA</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(gazRecu.consigne).toLocaleString()} FCFA</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: recuConfig.couleur || '#0f172a' }}>{gazRecu.total.toLocaleString()} FCFA</td>
                    </tr>
                  </tfoot>
                </table>
                {(gazRecu.livreur || gazRecu.destination) && (
                  <p style={{ fontSize: '11px', marginTop: '8px' }}>
                    {gazRecu.livreur ? `Livreur : ${gazRecu.livreur} · ` : ''}{gazRecu.destination ? `Destination : ${gazRecu.destination}` : ''}
                  </p>
                )}
                <div style={{ marginTop: '14px', fontSize: '11px', textAlign: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{recuConfig.piedDePage}</p>
                  {recuConfig.mentionLegale && <p style={{ margin: '4px 0 0', color: '#475569' }}>{recuConfig.mentionLegale}</p>}
                </div>
                {/* Mentions légales obligatoires — réglementation ivoirienne */}
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '9.5px', color: '#475569', textAlign: 'center', lineHeight: '1.5' }}>
                  {construireMentionsLegales(storeInfo).map((ligne, i) => (
                    <p key={i} style={{ margin: '2px 0' }}>{ligne}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recherche' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.recherche}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', padding: '8px 12px', borderRadius: '999px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', height: '36px' }}>
              <span aria-hidden="true" style={{ fontSize: '13px', color: '#64748b', display: 'flex' }}><Icone nom="recherche" taille={15} /></span>
              <input
                type="search"
                placeholder="Référence, désignation, fournisseur…"
                value={searchTermInput}
                onChange={e => setSearchTermInput(e.target.value)}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: '#0f172a' }}
              />
              {searchTermInput && (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => setSearchTermInput('')}
                  style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '2px 4px', display: 'flex' }}
                >
                  <Icone nom="fermer" taille={14} />
                </button>
              )}
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '12px' }}>Réf</th>
                    <th style={{ padding: '12px' }}>Désignation</th>
                    <th style={{ padding: '12px' }}>Famille</th>
                    <th style={{ padding: '12px' }}>Prix Vente</th>
                    <th style={{ padding: '12px' }}>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.filter(p => p.nom.toLowerCase().includes(searchTermInput.toLowerCase()) || p.ref.toLowerCase().includes(searchTermInput.toLowerCase()) || p.fournisseur.toLowerCase().includes(searchTermInput.toLowerCase())).map(p => (
                    <tr key={p._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.ref}</td>
                      <td style={{ padding: '12px' }}>{p.nom}</td>
                      <td style={{ padding: '12px' }}>{p.famille}</td>
                      <td style={{ padding: '12px' }}>{p.prix.toLocaleString()} FCFA</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#16a34a' }}>{p.quantiteStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'mouvements' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.mouvements}</h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button onClick={() => setMouvementSubTab('ENTREE')} style={{ padding: '8px 14px', backgroundColor: mouvementSubTab === 'ENTREE' ? '#0284c7' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Entrée de Stock</button>
              <button onClick={() => setMouvementSubTab('SORTIE')} style={{ padding: '8px 14px', backgroundColor: mouvementSubTab === 'SORTIE' ? '#0284c7' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Sortie de Stock</button>
              <button onClick={() => setMouvementSubTab('ACHAT')} style={{ padding: '8px 14px', backgroundColor: mouvementSubTab === 'ACHAT' ? '#16a34a' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' }}><Icone nom="commander" taille={15} /> Achats</button>
              <button onClick={() => setMouvementSubTab('RECEPTION')} style={{ padding: '8px 14px', backgroundColor: mouvementSubTab === 'RECEPTION' ? '#16a34a' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' }}><Icone nom="inventaire" taille={15} /> Réceptions</button>
              <button onClick={() => setMouvementSubTab('RESTE')} style={{ padding: '8px 14px', backgroundColor: mouvementSubTab === 'RESTE' ? '#f59e0b' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' }}><Icone nom="rapports" taille={15} /> Restes (Inventaire)</button>
            </div>

            {mouvementSubTab !== 'RESTE' ? (
              <form onSubmit={handleMouvementSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <input type="date" value={mouvForm.date} onChange={e => setMouvForm({ ...mouvForm, date: e.target.value })} style={{ padding: '8px' }} required />
                  <select value={mouvForm.refProd} onChange={e => setMouvForm({ ...mouvForm, refProd: e.target.value })} style={{ padding: '8px' }} required>
                    <option value="">-- Sélectionner Article --</option>
                    {products.map(p => <option key={p._id} value={p.ref}>{p.ref} - {p.nom}</option>)}
                  </select>
                  <input type="number" min="1" step="1" placeholder="Quantité" value={mouvForm.quantite} onChange={e => setMouvForm({ ...mouvForm, quantite: e.target.value })} required style={{ padding: '8px' }} />
                  <input type="text" placeholder="Motif ou Fournisseur" value={mouvForm.motif} onChange={e => setMouvForm({ ...mouvForm, motif: e.target.value })} required style={{ padding: '8px' }} />
                </div>
                <button type="submit" style={{ marginTop: '15px', backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Enregistrer l'opération ({mouvementSubTab})</button>
              </form>
            ) : (
              <div style={{ backgroundColor: '#fff', padding: '7px 10px', borderRadius: '7px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ color: '#0284c7', margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="rapports" taille={15} /> Suivi des restes en stock par article</h3>
                <span style={{ color: '#64748b', fontSize: '11px' }}>Vue consolidée des quantités restantes en temps réel.</span>
              </div>
            )}

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Type</th>
                    <th style={{ padding: '12px' }}>Référence / Article</th>
                    <th style={{ padding: '12px' }}>Quantité</th>
                    <th style={{ padding: '12px' }}>Motif / Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {mouvements.filter(m => mouvementSubTab === 'RESTE' ? true : m.type === mouvementSubTab).map(m => (
                    <tr key={m._id || m.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}>{formatDate(m.date)}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: m.type === 'ACHAT' || m.type === 'ENTREE' || m.type === 'RECEPTION' ? '#16a34a' : '#ef4444' }}>{m.type}</td>
                      <td style={{ padding: '12px' }}>{m.nomProd} ({m.refProd})</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{m.quantite}</td>
                      <td style={{ padding: '12px' }}>{m.motif}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reappro' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.reappro}</h2>
            <label style={{ display: 'block', margin: '15px 0' }}>
              <input
                type="checkbox"
                checked={autoReappro}
                onChange={e => setAutoReappro(e.target.checked)}
              />{' '}
              Générer automatiquement une commande au seuil minimum
            </label>

            <div className="app-table-scroll" style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 6px 20px rgba(15,23,42,0.07)', border: '1px solid #e2e8f0' }}>
              <table className="app-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <colgroup>
                  <col style={{ width: '110px' }} />
                  <col />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '96px' }} />
                  <col style={{ width: '230px' }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '12px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Réf</th>
                    <th style={{ padding: '12px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Article</th>
                    <th style={{ padding: '12px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Fournisseur</th>
                    <th style={{ padding: '12px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, textAlign: 'center' }}>Stock</th>
                    <th style={{ padding: '12px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, textAlign: 'center' }}>Seuil min.</th>
                    <th style={{ padding: '12px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, textAlign: 'right' }}>Action recommandée</th>
                  </tr>
                </thead>
                <tbody>
                  {products.filter(p => !refsReapproMasquees.includes(p.ref)).map((p, index) => {
                    const stock = Number(p.quantiteStock) || 0;
                    const seuil = Number(p.minStock) || 0;
                    const rupture = stock === 0;
                    const isLow = stock <= seuil;
                    const aCommander = Math.max(1, (Number(p.maxStock) || seuil || 1) - stock);
                    const badge = rupture
                      ? { texte: 'Rupture', fond: '#fef2f2', bord: '#fecaca', couleur: '#b91c1c' }
                      : isLow
                        ? { texte: 'Stock bas', fond: '#fff7ed', bord: '#fed7aa', couleur: '#c2410c' }
                        : { texte: 'Suffisant', fond: '#f0fdf4', bord: '#bbf7d0', couleur: '#15803d' };

                    return (
                      <tr
                        key={p._id}
                        style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: index % 2 === 1 ? '#fafbfc' : '#fff' }}
                      >
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{p.ref}</td>
                        <td style={{ padding: '12px 14px', color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nom}>{p.nom}</td>
                        <td style={{ padding: '12px 14px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.fournisseur}>{p.fournisseur}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', minWidth: '54px', padding: '3px 10px', borderRadius: '999px', backgroundColor: badge.fond, border: `1px solid ${badge.bord}`, color: badge.couleur, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {stock}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{seuil}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'nowrap' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: badge.couleur, whiteSpace: 'nowrap' }}>{badge.texte}</span>
                            {isLow && (
                              <button
                                type="button"
                                onClick={() => creerCommande(p, 'Manuelle', { ouvrirAchats: true })}
                                title={`Commander ${aCommander} unité(s) chez ${p.fournisseur}`}
                                style={{ padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: '#f97316', color: '#fff', border: 'none', borderRadius: '6px', boxShadow: '0 1px 3px rgba(249,115,22,0.35)' }}
                              >
                                <Icone nom="commander" taille={13} /> Commander
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p._id)}
                              title="Retirer cet article du catalogue et de la gestion de stock"
                              style={{ padding: '7px 12px', fontSize: '12px', fontWeight: 600, border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', backgroundColor: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Retirer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'achats' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="achats" taille={22} /> Achats & Fournisseurs</h2>
            {bonCommandePrefill && (
              <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', padding: '11px 13px', borderRadius: '8px', marginBottom: '12px' }}>
                <h3 style={{ color: '#c2410c', margin: '0 0 7px 0', fontSize: '13px' }}>
                  <Icone nom="eclair" taille={15} style={{ marginRight: '6px' }} /> Bon de commande pré-rempli depuis Réapprovisionnement — {bonCommandePrefill.ref} ({bonCommandePrefill.nom})
                </h3>
                <form onSubmit={validerBonCommande} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '7px', alignItems: 'center' }}>
                  <input type="text" placeholder="Référence" value={bonCommandeForm.ref} onChange={e => setBonCommandeForm({ ...bonCommandeForm, ref: e.target.value })} required style={{ padding: '6px', fontSize: '12px' }} />
                  <input type="text" placeholder="Désignation" list="liste-bc-designations" value={bonCommandeForm.nom} onChange={e => setBonCommandeForm({ ...bonCommandeForm, nom: e.target.value })} style={{ padding: '6px', fontSize: '12px' }} />
                  <datalist id="liste-bc-designations">
                    {products.map(product => <option key={product._id} value={product.nom} />)}
                  </datalist>
                  <input type="text" placeholder="Fournisseur" list="liste-bc-fournisseurs" value={bonCommandeForm.fournisseur} onChange={e => setBonCommandeForm({ ...bonCommandeForm, fournisseur: e.target.value })} required style={{ padding: '6px', fontSize: '12px' }} />
                  <datalist id="liste-bc-fournisseurs">
                    {[...new Set([
                      ...fournisseursServeur.map(f => f.nom),
                      ...products.map(product => product.fournisseur)
                    ].filter(Boolean))].map(fournisseur => <option key={fournisseur} value={fournisseur} />)}
                  </datalist>
                  <input type="number" min="1" placeholder="Quantité manquante" value={bonCommandeForm.quantite} onChange={e => setBonCommandeForm({ ...bonCommandeForm, quantite: e.target.value })} required style={{ padding: '6px', fontSize: '12px' }} />
                  <input type="number" min="0" placeholder="Prix d'achat (FCFA)" value={bonCommandeForm.prixAchat} onChange={e => setBonCommandeForm({ ...bonCommandeForm, prixAchat: e.target.value })} style={{ padding: '6px', fontSize: '12px' }} />
                  <button type="submit" style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '7px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Valider la commande</button>
                  <button type="button" onClick={() => setBonCommandePrefill(null)} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '7px 12px', fontSize: '12px', borderRadius: '5px', cursor: 'pointer' }}>{t.cancel}</button>
                </form>
              </div>
            )}
            <div className="purchase-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <strong>Commandes ouvertes</strong>
                <p style={{ margin: '5px 0 0', color: '#0284c7', fontSize: '20px', fontWeight: 'bold' }}>{purchaseOrders.filter(order => order.statut !== 'Réceptionnée').length}</p>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <strong>Articles à recevoir</strong>
                <p style={{ margin: '5px 0 0', color: '#eab308', fontSize: '20px', fontWeight: 'bold' }}>{purchaseOrders.filter(order => order.statut !== 'Réceptionnée').reduce((total, order) => total + Number(order.quantite), 0)}</p>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <strong>Dernier dépôt actif</strong>
                <p style={{ margin: '5px 0 0', color: '#16a34a', fontWeight: 'bold' }}>{depotActif}</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '10px' }}>Date</th>
                    <th style={{ padding: '10px' }}>Réf.</th>
                    <th style={{ padding: '10px' }}>Article</th>
                    <th style={{ padding: '10px' }}>Fournisseur</th>
                    <th style={{ padding: '10px' }}>Quantité</th>
                    <th style={{ padding: '10px' }}>Prix d’achat</th>
                    <th style={{ padding: '10px' }}>Dépôt</th>
                    <th style={{ padding: '10px' }}>Statut</th>
                    <th style={{ padding: '10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.length === 0 ? (
                    <tr><td colSpan="9" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Aucune commande d’achat enregistrée.</td></tr>
                  ) : purchaseOrders.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px' }}>{formatDate(order.date)}</td>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{order.ref}</td>
                      <td style={{ padding: '10px' }}>{order.nom}</td>
                      <td style={{ padding: '10px' }}>{order.fournisseur || 'Non renseigné'}</td>
                      <td style={{ padding: '10px' }}>{order.quantite}</td>
                      <td style={{ padding: '10px' }}>{Number(order.prixAchat || 0).toLocaleString()} FCFA</td>
                      <td style={{ padding: '10px' }}>{order.depot || depotActif}</td>
                      <td style={{ padding: '10px', color: order.statut === 'Réceptionnée' ? '#16a34a' : '#eab308', fontWeight: 'bold' }}>{order.statut}</td>
                      <td style={{ padding: '10px' }}>
                        {order.statut !== 'Réceptionnée' && (
                          <button type="button" onClick={() => recevoirCommande(order)} style={{ padding: '6px 9px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                            Réceptionner
                          </button>
                        )}
                        <button type="button" onClick={() => handleDeletePurchaseOrder(order)} style={{ marginLeft: '6px', padding: '6px 9px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'depenses' && modulesDebloques.includes('depenses') && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="depenses" taille={22} /> Gestion des Dépenses & Charges</h2>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>{editingDepenseId ? "Modifier la dépense" : "Enregistrer une nouvelle charge / dépense"}</h3>
              <form onSubmit={handleDepenseSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <input type="text" placeholder="Libellé (ex: Loyer, Facture...)" value={depenseForm.libelle} onChange={e => setDepenseForm({ ...depenseForm, libelle: e.target.value })} required style={{ padding: '8px' }} />
                <input type="number" placeholder="Montant (FCFA)" value={depenseForm.montant} onChange={e => setDepenseForm({ ...depenseForm, montant: e.target.value })} required style={{ padding: '8px' }} />
                <select value={depenseForm.categorie} onChange={e => setDepenseForm({ ...depenseForm, categorie: e.target.value })} style={{ padding: '8px' }}>
                  <option value="Fixe">Charge Fixe</option>
                  <option value="Variable">Charge Variable / Achat divers</option>
                </select>
                <input type="date" value={depenseForm.date} onChange={e => setDepenseForm({ ...depenseForm, date: e.target.value })} style={{ padding: '8px' }} />
                <div style={{ display: 'flex', gap: '10px', gridColumn: '1 / -1' }}>
                  <button type="submit" style={{ backgroundColor: editingDepenseId ? '#eab308' : '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{editingDepenseId ? t.save : "Ajouter la dépense"}</button>
                  {editingDepenseId && <button type="button" onClick={() => { setEditingDepenseId(null); setDepenseForm({ libelle: '', montant: '', categorie: 'Fixe', date: new Date().toISOString().split('T')[0] }); }} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>{t.cancel}</button>}
                </div>
              </form>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Libellé</th>
                    <th style={{ padding: '12px' }}>Catégorie</th>
                    <th style={{ padding: '12px' }}>Montant</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {depensesList.map(d => (
                    <tr key={d._id || d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}>{(d.date || '').toString().slice(0, 10)}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{d.libelle}</td>
                      <td style={{ padding: '12px' }}>{d.categorie}</td>
                      <td style={{ padding: '12px', color: '#ef4444', fontWeight: 'bold' }}>{Number(d.montant).toLocaleString()} FCFA</td>
                      <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEditDepense(d)} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>{t.edit}</button>
                        <button onClick={() => handleDeleteDepense(d._id || d.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>{t.delete}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'devis' && (
          <div>
            <h2 className="no-print" style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="devis" taille={22} /> Création de Devis & Factures Proforma</h2>
            {/* Zone imprimable : un reçu PAR CLIENT. Les devis portant le même
                nom sont regroupés sur le même document, avec un seul bloc de
                totaux ; un client différent produit un nouveau document.
                Si `devisAImprimer` est défini, seul ce client est imprimé. */}
            {Object.entries(
              devisList
                .filter(dv => !devisAImprimer || (dv.client || 'Client').trim() === devisAImprimer)
                .reduce((groupes, dv) => {
                  const cle = (dv.client || 'Client').trim();
                  if (!groupes[cle]) groupes[cle] = [];
                  groupes[cle].push(dv);
                  return groupes;
                }, {})
            ).map(([client, lignes], indexClient) => {
              const sousTotalHT = lignes.reduce((s, dv) => s + Number(dv.montantHT ?? 0), 0);
              const totalTVA = lignes.reduce((s, dv) => s + Number(dv.montantTVA ?? 0), 0);
              const totalTTC = lignes.reduce((s, dv) => s + Number(dv.montant ?? 0), 0);
              const tvaAffichee = Number(lignes[0]?.tva ?? 0);
              return (
                <div key={`devis-${client}-${indexClient}`} data-recu-client className="print-only" style={{ marginBottom: '26px', color: '#0f172a', pageBreakInside: 'avoid' }}>
                  <h2 style={{ textAlign: 'center', margin: '0 0 2px' }}>{storeInfo.nomMagasin}</h2>
                  <p style={{ textAlign: 'center', margin: 0, fontSize: '11px' }}>{storeInfo.adresse} · {storeInfo.telephone} · RCCM {storeInfo.rccm}</p>
                  <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: '12px', fontWeight: 'bold' }}>DEVIS / FACTURE PROFORMA</p>
                  <p style={{ margin: '8px 0 0', fontSize: '11px' }}>
                    Client : <strong>{client}</strong> · Date : {new Date().toLocaleDateString('fr-FR')} ·
                    Offre valable : <strong>{lignes[lignes.length - 1]?.validite || '2 semaines'}</strong>
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'left' }}>Désignation</th>
                        <th style={{ border: '1px solid #94a3b8', padding: '6px' }}>Qté</th>
                        <th style={{ border: '1px solid #94a3b8', padding: '6px' }}>P.U. HT</th>
                        <th style={{ border: '1px solid #94a3b8', padding: '6px' }}>Montant HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map(dv => (
                        <tr key={dv.id}>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px' }}>{dv.client} — prestation {dv.id}</td>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px' }}>{dv.quantite ?? 1}</td>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px' }}>{Number(dv.prixUnitaire ?? 0).toLocaleString()}</td>
                          <td style={{ border: '1px solid #94a3b8', padding: '6px' }}>{Number(dv.montantHT ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Un seul bloc de totaux par client. */}
                  <div style={{ marginTop: '8px', marginLeft: 'auto', width: '260px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sous-total HT</span><span>{sousTotalHT.toLocaleString()} FCFA</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TVA ({tvaAffichee} %)</span><span>{totalTVA.toLocaleString()} FCFA</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #94a3b8', paddingTop: '3px' }}><span>Total TTC</span><span>{totalTTC.toLocaleString()} FCFA</span></div>
                  </div>
                  {/* Mentions légales obligatoires — réglementation ivoirienne */}
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '9.5px', color: '#475569', textAlign: 'center', lineHeight: '1.5' }}>
                    {construireMentionsLegales(storeInfo).map((ligne, i) => (
                      <p key={i} style={{ margin: '2px 0' }}>{ligne}</p>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="no-print" style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', margin: '0 0 6px 0', fontSize: '13px' }}>Générer un nouveau devis</h3>
              <form onSubmit={handleDevisSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', alignItems: 'center' }}>
                <input type="text" placeholder="Client / Entreprise" value={devisForm.client} onChange={e => setDevisForm({ ...devisForm, client: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <input type="number" min="1" placeholder="Quantité" value={devisForm.quantite} onChange={e => setDevisForm({ ...devisForm, quantite: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} />
                <input type="number" min="0" step="0.01" placeholder="Prix unitaire (FCFA)" value={devisForm.prixUnitaire} onChange={e => setDevisForm({ ...devisForm, prixUnitaire: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <input type="number" min="0" max="100" step="0.01" placeholder="Remise (%)" value={devisForm.remise} onChange={e => setDevisForm({ ...devisForm, remise: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} />
                <select value={devisForm.tva} onChange={e => setDevisForm({ ...devisForm, tva: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} title="TVA">
                  <option value="0">TVA 0 %</option>
                  <option value="9">TVA 9 %</option>
                  <option value="18">TVA 18 %</option>
                </select>
                <select value={devisForm.conditions} onChange={e => setDevisForm({ ...devisForm, conditions: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} title="Conditions de règlement">
                  <option value="Paiement à la livraison">Paiement à la livraison</option>
                  <option value="Paiement à 30 jours">Paiement à 30 jours</option>
                  <option value="Paiement à 60 jours">Paiement à 60 jours</option>
                  <option value="Comptant">Comptant</option>
                  <option value="50 % à la commande">50 % à la commande</option>
                </select>
                <select value={devisForm.validite} onChange={e => setDevisForm({ ...devisForm, validite: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} title="Validité de l'offre">
                  <option value="1 semaine">Validité : 1 semaine</option>
                  <option value="2 semaines">Validité : 2 semaines</option>
                  <option value="3 semaines">Validité : 3 semaines</option>
                  <option value="4 semaines">Validité : 4 semaines</option>
                </select>
                <select value={devisForm.statut} onChange={e => setDevisForm({ ...devisForm, statut: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} title="Statut">
                  <option value="En attente">En attente</option>
                  <option value="Validé">Validé</option>
                </select>
                <button type="button" onClick={() => { setDevisForm({ ...devisForm, quantite: Number(devisForm.quantite || 0) + 1 }); }} disabled={!devisForm.client || Number(devisForm.prixUnitaire) <= 0} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter</button>
                <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Générer</button>
              </form>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '7px', fontSize: '11px', color: '#475569' }}>
                <span>Sous-total : <strong>{devisSousTotal.toLocaleString()} FCFA</strong></span>
                {Number(devisForm.remise) > 0 && <span>Remise : <strong>-{devisRemise.toLocaleString()}</strong></span>}
                <span>TVA ({Number(devisForm.tva) || 0} %) : <strong>{devisTVA.toLocaleString()}</strong></span>
                <span>Total TTC : <strong style={{ color: '#16a34a' }}>{devisTTC.toLocaleString()} FCFA</strong></span>
              </div>
              {/* Impression groupée : un reçu par client, chacun sur sa propre page. */}
              {devisList.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDevisAImprimer(null); // Tous les clients.
                      window.setTimeout(() => imprimer(), 100);
                    }}
                    style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '8px 14px', fontSize: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    <Icone nom="imprimer" taille={14} /> Imprimer tous les reçus
                  </button>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {new Set(devisList.map(dv => (dv.client || 'Client').trim())).size} client(s) — un reçu par client, sur sa propre page.
                  </span>
                </div>
              )}
            </div>

            <div className="no-print" style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '8px' }}>Réf Devis</th>
                    <th style={{ padding: '8px' }}>Client</th>
                    <th style={{ padding: '8px' }}>Date</th>
                    <th style={{ padding: '8px' }}>Qté</th>
                    <th style={{ padding: '8px' }}>P.U.</th>
                    <th style={{ padding: '8px' }}>TVA</th>
                    <th style={{ padding: '8px' }}>Montant TTC</th>
                    <th style={{ padding: '8px' }}>Conditions</th>
                    <th style={{ padding: '8px' }}>Statut</th>
                    <th style={{ padding: '8px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {devisList.map(dv => (
                    <tr key={dv.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold', fontSize: '12px' }}>{dv.id}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{dv.client}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{formatDate(dv.date)}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{dv.quantite ?? 1}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{Number(dv.prixUnitaire ?? dv.montant ?? 0).toLocaleString()}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{Number(dv.tva || 0)} %</td>
                      <td style={{ padding: '8px', fontSize: '12px', fontWeight: 'bold', color: '#16a34a' }}>{Number(dv.montant || 0).toLocaleString()} FCFA</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{dv.conditions || '—'}</td>
                      <td style={{ padding: '8px', fontSize: '12px', color: dv.statut === 'Validé' ? '#16a34a' : '#f59e0b', fontWeight: 'bold' }}>{dv.statut}</td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => {
                            // On n'imprime que le reçu du client de cette ligne.
                            setDevisAImprimer((dv.client || 'Client').trim());
                            window.setTimeout(() => imprimer(), 100);
                          }}
                          style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          <Icone nom="imprimer" taille={14} /> Imprimer / PDF
                        </button>{' '}
                        <button type="button" onClick={() => retirerDevis(dv.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', marginTop: '4px' }}>Retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventaire' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="inventaire" taille={22} /> Inventaire Physique & Écarts de Stock</h2>
            <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>Mode de saisie :</span>
                <button type="button" onClick={() => setInvMode('AUTO')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '999px', border: '1px solid ' + (invMode === 'AUTO' ? '#0284c7' : '#cbd5e1'), background: invMode === 'AUTO' ? '#0284c7' : '#fff', color: invMode === 'AUTO' ? '#fff' : '#334155', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="camera" taille={12} /> Inventaire physique auto</button>
                <button type="button" onClick={() => setInvMode('LIBRE')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '999px', border: '1px solid ' + (invMode === 'LIBRE' ? '#16a34a' : '#cbd5e1'), background: invMode === 'LIBRE' ? '#16a34a' : '#fff', color: invMode === 'LIBRE' ? '#fff' : '#334155', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="notes" taille={12} /> Saisie libre</button>
              </div>

              {invMode === 'AUTO' ? (
                <form onSubmit={handleInventaireSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px', alignItems: 'center' }}>
                  <select value={invForm.ref} onChange={e => { const p = products.find(x => x.ref === e.target.value); setInvForm({ ...invForm, ref: e.target.value, nom: p ? p.nom : '' }); }} style={{ padding: '5px 6px', fontSize: '12px' }}>
                    <option value="">-- Article --</option>
                    {products.map(p => <option key={p._id} value={p.ref}>{p.ref} - {p.nom}</option>)}
                  </select>
                  <input type="number" placeholder="Qté comptée" value={invForm.stockPhysique} onChange={e => setInvForm({ ...invForm, stockPhysique: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                  <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Calculer l'écart</button>
                </form>
              ) : (
                <form onSubmit={handleInventaireLibreSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', alignItems: 'center' }}>
                  <input type="text" placeholder="Référence" value={invLibreForm.ref} onChange={e => setInvLibreForm({ ...invLibreForm, ref: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                  <input type="text" placeholder="Désignation libre" value={invLibreForm.nom} onChange={e => setInvLibreForm({ ...invLibreForm, nom: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                  <input type="number" placeholder="Stock théorique" value={invLibreForm.stockTheorique} onChange={e => setInvLibreForm({ ...invLibreForm, stockTheorique: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} />
                  <input type="number" placeholder="Compté" value={invLibreForm.stockPhysique} onChange={e => setInvLibreForm({ ...invLibreForm, stockPhysique: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                  <button type="submit" style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Enregistrer</button>
                </form>
              )}

              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                {invMode === 'AUTO'
                  ? 'Le comptage est rattaché à une fiche article : l’écart est calculé automatiquement.'
                  : 'Saisie libre : saisissez directement la référence et la désignation, même si l’article n’existe pas au catalogue.'}
              </p>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '6px 8px' }}>Date</th>
                    <th style={{ padding: '6px 8px' }}>Réf</th>
                    <th style={{ padding: '6px 8px' }}>Article</th>
                    <th style={{ padding: '6px 8px' }}>Théorique</th>
                    <th style={{ padding: '6px 8px' }}>Physique</th>
                    <th style={{ padding: '6px 8px' }}>Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {inventaireList.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>Aucun inventaire enregistré.</td></tr>
                  ) : inventaireList.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 8px' }}>{inv.date}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{inv.ref}</td>
                      <td style={{ padding: '6px 8px' }}>{inv.nom}</td>
                      <td style={{ padding: '6px 8px' }}>{inv.stockTheorique}</td>
                      <td style={{ padding: '6px 8px' }}>{inv.stockPhysique}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 'bold', color: inv.ecart === 0 ? '#16a34a' : inv.ecart > 0 ? '#0284c7' : '#ef4444' }}>{inv.ecart > 0 ? `+${inv.ecart}` : inv.ecart}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'transport' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.transport}</h2>
            <form onSubmit={handleTransportSubmit} style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', margin: '0 0 6px 0', fontSize: '13px' }}>{editingTransportId ? "Modifier l'expédition" : "Planifier une livraison / expédition"}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', alignItems: 'center' }}>
                <input type="text" placeholder="Nom du responsable" value={transpForm.nomResponsable} onChange={e => setTranspForm({ ...transpForm, nomResponsable: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <input type="text" placeholder="Prénoms" value={transpForm.prenomsResponsable} onChange={e => setTranspForm({ ...transpForm, prenomsResponsable: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <input type="text" placeholder="Véhicule" list="liste-types-vehicules" value={transpForm.vehicule} onChange={e => setTranspForm({ ...transpForm, vehicule: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <datalist id="liste-types-vehicules">
                  {[...new Set([...vehicules.map(v => v.type), 'Camion 10T', 'Camion 3,5T', 'Pick-up', 'Fourgon', 'Moto'].filter(Boolean))].map(type => <option key={type} value={type} />)}
                </datalist>
                {/* Immatriculation : champ interactif et cliquable (liste / fiche véhicule) */}
                <input
                  type="text"
                  placeholder="Immatriculation du véhicule"
                  list="liste-immatriculations"
                  value={transpForm.immatriculation}
                  onChange={e => setTranspForm({ ...transpForm, immatriculation: e.target.value })}
                  onClick={() => setFicheVehicule({ mode: 'liste' })}
                  onFocus={() => !transpForm.immatriculation && setFicheVehicule({ mode: 'liste' })}
                  required
                  style={{ padding: '5px 6px', fontSize: '12px', cursor: 'pointer' }}
                />
                <datalist id="liste-immatriculations">
                  {vehicules.map(vehicule => <option key={vehicule.id} value={vehicule.immatriculation}>{vehicule.type} — {vehicule.conducteur}</option>)}
                </datalist>
                {/* Nombre de voyage : saisie numérique */}
                <input type="number" min="1" step="1" placeholder="Nombre de voyage" value={transpForm.nombreVoyage} onChange={e => setTranspForm({ ...transpForm, nombreVoyage: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <input type="text" placeholder="Destination (toutes les villes)" list="liste-villes-ci" value={transpForm.destination} onChange={e => setTranspForm({ ...transpForm, destination: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <datalist id="liste-villes-ci">
                  {VILLES_DESTINATION_CI.map(ville => <option key={ville} value={ville} />)}
                </datalist>
                <input type="text" placeholder="Client" list="liste-clients-transport" value={transpForm.client} onChange={e => setTranspForm({ ...transpForm, client: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <datalist id="liste-clients-transport">
                  {[...new Set([...clients.map(c => c.nom), ...transports.map(tr => tr.client)].filter(Boolean))].map(nom => <option key={nom} value={nom} />)}
                </datalist>
                <input type="number" placeholder="Frais (FCFA)" value={transpForm.frais} onChange={e => setTranspForm({ ...transpForm, frais: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <button type="submit" style={{ backgroundColor: editingTransportId ? '#eab308' : '#16a34a', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>{editingTransportId ? t.save : "Enregistrer"}</button>
                {editingTransportId && <button type="button" onClick={() => { setEditingTransportId(null); setTranspForm({ nomResponsable: '', prenomsResponsable: '', vehicule: '', immatriculation: '', nombreVoyage: 1, destination: '', client: '', frais: '', commentaires: '' }); }} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', cursor: 'pointer' }}>{t.cancel}</button>}
              </div>
            </form>

            <div className="transport-table-scroll" style={{ backgroundColor: '#fff', borderRadius: '10px', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table className="transport-table" style={{ width: '100%', minWidth: '1120px', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <colgroup>
                  <col style={{ width: '115px' }} />
                  <col style={{ width: '185px' }} />
                  <col style={{ width: '125px' }} />
                  <col style={{ width: '155px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '165px' }} />
                  <col style={{ width: '145px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '190px' }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '14px 12px' }}>Date</th>
                    <th style={{ padding: '14px 12px' }}>Responsable<br />(Nom & Prénoms)</th>
                    <th style={{ padding: '14px 12px' }}>Véhicule</th>
                    <th style={{ padding: '14px 12px' }}>Immatriculation</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center' }}>Nb. voyages</th>
                    <th style={{ padding: '14px 12px' }}>Destination</th>
                    <th style={{ padding: '14px 12px' }}>Client</th>
                    <th style={{ padding: '14px 12px', textAlign: 'right' }}>Frais</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transports.map(tr => (
                    <tr key={tr._id || tr.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{formatDate(tr.date)}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', overflowWrap: 'anywhere' }}>{tr.nomResponsable} {tr.prenomsResponsable}</td>
                      <td style={{ padding: '12px', overflowWrap: 'anywhere' }}>{tr.vehicule}</td>
                      <td style={{ padding: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setFicheVehicule({ mode: 'fiche', immatriculation: tr.immatriculation })}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '82px', maxWidth: '100%', minHeight: '30px', background: '#f0f9ff', border: '1px dashed #0284c7', color: '#0369a1', padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {tr.immatriculation || '—'} ⓘ
                        </button>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a', textAlign: 'center' }}>{tr.nombreVoyage || 1}</td>
                      <td style={{ padding: '12px', overflowWrap: 'anywhere' }}>{tr.destination}</td>
                      <td style={{ padding: '12px', overflowWrap: 'anywhere' }}>{tr.client}</td>
                      <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{Number(tr.frais || 0).toLocaleString()} FCFA</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                          <button type="button" onClick={() => handleEditTransport(tr)} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '7px 9px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="notes" taille={13} /> {t.edit}</button>
                          <button type="button" onClick={() => handleDeleteTransport(tr._id || tr.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '7px 9px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="retirer" taille={13} /> {t.delete}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fiche détaillée du véhicule / liste des immatriculations enregistrées */}
            {ficheVehicule && (() => {
              const plaqueRecherchee = String(ficheVehicule.immatriculation || '').trim().toUpperCase();
              const vehiculeTrouve = vehicules.find(
                vehicule => String(vehicule.immatriculation).toUpperCase() === plaqueRecherchee
              );
              const voyagesLiees = transports.filter(tr => String(tr.immatriculation || '').toUpperCase() === plaqueRecherchee);

              return (
                <div className="modal-overlay">
                  <div className="modal-card">
                    <button type="button" className="modal-close" aria-label="Fermer" onClick={() => setFicheVehicule(null)}><Icone nom="fermer" taille={16} /></button>

                    {ficheVehicule.mode === 'liste' ? (
                      <>
                        <h3 style={{ marginTop: 0, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="vehicule" taille={16} /> Immatriculations enregistrées</h3>
                        {vehicules.length === 0 ? (
                          <p style={{ fontSize: '13px', color: '#64748b' }}>Aucun véhicule enregistré pour le moment.</p>
                        ) : (
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {vehicules.map(vehicule => (
                              <li key={vehicule.id} style={{ marginBottom: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTranspForm(form => ({
                                      ...form,
                                      immatriculation: vehicule.immatriculation,
                                      vehicule: form.vehicule || vehicule.type
                                    }));
                                    setFicheVehicule({ mode: 'fiche', immatriculation: vehicule.immatriculation });
                                  }}
                                  style={{ width: '100%', textAlign: 'left', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  <strong>{vehicule.immatriculation}</strong> — {vehicule.type} · Capacité : {vehicule.capacite} · Conducteur : {vehicule.conducteur}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button type="button" onClick={() => setFicheVehicule(null)} style={{ marginTop: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '7px 14px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer' }}>Fermer</button>
                      </>
                    ) : (
                      <>
                        <h3 style={{ marginTop: 0, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="vehicule" taille={16} /> Fiche véhicule — {plaqueRecherchee || 'Non renseignée'}</h3>
                        {vehiculeTrouve ? (
                          <ul style={{ fontSize: '13px', color: '#334155', lineHeight: '1.8', paddingLeft: '18px' }}>
                            <li><strong>Immatriculation :</strong> {vehiculeTrouve.immatriculation}</li>
                            <li><strong>Type :</strong> {vehiculeTrouve.type}</li>
                            <li><strong>Capacité :</strong> {vehiculeTrouve.capacite}</li>
                            <li><strong>Conducteur :</strong> {vehiculeTrouve.conducteur}</li>
                            <li><strong>Voyages enregistrés :</strong> {voyagesLiees.length}</li>
                            <li><strong>Frais cumulés :</strong> {voyagesLiees.reduce((total, voyage) => total + Number(voyage.frais || 0), 0).toLocaleString()} FCFA</li>
                          </ul>
                        ) : (
                          <p style={{ fontSize: '13px', color: '#b45309', fontWeight: 'bold' }}>
                            Cette immatriculation n’est pas encore enregistrée dans la flotte. Elle sera créée automatiquement à la validation de l’expédition.
                          </p>
                        )}
                        <button type="button" onClick={() => setFicheVehicule(null)} style={{ marginTop: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '7px 14px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer' }}>Fermer</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'clients' && (
          <Clients
            t={t}
            headerConfig={headerConfig}
            clients={clients}
            clientForm={clientForm}
            setClientForm={setClientForm}
            editingClientId={editingClientId}
            setEditingClientId={setEditingClientId}
            CLIENT_INITIAL={CLIENT_INITIAL}
            handleClientSubmit={handleClientSubmit}
            handleEditClient={handleEditClient}
            handleDeleteClient={handleDeleteClient}
          />
        )}

        {activeTab === 'credits' && modulesDebloques.includes('credits') && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="credits" taille={22} /> Crédits & Dettes clients</h2>
            <form onSubmit={handleCreditSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
              <input type="text" placeholder="Nom du client ou artisan" value={creditForm.client} onChange={e => setCreditForm({ ...creditForm, client: e.target.value })} required style={{ padding: '8px' }} />
              <input type="tel" placeholder="Téléphone" value={creditForm.telephone} onChange={e => setCreditForm({ ...creditForm, telephone: e.target.value })} style={{ padding: '8px' }} />
              <input type="number" min="1" placeholder="Montant du crédit (FCFA)" value={creditForm.montant} onChange={e => setCreditForm({ ...creditForm, montant: e.target.value })} required style={{ padding: '8px' }} />
              <input type="date" value={creditForm.echeance} onChange={e => setCreditForm({ ...creditForm, echeance: e.target.value })} required style={{ padding: '8px' }} />
              <input type="text" placeholder="Note ou référence" value={creditForm.note} onChange={e => setCreditForm({ ...creditForm, note: e.target.value })} style={{ padding: '8px' }} />
              <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '9px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Enregistrer la dette</button>
            </form>
            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead><tr style={{ backgroundColor: '#1e293b', color: 'white' }}><th style={{ padding: '10px' }}>Client</th><th style={{ padding: '10px' }}>Téléphone</th><th style={{ padding: '10px' }}>Montant</th><th style={{ padding: '10px' }}>Échéance</th><th style={{ padding: '10px' }}>Statut</th><th style={{ padding: '10px' }}>Action</th></tr></thead>
                <tbody>{creditsList.length === 0 ? <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Aucun crédit enregistré.</td></tr> : creditsList.map(credit => <tr key={credit.id} style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '10px', fontWeight: 'bold' }}>{credit.client}</td><td style={{ padding: '10px' }}>{credit.telephone || '-'}</td><td style={{ padding: '10px' }}>{Number(credit.montant).toLocaleString()} FCFA</td><td style={{ padding: '10px' }}>{credit.echeance}</td><td style={{ padding: '10px', color: credit.statut === 'Payé' ? '#16a34a' : '#eab308', fontWeight: 'bold' }}>{credit.statut}</td><td style={{ padding: '10px' }}>{credit.statut !== 'Payé' && <button type="button" onClick={() => setCreditsList(items => items.map(item => item.id === credit.id ? { ...item, statut: 'Payé' } : item))} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px 9px', borderRadius: '5px', cursor: 'pointer' }}>Marquer payé</button>}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'dossiers' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.dossiers}</h2>
            <form onSubmit={handleUploadDossier} style={{ backgroundColor: '#fff', padding: '9px 11px', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', margin: '0 0 6px 0', fontSize: '13px' }}>Ajouter un justificatif ou document</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Titre du document" value={newDossierTitre} onChange={e => setNewDossierTitre(e.target.value)} required style={{ padding: '5px 6px', fontSize: '12px', flex: 1, minWidth: '160px' }} />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setNewDossierFile(e.target.files[0] || null)}
                  style={{ fontSize: '11px' }}
                />
                <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Téléverser</button>
              </div>
            </form>

            <h3>Images</h3>
            <div className="docs-row">
              {dossiers
                .filter(d => d.type !== 'application/pdf' && !d.nomFichier?.toLowerCase().endsWith('.pdf'))
                .map(d => (
                  <div key={d.id} className="doc-card">
                    <img
                      src={d.image}
                      alt={d.titre}
                      onClick={() => setSelectedDocPreview(d)}
                      style={{ width: '100%', height: '96px', objectFit: 'cover', cursor: 'pointer' }}
                    />
                    <h4 style={{ margin: '6px 0 0', fontSize: '12px' }}>{d.titre}</h4>

                    <button
                      type="button"
                      onClick={() => handleDeleteDossier(d)}
                      style={{ marginTop: '6px', padding: '4px 8px', fontSize: '11px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
            </div>

            <h3 style={{ marginTop: '25px' }}>Documents PDF</h3>
            <div className="docs-row">
              {dossiers
                .filter(d => d.type === 'application/pdf' || d.nomFichier?.toLowerCase().endsWith('.pdf'))
                .map(d => (
                  <div key={d.id} className="doc-card">
                    <div style={{ display: 'flex', justifyContent: 'center', color: '#64748b' }}><Icone nom="document" taille={32} epaisseur={1.5} /></div>
                    <h4 style={{ margin: '4px 0', fontSize: '12px' }}>{d.titre}</h4>
                    <a href={d.image} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px' }}>
                      Ouvrir le PDF — {d.nomFichier || d.titre}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteDossier(d)}
                      style={{ marginTop: '6px', padding: '4px 8px', fontSize: '11px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
            </div>

            {selectedDocPreview && (
              <div className="modal-overlay">
                <div className="modal-card" style={{ textAlign: 'center', maxWidth: '500px' }}>
                  <button type="button" className="modal-close" aria-label="Fermer" onClick={() => setSelectedDocPreview(null)}><Icone nom="fermer" taille={16} /></button>
                  <h3>{selectedDocPreview.titre}</h3>
                  <img src={selectedDocPreview.image} alt="Agrandissement" style={{ width: '100%', maxHeight: '350px', objectFit: 'contain', marginBottom: '15px' }} />
                  <button
                    onClick={() => setSelectedDocPreview(null)}
                    style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'paiements' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.paiements}</h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))',
                gap: '6px',
                marginBottom: '12px'
              }}
            >
              {paiements.map(pm => (
                <div
                  key={pm.id}
                  style={{
                    backgroundColor: '#fff',
                                      padding: '7px 6px',
                                      borderRadius: '8px',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                                      borderLeft: '3px solid #0284c7'
                                    }}
                                  >
                                    <PaymentLogo logo={pm.logo} size={26} />
                                    <h3 style={{ margin: '0 0 2px 0', color: '#0f172a', fontSize: '11px', lineHeight: '1.2', wordBreak: 'break-word' }}>{pm.nom}</h3>
                                    <p style={{ color: '#64748b', fontSize: '9px', margin: '0 0 5px 0', lineHeight: '1.2' }}>{pm.desc}</p>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentMethod(pm.moyen);
                      alert(`Mode de paiement défini sur : ${pm.moyen}`);
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: pm.type === 'Cash' ? '#16a34a' : pm.type === 'Card' ? '#0284c7' : pm.type === 'Wave' ? '#0ea5e9' : pm.type === 'Orange' ? '#f97316' : pm.type === 'Moov' ? '#047857' : '#eab308',
                      color: pm.type === 'MTN' ? '#111' : '#fff',
                      border: 'none',
                      padding: '5px',
                      borderRadius: '5px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Sélectionner
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                backgroundColor: '#fff',
                padding: '20px',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                textAlign: 'center'
              }}
            >
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>
                      Passerelle de paiement à distance
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '15px' }}>
                      Liens et QR codes informatifs : vérifiez toute transaction avec le prestataire avant d’enregistrer une vente.
                    </p>
                    <p role="status" style={{ color: '#64748b', fontSize: '12px' }}>La passerelle sera activée après configuration du prestataire côté serveur. Les méthodes de paiement restent sélectionnables dans le panier.</p>
            </div>

            <div
              style={{
                backgroundColor: '#fff',
                padding: '20px',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                textAlign: 'center',
                marginTop: '20px'
              }}
            >
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>
                Générateur de QR Code de Paiement Mobile
              </h3>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '15px' }}>
                Générez instantanément un QR Code universel pour encaisser vos clients par Mobile Money ou Carte.
              </p>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '15px' }}>
                Les opérateurs sont visibles dans la liste de la caisse. Les liens de paiement ne sont pas générés ici tant que l’API et les notifications du prestataire ne sont pas configurées.
              </p>
            </div>
          </div>
        )}

        {/* 14. RAPPORTS & INDICATEURS KPI */}
        {activeTab === 'abonnements' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="abonnements" taille={22} /> Abonnements par palier</h2>
            {/* Liste déroulante complète des moyens de paiement pour souscrire / renouveler */}
            <div style={{ backgroundColor: '#fff', padding: '13px', borderRadius: '8px', marginTop: '10px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', margin: '0 0 7px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="paiements" taille={15} /> Moyen de règlement de l’abonnement</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', alignItems: 'center' }}>
                <select
                  id="paiement-abonnement"
                  value={abonnementPaiement}
                  onChange={e => setAbonnementPaiement(e.target.value)}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Carte Bancaire">Carte bancaire (Kkiapay — confirmation serveur)</option>
                </select>
                <select
                  id="palier-abonnement"
                  aria-label="Palier d’abonnement souhaité"
                  value={abonnementPalier}
                  onChange={e => setAbonnementPalier(e.target.value)}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Standard / Boutique">Standard / Boutique — 10 000 FCFA / mois</option>
                  <option value="Professionnel / ERP">Professionnel / ERP — 25 000 FCFA / mois</option>
                  <option value="Enterprise / Master">Enterprise / Master — 45 000 FCFA / mois</option>
                  <option value="Transporteur (Spécial Transport)">Transporteur (Spécial Transport) — 5 000 FCFA / mois</option>
                </select>
                <button
                  type="button"
                  onClick={() => { setAbonnementPalier('Standard / Boutique'); setAbonnementPaiement('Carte Bancaire'); handlePaySubscription('Standard / Boutique'); }}
                  style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Standard / Boutique
                </button>
                <button
                  type="button"
                  onClick={() => { setAbonnementPalier('Professionnel / ERP'); setAbonnementPaiement('Carte Bancaire'); handlePaySubscription('Professionnel / ERP'); }}
                  style={{ backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Professionnel / ERP
                </button>
                <button
                  type="button"
                  onClick={() => { setAbonnementPalier('Enterprise / Master'); setAbonnementPaiement('Carte Bancaire'); handlePaySubscription('Enterprise / Master'); }}
                  style={{ backgroundColor: '#db2777', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Enterprise / Master
                </button>
                <button
                  type="button"
                  onClick={() => { setAbonnementPalier('Transporteur (Spécial Transport)'); setAbonnementPaiement('Carte Bancaire'); handlePaySubscription('Transporteur (Spécial Transport)'); }}
                  style={{ backgroundColor: '#0d9488', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  <Icone nom="transport" taille={15} style={{ marginRight: '6px' }} /> Transporteur
                </button>
              </div>
              <p style={{ margin: '7px 0 0', fontSize: '11px', color: '#64748b' }}>
                Règlement sélectionné : <strong>{abonnementPaiement}</strong> — Palier : <strong>{abonnementPalier}</strong>
              </p>
              {!cleKkiapayAbonnement && (
                <p role="status" style={{ margin: '6px 0 0', fontSize: '11px', fontWeight: 600, color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icone nom="avertissement" taille={13} /> Le paiement en ligne n’est pas encore activé par l’éditeur : la sélection fonctionne, mais l’activation se fait auprès du commercial.
                </p>
              )}
            </div>
            {/* Abonnement unique Transporteur */}
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bae6fd', padding: '13px', borderRadius: '8px', marginBottom: '14px' }}>
              <h3 style={{ color: '#1d4ed8', margin: '0 0 4px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="transport" taille={15} /> Abonnement Transporteur (Spécial Transport)</h3>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a' }}>
                Forfait unique destiné aux profils transporteurs : <strong>5 000 FCFA / mois</strong>, avec accès aux fonctionnalités logistiques de l’ERP.
              </p>
              <div role="radiogroup" aria-label="Choix du forfait Transporteur" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#1e3a8a' }}>
                  <input
                    type="radio"
                    name="palier-abonnement"
                    value="Transporteur (Spécial Transport)"
                    checked={abonnementPalier === 'Transporteur (Spécial Transport)'}
                    onChange={() => setAbonnementPalier('Transporteur (Spécial Transport)')}
                  />
                  Choisir le forfait Transporteur
                </label>
                <button
                  type="button"
                  onClick={() => { setAbonnementPalier('Transporteur (Spécial Transport)'); handlePaySubscription('Transporteur (Spécial Transport)'); }}
                  style={{ backgroundColor: '#1d4ed8', color: 'white', border: 'none', padding: '7px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  <Icone nom="transport" taille={14} /> Activer ce palier
                </button>
              </div>
            </div>
            <p style={{ color: '#64748b' }}>Choisissez un palier selon le nombre de comptes utilisateurs actifs : {usersList.length} compte(s) configuré(s).</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '8px', marginTop: '10px' }}>
              {[
                { nom: 'Solo', libelle: 'Standard / Boutique', comptes: 'Jusqu’à 3 comptes', prix: '10 000 FCFA / mois', limite: 3, couleur: '#0284c7' },
                { nom: 'Standard', libelle: 'Professionnel / ERP', comptes: 'Jusqu’à 10 comptes', prix: '25 000 FCFA / mois', limite: 10, couleur: '#7c3aed' },
                { nom: 'Pro / Illimité', libelle: 'Enterprise / Master', comptes: 'Comptes illimités', prix: '45 000 FCFA / mois', limite: Infinity, couleur: '#db2777' }
              ].map(plan => {
                const selectionne = abonnementPalier === plan.libelle;
                return (
                <div
                  key={plan.nom}
                  style={{
                    backgroundColor: selectionne ? '#f0f9ff' : '#fff',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    boxShadow: selectionne ? `0 0 0 2px ${plan.couleur}` : '0 2px 6px rgba(0,0,0,0.05)',
                    borderLeft: `3px solid ${usersList.length <= plan.limite ? '#16a34a' : '#cbd5e1'}`
                  }}
                >
                  {/* Toute la carte est un choix (bouton radio natif accessible). */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="palier-abonnement"
                      value={plan.libelle}
                      checked={selectionne}
                      onChange={() => setAbonnementPalier(plan.libelle)}
                      style={{ marginTop: '3px', flexShrink: 0 }}
                      aria-label={`Palier ${plan.libelle} — ${plan.prix}`}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', color: plan.couleur, margin: '0', fontSize: '13px', fontWeight: 700 }}>{plan.libelle}</span>
                      <span style={{ display: 'block', margin: '2px 0 0', fontWeight: 'bold', color: '#0f172a', fontSize: '11px' }}>{plan.comptes}</span>
                      <span style={{ display: 'block', margin: '1px 0 5px 0', color: '#64748b', fontSize: '10px' }}>{plan.prix}</span>
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setAbonnementPalier(plan.libelle); handlePaySubscription(plan.nom); }}
                    style={{ width: '100%', backgroundColor: plan.couleur, color: 'white', border: 'none', padding: '6px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {selectionne ? '✓ Palier sélectionné — Payer' : 'Choisir ce palier'}
                  </button>
                  <p style={{ margin: '4px 0 0', fontSize: '9px', color: '#64748b' }}>
                    Règlement : <strong>Kkiapay sécurisé</strong>
                  </p>
                </div>
                );
              })}
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>Paiement local</h3>
              <p style={{ color: '#64748b', marginBottom: 0 }}>Les paiements Wave, Orange Money, MTN Money et Moov Money sont disponibles dans le module Moyens de Paiement.</p>
            </div>
          </div>
        )}

        {activeTab === 'comptabilite' && modulesDebloques.includes('comptabilite') && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="comptabilite" taille={22} /> Comptabilité automatique</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '7px', marginBottom: '10px' }}>
              <div style={{ backgroundColor: '#fff', padding: '8px 10px', borderRadius: '7px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                <strong style={{ fontSize: '11px', color: '#475569' }}>Recettes enregistrées</strong>
                <p style={{ margin: '2px 0 0', color: '#16a34a', fontSize: '15px', fontWeight: 'bold' }}>{caTotalEstime.toLocaleString()} FCFA</p>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '8px 10px', borderRadius: '7px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                <strong style={{ fontSize: '11px', color: '#475569' }}>Charges et achats</strong>
                <p style={{ margin: '2px 0 0', color: '#ef4444', fontSize: '15px', fontWeight: 'bold' }}>{(totalDepensesReelles + totalFraisTransport + totalAchatsRecus).toLocaleString()} FCFA</p>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '8px 10px', borderRadius: '7px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                <strong style={{ fontSize: '11px', color: '#475569' }}>Résultat net</strong>
                <p style={{ margin: '2px 0 0', color: beneficeNet >= 0 ? '#16a34a' : '#ef4444', fontSize: '15px', fontWeight: 'bold' }}>{(caTotalEstime - totalDepensesReelles - totalFraisTransport - totalAchatsRecus).toLocaleString()} FCFA</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ padding: '9px 10px 0', color: '#0284c7', margin: 0, fontSize: '13px' }}>Journal automatique des écritures</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '10px' }}>Date</th>
                    <th style={{ padding: '10px' }}>Type</th>
                    <th style={{ padding: '10px' }}>Libellé</th>
                    <th style={{ padding: '10px' }}>Débit</th>
                    <th style={{ padding: '10px' }}>Crédit</th>
                    <th style={{ padding: '10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '10px' }}>{new Date().toLocaleDateString('fr-FR')}</td><td style={{ padding: '10px' }}>RECETTE</td><td style={{ padding: '10px' }}>Ventes estimées</td><td style={{ padding: '10px' }}>0 FCFA</td><td style={{ padding: '10px', color: '#16a34a', fontWeight: 'bold' }}>{caTotalEstime.toLocaleString()} FCFA</td><td style={{ padding: '10px' }}>—</td></tr>
                  {depensesList.map(depense => <tr key={`depense-${depense.id}`} style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '10px' }}>{formatDate(depense.date)}</td><td style={{ padding: '10px' }}>CHARGE</td><td style={{ padding: '10px' }}>{depense.libelle}</td><td style={{ padding: '10px', color: '#ef4444', fontWeight: 'bold' }}>{Number(depense.montant).toLocaleString()} FCFA</td><td style={{ padding: '10px' }}>0 FCFA</td><td style={{ padding: '10px' }}><button type="button" onClick={() => handleDeleteDepense(depense._id || depense.id)} aria-label={`Supprimer l'écriture ${depense.libelle}`} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><Icone nom="retirer" taille={13} /></button></td></tr>)}
                  {purchaseOrders.filter(commande => commande.statut === 'Réceptionnée').map(commande => <tr key={`achat-${commande.id}`} style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '10px' }}>{formatDate(commande.dateReception || commande.date)}</td><td style={{ padding: '10px' }}>ACHAT</td><td style={{ padding: '10px' }}>{commande.nom}</td><td style={{ padding: '10px', color: '#ef4444', fontWeight: 'bold' }}>{(Number(commande.prixAchat) * Number(commande.quantite)).toLocaleString()} FCFA</td><td style={{ padding: '10px' }}>0 FCFA</td><td style={{ padding: '10px' }}>—</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'reports' && modulesDebloques.includes('reports') && (
          <Rapports
            t={t}
            headerConfig={headerConfig}
            reportPeriod={reportPeriod}
            setReportPeriod={setReportPeriod}
            exporterRapportCsv={exporterRapportCsv}
            caTotalEstime={caTotalEstime}
            chargesPeriode={chargesPeriode}
            beneficeNet={beneficeNet}
            totalValeurStock={totalValeurStock}
            products={products}
            resumeAutomatique={resumeAutomatique}
            prefsA11y={prefsA11y}
          />
        )}

        {/* Déverrouillage d'un module sensible (Comptabilité, Rapports KPI,
            Crédits & Dettes, Dépenses) : un mot de passe dédié est exigé. */}
        {MODULES_SENSIBLES[activeTab] && moduleEnVerification === activeTab && !modulesDebloques.includes(activeTab) && (
          <form onSubmit={verifierAccesModule} aria-label={`Déverrouillage du module ${MODULES_SENSIBLES[activeTab]}`} style={{ background: '#fff', padding: '20px', maxWidth: '460px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h2 style={{ marginTop: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {motDePasseModules ? <><Icone nom="verrou" taille={20} /> Module protégé</> : <><Icone nom="cle" taille={20} /> Configurer le mot de passe des modules sensibles</>}
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px' }}>
              {motDePasseModules
                ? 'Saisissez le mot de passe pour ouvrir ce module.'
                : 'Première fois : choisissez un mot de passe dédié (6 caractères minimum). Il protégera Comptabilité, Rapports KPI, Crédits & Dettes et Dépenses.'}
            </p>
            <label htmlFor="mdp-module" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
              {motDePasseModules ? 'Mot de passe' : 'Nouveau mot de passe'}
            </label>
            <input
              id="mdp-module"
              type="password"
              autoComplete={motDePasseModules ? 'current-password' : 'new-password'}
              minLength={6}
              value={saisieModule}
              onChange={e => setSaisieModule(e.target.value)}
              required
              style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            {!motDePasseModules && (
              <>
                <label htmlFor="mdp-module-confirme" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', margin: '10px 0 4px' }}>Confirmer le mot de passe</label>
                <input
                  id="mdp-module-confirme"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={motDePasseModulesConfirme}
                  onChange={e => setMotDePasseModulesConfirme(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button type="submit" style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                {motDePasseModules ? 'Déverrouiller' : 'Enregistrer le mot de passe'}
              </button>
              <button type="button" onClick={() => { setModuleEnVerification(null); setActiveTab('dashboard'); }} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
            {erreurModule && <p role="alert" style={{ color: '#ef4444', fontSize: '12px', marginTop: '10px' }}>{erreurModule}</p>}
          </form>
        )}

        {activeTab === 'tresorerie' && utilisateurCourant?.role === 'Administrateur' && !accesTresorerie && (
          <form onSubmit={verifierAccesTresorerie} style={{ background: '#fff', padding: '20px', maxWidth: '420px' }}>
            <h2>{motDePasseTresorerie ? <><Icone nom="verrou" taille={20} /> Vérification administrateur</> : <><Icone nom="cle" taille={20} /> Configurer le mot de passe trésorerie</>}</h2>
            <p>{motDePasseTresorerie ? 'Saisissez le mot de passe trésorerie pour ouvrir le module.' : 'Première connexion : choisissez un mot de passe dédié à la trésorerie (6 caractères minimum).'}</p>
            <input type="password" autoComplete={motDePasseTresorerie ? 'current-password' : 'new-password'} aria-label={motDePasseTresorerie ? 'Mot de passe trésorerie' : 'Nouveau mot de passe trésorerie'} minLength={6} value={confirmationAdmin} onChange={e => setConfirmationAdmin(e.target.value)} required />
            {!motDePasseTresorerie && (
              <input type="password" autoComplete="new-password" aria-label="Confirmation du mot de passe trésorerie" minLength={6} placeholder="Confirmer le mot de passe" value={motDePasseTresorerieConfirme} onChange={e => setMotDePasseTresorerieConfirme(e.target.value)} required style={{ marginTop: '8px' }} />
            )}
            <button type="submit">{motDePasseTresorerie ? 'Déverrouiller' : 'Enregistrer le mot de passe'}</button>
            {erreurAdmin && <p role="alert">{erreurAdmin}</p>}
          </form>
        )}
        {activeTab === 'tresorerie' && utilisateurCourant?.role === 'Administrateur' && accesTresorerie && (
          <div>
             <button type="button" onClick={() => { window.clearTimeout(verrouTresorerieTimer.current); setAccesTresorerie(false); setActiveTab('dashboard'); }} style={{ marginBottom: '10px' }}>Verrouiller la trésorerie</button>
            <button type="button" onClick={modifierMotDePasseTresorerie} style={{ marginBottom: '10px', marginLeft: '8px' }}>Modifier le mot de passe trésorerie</button>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="tresorerie" taille={22} /> Trésorerie & Épargne Personnelle</h2>
            <p style={{ color: '#64748b', fontSize: '12px' }}>
              Module ultra-sécurisé — segregated de la caisse de l'entreprise. Les prélèvements sont bloqués si le seuil critique est atteint.
            </p>
            <TresorerieEpargne
              tresorerieEntreprise={Math.max(0, beneficeNet)}
              depensesPersonnelles={depensesPersonnelles}
              seuilCritique={seuilCritique}
              epargneCible={epargneCible}
              onAjouterDepense={d => setDepensesPersonnelles(liste => [d, ...liste])}
              onDefinirSeuil={setSeuilCritique}
              onDefinirEpargneCible={setEpargneCible}
            />
          </div>
        )}

        {activeTab === 'parametresGeneraux' && sousOngletParametres === 'geographie' && (
          <div className="geographie-page">
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="parametres" taille={22} /> Paramètres Généraux</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px' }}>
              <button type="button" onClick={() => setSousOngletParametres('administration')} style={{ padding: '9px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#e2e8f0', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '7px' }}><Icone nom="parametres" taille={15} /> Administration</button>
              <button type="button" onClick={() => setSousOngletParametres('geographie')} style={{ padding: '9px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#0284c7', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '7px' }}><Icone nom="monde" taille={15} /> Géographie</button>
            </div>
            <p className="geographie-intro">Le GPS fournit la position de votre appareil avec votre autorisation, il ne géocode pas automatiquement tous les pays. La hiérarchie CI est disponible ci-dessous; ailleurs, les champs administratifs sont libres.</p>
            {!isAuthenticated && <p role="status">Mode local hors connexion: les lieux restent enregistrés uniquement sur cet appareil.</p>}
            <div className="geographie-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '7px', marginBottom: '14px' }}>
              <div style={{ backgroundColor: '#fff', padding: '9px 11px', borderRadius: '7px', borderLeft: '3px solid #0284c7' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Villes configurées</span>
                <strong style={{ fontSize: '16px', color: '#0284c7' }}>{STATS_GEO.villes}</strong>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '9px 11px', borderRadius: '7px', borderLeft: '3px solid #16a34a' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Zones / Régions</span>
                <strong style={{ fontSize: '16px', color: '#16a34a' }}>{STATS_GEO.zones}</strong>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '9px 11px', borderRadius: '7px', borderLeft: '3px solid #8b5cf6' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Districts</span>
                <strong style={{ fontSize: '16px', color: '#8b5cf6' }}>{STATS_GEO.districts}</strong>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '9px 11px', borderRadius: '7px', borderLeft: '3px solid #eab308' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Préfectures / Sous-préfectures</span>
                <strong style={{ fontSize: '16px', color: '#ca8a04' }}>{STATS_GEO.prefectures} / {STATS_GEO.sousPrefectures}</strong>
              </div>
            </div>

            <div className="geographie-card" style={{ backgroundColor: '#fff', padding: '11px 13px', borderRadius: '8px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="navigationTerritoire" taille={15} /> Navigation hiérarchique du territoire</h3>
              <label htmlFor="pays-localisation" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Pays</label>
              {/* Tous les pays africains, groupés par région (optgroup). */}
              <select
                id="pays-localisation"
                value={paysGeo}
                onChange={e => { setPaysGeo(e.target.value); setGpsGeo(null); }}
                style={{ padding: '8px', marginBottom: '9px', width: '100%', maxWidth: '350px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                {PAYS_AFRIQUE_PAR_REGION.map(({ region, pays }) => (
                  <optgroup key={region} label={region}>
                    {pays.map(p => <option key={p.code} value={p.nom}>{p.nom} — {p.capitale}</option>)}
                  </optgroup>
                ))}
                {/* Pays hors Afrique déjà saisis : conservé pour ne rien perdre. */}
                {paysGeo && !PAYS_AFRIQUE_PAR_REGION.some(({ pays }) => pays.some(p => p.nom === paysGeo)) && (
                  <optgroup label="Autre pays"><option value={paysGeo}>{paysGeo}</option></optgroup>
                )}
              </select>
              {paysGeo === "Côte d'Ivoire" ? <>
              <div className="geographie-admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '3px' }}>District</label>
                  <select
                    value={selectedDistrictGeo}
                    onChange={e => { setSelectedDistrictGeo(e.target.value); }}
                    style={{ width: '100%', padding: '7px', fontSize: '12px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                  >
                    {DISTRICTS_CI.map(district => <option key={district.id} value={district.id}>{district.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '3px' }}>Région</label>
                  <select
                    value={selectedRegionGeo}
                    onChange={e => setSelectedRegionGeo(e.target.value)}
                    style={{ width: '100%', padding: '7px', fontSize: '12px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                  >
                    {regionsDuDistrict.map(region => <option key={region} value={region}>{region}</option>)}
                  </select>
                </div>
                {/* Préfecture / Département : liste complète de la Côte d'Ivoire */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '3px' }}>Préfecture / Département</label>
                  <select
                    value={selectedPrefectureGeo}
                    onChange={e => setSelectedPrefectureGeo(e.target.value)}
                    style={{ width: '100%', padding: '7px', fontSize: '12px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                  >
                    {prefecturesDeRegion.map(prefecture => <option key={prefecture.nom} value={prefecture.nom}>{prefecture.nom}</option>)}
                  </select>
                </div>
                {/* Ville / Chef-lieu : liste complète de la Côte d'Ivoire */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '3px' }}>Ville / Chef-lieu</label>
                  <select
                    value={selectedVilleGeo}
                    onChange={e => setSelectedVilleGeo(e.target.value)}
                    style={{ width: '100%', padding: '7px', fontSize: '12px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                  >
                    {villesPrefecture.map(ville => <option key={ville} value={ville}>{ville}</option>)}
                  </select>
                </div>
              </div>
              </> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                {[[districtLibreGeo, setDistrictLibreGeo, 'District / Province'], [regionLibreGeo, setRegionLibreGeo, 'Région'], [departementLibreGeo, setDepartementLibreGeo, 'Département'], [villeLibreGeo, setVilleLibreGeo, 'Ville']].map(([valeur, modifier, libelle]) =>
                  <label key={libelle} style={{ fontSize: '12px' }}>{libelle}<input type="text" value={valeur} onChange={e => modifier(e.target.value)} style={{ display: 'block', width: '100%', padding: '7px' }} /></label>
                )}
              </div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', alignItems: 'end', marginTop: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '3px' }}>Dépôt / Site actif</label>
                  <input
                    type="text"
                    list="liste-depots-geo"
                    value={depotActif}
                    onChange={e => setDepotActif(e.target.value)}
                    placeholder="Ex. : Dépôt Principal"
                    style={{ width: '100%', padding: '7px', fontSize: '12px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                  />
                  <datalist id="liste-depots-geo">
                    {DEPOTS_LISTE.map(depot => <option key={depot} value={depot} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '3px' }}>Nom du dépôt personnalisé</label>
                  <input
                    type="text"
                    value={depotPerso}
                    onChange={e => setDepotPerso(e.target.value)}
                    placeholder="Ex. : Dépôt Nord"
                    style={{ width: '100%', padding: '7px', fontSize: '12px', borderRadius: '5px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                  />
                  <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#64748b' }}>Libellé libre (sans contrainte de caractères), utilisé comme nom d'affichage du site.</p>
                </div>
              </div>

              <div style={{ marginTop: '9px', padding: '7px 10px', backgroundColor: '#eff6ff', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '11px', color: '#075985' }}>
                <Icone nom="position" taille={14} style={{ marginRight: '4px' }} /> Chemin actif : <strong>{paysGeo}</strong> › <strong>{paysGeo === "Côte d'Ivoire" ? districtActifGeo?.nom : districtLibreGeo}</strong> › <strong>{paysGeo === "Côte d'Ivoire" ? selectedRegionGeo : regionLibreGeo}</strong> › <strong>{paysGeo === "Côte d'Ivoire" ? selectedPrefectureGeo : departementLibreGeo}</strong> › <strong>{paysGeo === "Côte d'Ivoire" ? selectedVilleGeo : villeLibreGeo}</strong>
              </div>
              <form onSubmit={enregistrerLieuGeo} style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input aria-label="Nom du lieu" type="text" placeholder="Magasin, entreprise, maison ou autre lieu" value={lieuGeo} onChange={e => setLieuGeo(e.target.value)} required style={{ flex: 1, minWidth: '240px', padding: '8px' }} />
                <button type="button" onClick={capturerPositionGeo} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Icone nom="position" taille={14} /> Capturer ma position GPS</button>
                <span>Saisie de secours :</span>
                <input aria-label="Latitude GPS" type="number" step="any" min="-90" max="90" placeholder="Latitude" value={latitudeManuelleGeo} onChange={e => setLatitudeManuelleGeo(e.target.value)} />
                <input aria-label="Longitude GPS" type="number" step="any" min="-180" max="180" placeholder="Longitude" value={longitudeManuelleGeo} onChange={e => setLongitudeManuelleGeo(e.target.value)} />
                <button type="submit">Enregistrer ce lieu</button>
              </form>
              <p role="status" style={{ fontSize: '12px' }}>{statutGpsGeo}</p>
              {gpsGeo && <div><p>Latitude : {gpsGeo.latitude} · Longitude : {gpsGeo.longitude} · Précision estimée : {Math.round(gpsGeo.precision)} m</p><button type="button" onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${gpsGeo.latitude}&mlon=${gpsGeo.longitude}#map=16/${gpsGeo.latitude}/${gpsGeo.longitude}`, '_blank', 'noopener,noreferrer')}>Voir sur la carte</button></div>}
              {lieuxEnregistres.map(lieu => <p key={lieu.id}>{lieu.nom} — {lieu.pays}, {lieu.ville} ({lieu.latitude}, {lieu.longitude}) <button type="button" onClick={() => setLieuxEnregistres(liste => liste.filter(element => element.id !== lieu.id))}>Supprimer</button></p>)}
              <small>La capture localise uniquement votre appareil, avec votre autorisation. Pour localiser un autre lieu, rendez-vous sur place ou utilisez un service de géocodage. Les lieux sont enregistrés localement sur cet appareil, pas sur le serveur.</small>
            </div>
          </div>
        )}

        {activeTab === 'securite' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="securite" taille={22} /> Sécurité & Incidents</h2>
            <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 4px 0', color: '#0284c7', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="camera" taille={15} /> Surveillance de sécurité</h3>
              {utilisateurCourant?.role !== 'Administrateur' ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#b45309', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Icone nom="verrou" taille={13} /> Réservé à l’administrateur.</p>
              ) : !aAccesCameraEspion ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#b45309', fontWeight: 'bold' }}>
                  <Icone nom="verrou" taille={13} style={{ marginRight: '5px' }} /> Caméra désactivée pour cet abonnement.
                  <button type="button" onClick={() => setActiveTab('abonnements')} style={{ marginLeft: '8px', backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '4px 9px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Voir les abonnements</button>
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b' }}>
                    Cochez la case pour activer ou désactiver la surveillance en direct. Les captures horodatées sont archivées ci-dessous.
                  </p>
                  <CameraEspion
                    onPreuveCapturee={preuve => {
                      setSecurityEvents(events => ajouterEvenementSecurite(events, {
                        id: preuve.id,
                        date: preuve.horodatage,
                        utilisateur: authEmail || 'Administrateur',
                        type: 'Capture caméra espion',
                        detail: `Capture manuelle - session de ${preuve.dureeSession}s`,
                        preuveImage: preuve.image
                      }));
                    }}
                  />
                </>
              )}
            </div>

            {/* ============ CAPTEURS DE L'APPAREIL ============ */}
            <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, color: '#0284c7', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="capteurs" taille={15} /> Capteurs de l'appareil</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={capteursActifs ? arreterCapteurs : demarrerCapteurs}
                    style={{ backgroundColor: capteursActifs ? '#dc2626' : '#16a34a', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {capteursActifs ? <><Icone nom="fermer" taille={14} /> Arrêter les capteurs</> : <><Icone nom="activite" taille={14} /> Activer les capteurs</>}
                  </button>
                </div>
              </div>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '6px 0 10px 0' }}>
                Exploite tous les capteurs disponibles de l'appareil (mouvement, orientation, luminosité, magnétomètre, proximité, batterie, réseau). Sur iPhone/iPad, l'autorisation est demandée au premier clic.
              </p>

              {/* Aperçu : ce que l'appareil peut fournir, même capteurs éteints. */}
              {!capteursActifs && (() => {
                const dispo = capteursDisponibles();
                const noms = {
                  mouvement: 'Mouvement',
                  orientation: 'Orientation',
                  luminosite: 'Luminosité',
                  magnetometre: 'Magnétomètre',
                  proximite: 'Proximité',
                  batterie: 'Batterie',
                  reseau: 'Réseau',
                  gps: 'GPS'
                };
                return (
                  <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#475569' }}>
                    <strong>Capteurs détectés sur cet appareil :</strong>{' '}
                    {Object.entries(dispo).filter(([, ok]) => ok).map(([cle]) => noms[cle]).join(', ') || 'aucun'}
                  </p>
                );
              })()}

              {!capteursActifs ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#b45309', fontWeight: 'bold' }}>
                  <Icone nom="fermer" taille={12} style={{ marginRight: '4px' }} /> Capteurs désactivés.
                </p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f0f9ff', border: '1px solid #e0f2fe' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}><Icone nom="batterie" taille={12} /> Batterie</span>
                      <strong style={{ fontSize: '13px', color: '#0284c7' }}>
                        {etatCapteurs.batterie ? `${etatCapteurs.batterie.niveau} %${etatCapteurs.batterie.enCharge ? ' (en charge)' : ''}` : 'Non disponible'}
                      </strong>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}><Icone nom="monde" taille={12} /> Réseau</span>
                      <strong style={{ fontSize: '13px', color: '#16a34a' }}>
                        {etatCapteurs.reseau ? `${etatCapteurs.reseau.enLigne ? 'En ligne' : 'Hors ligne'} · ${etatCapteurs.reseau.type}${etatCapteurs.reseau.debitMbps ? ` · ${etatCapteurs.reseau.debitMbps} Mbps` : ''}` : 'Non disponible'}
                      </strong>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#fefce8', border: '1px solid #fef9c3' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}><Icone nom="luminosite" taille={12} /> Luminosité</span>
                      <strong style={{ fontSize: '13px', color: '#ca8a04' }}>
                        {etatCapteurs.luminosite ? `${Math.round(etatCapteurs.luminosite.lux)} lux` : 'Non disponible'}
                      </strong>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f5f3ff', border: '1px solid #ede9fe' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}><Icone nom="orientation" taille={12} /> Orientation</span>
                      <strong style={{ fontSize: '13px', color: '#7c3aed' }}>
                        {etatCapteurs.orientation ? `${Math.round(etatCapteurs.orientation.beta)}° / ${Math.round(etatCapteurs.orientation.gamma)}°` : 'Non disponible'}
                      </strong>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}><Icone nom="mouvement" taille={12} /> Mouvement</span>
                      <strong style={{ fontSize: '13px', color: '#334155' }}>
                        {etatCapteurs.mouvement ? `Intensité ${Math.round(etatCapteurs.mouvement.intensite)}` : 'Non disponible'}
                      </strong>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}><Icone nom="magnetometre" taille={12} /> Magnétomètre</span>
                      <strong style={{ fontSize: '13px', color: '#334155' }}>
                        {etatCapteurs.magnetometre ? `x ${Math.round(etatCapteurs.magnetometre.x)}` : 'Non disponible'}
                      </strong>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}><Icone nom="proximite" taille={12} /> Proximité</span>
                      <strong style={{ fontSize: '13px', color: '#334155' }}>
                        {etatCapteurs.proximite ? (etatCapteurs.proximite.pres ? 'Proche' : 'Éloigné') : 'Non disponible'}
                      </strong>
                    </div>
                  </div>

                  {derniereAlerteCapteur && (
                    <p role="alert" style={{ margin: '10px 0 0', fontSize: '12px', color: '#b45309', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icone nom="avertissement" taille={14} /> Dernière alerte : {derniereAlerteCapteur}
                    </p>
                  )}

                  <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
                    <strong>Capteurs actifs :</strong> {capteursSupportes.join(', ') || 'aucun'}
                    {capteursNonSupportes.length > 0 && (
                      <>
                        {' · '}
                        <strong>Non disponibles sur cet appareil :</strong> {capteursNonSupportes.join(', ')}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={{ backgroundColor: '#fff', padding: '8px 10px', borderRadius: '7px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 4px 0', color: '#0284c7', fontSize: '13px' }}>Surveillance des accès</h3>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 6px 0' }}>
                Les tentatives de connexion échouées sont journalisées. Cliquez sur une preuve pour l’agrandir.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const detail = await demander('Décrivez l’incident à enregistrer.', { titre: 'Incident manuel' });
                  if (detail) setSecurityEvents(events => ajouterEvenementSecurite(events, { id: Date.now(), utilisateur: authEmail || 'Utilisateur inconnu', type: 'Incident manuel', detail: detail.slice(0, 1000) }));
                }}
                style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '5px 10px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Enregistrer un incident
              </button>
            </div>

            {utilisateurCourant?.role === 'Administrateur' && (
              <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '7px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 4px 0', color: '#0284c7', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="tresorerie" taille={15} /> Contrôle d’accès au module Dépenses</h3>
                <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 8px 0' }}>
                  Par défaut, toute tentative d’accès/modification des dépenses par un utilisateur non administrateur
                  déclenche une capture caméra et une alerte. Vous pouvez accorder une autorisation pour cette session.
                </p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: autorisationDepenses ? '#16a34a' : '#b45309', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {autorisationDepenses ? <><Icone nom="succes" taille={14} /> Autorisation accordée</> : <><Icone nom="verrou" taille={14} /> Aucune autorisation active</>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAutorisationDepenses(v => !v)}
                    style={{ backgroundColor: autorisationDepenses ? '#94a3b8' : '#16a34a', color: 'white', border: 'none', padding: '5px 10px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {autorisationDepenses ? 'Révoquer l’autorisation' : 'Accorder l’autorisation'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflowX: 'auto', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '10px' }}>Date</th>
                    <th style={{ padding: '10px' }}>Utilisateur</th>
                    <th style={{ padding: '10px' }}>Type</th>
                    <th style={{ padding: '10px' }}>Détail</th>
                    <th style={{ padding: '10px' }}>Niveau</th>
                    <th style={{ padding: '10px' }}>Preuve</th>
                    <th style={{ padding: '10px' }}>Statut</th>
                    <th style={{ padding: '10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {securityEvents.length === 0 ? (
                    <tr><td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Aucun incident enregistré.</td></tr>
                  ) : securityEvents.map(event => (
                    <tr key={event.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px' }}>{event.date}</td>
                      <td style={{ padding: '10px' }}>{event.utilisateur}</td>
                      <td style={{ padding: '10px' }}>{event.type}</td>
                      <td style={{ padding: '10px' }}>{event.detail}</td>
                      <td style={{ padding: '10px', color: event.niveau === 'Critique' ? '#dc2626' : '#eab308', fontWeight: 'bold' }}>{event.niveau}</td>
                      <td style={{ padding: '10px' }}>
                        {event.preuveImage ? (
                          <button
                            type="button"
                            onClick={() => setSelectedEventId(event.id)}
                            title="Cliquer pour agrandir la preuve"
                            style={{ padding: 0, border: '1px solid #cbd5e1', borderRadius: '4px', background: 'none', cursor: 'zoom-in', display: 'inline-block' }}
                          >
                            <img src={event.preuveImage} alt="Preuve incident" style={{ width: '55px', height: '40px', objectFit: 'cover', borderRadius: '4px', display: 'block' }} />
                          </button>
                        ) : 'Non disponible'}
                      </td>
                      <td style={{ padding: '10px' }}>{event.statut}</td>
                      <td style={{ padding: '10px', display: 'flex', gap: '5px' }}>
                        <button type="button" onClick={() => setSelectedEventId(event.id)} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                          Résumé
                        </button>
                        {event.statut !== 'Traité' && (
                          <button type="button" onClick={() => setSecurityEvents(events => events.map(item => item.id === event.id ? { ...item, statut: 'Traité' } : item))} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                            Marquer traité
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedEventId && (() => { const event = securityEvents.find(item => item.id === selectedEventId); if (!event) return null; return (
              <div className="modal-overlay">
                <div className="modal-card">
                  <button type="button" className="modal-close" aria-label="Fermer" onClick={() => setSelectedEventId(null)}><Icone nom="fermer" taille={16} /></button>
                  <h3 style={{ marginTop: 0, color: '#dc2626' }}>Résumé de l’incident</h3>
                  <ul style={{ fontSize: '13px', color: '#334155', lineHeight: '1.7', paddingLeft: '18px' }}>
                    <li><strong>Date :</strong> {event.date}</li>
                    <li><strong>Utilisateur :</strong> {event.utilisateur}</li>
                    <li><strong>Type :</strong> {event.type}</li>
                    <li><strong>Détail :</strong> {event.detail}</li>
                    <li><strong>Niveau :</strong> {event.niveau}</li>
                    <li><strong>Statut :</strong> {event.statut}</li>
                  </ul>
                  {event.preuveImage && <img src={event.preuveImage} alt="Preuve agrandie" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0' }} />}
                  <button type="button" onClick={() => setSelectedEventId(null)} style={{ marginTop: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '7px 14px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer' }}>Fermer</button>
                </div>
              </div>
            ); })()}

            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, color: '#0284c7' }}>Verrouillage d’urgence des comptes</h3>
              {usersList.map(user => (
                <div key={user._id || user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span>{user.nom} ({user.role}) — {user.actif === false ? 'Compte désactivé' : 'Compte actif'}</span>
                  {currentUserRole === 'Administrateur' && <button type="button" onClick={() => handleDeleteUser(user._id || user.id)} disabled={user.actif === false} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '7px 10px', borderRadius: '5px', cursor: 'pointer' }}>Désactiver</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 15. CAHIER DE NOTES */}
        {activeTab === 'notes' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.notes}</h2>
            <form onSubmit={handleSaveNote} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>Ajouter une note rapide</h3>
              <input type="text" placeholder="Titre de la note" value={noteForm.titre} onChange={e => setNoteForm({ ...noteForm, titre: e.target.value })} required style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <textarea placeholder="Contenu de la note..." value={noteForm.contenu} onChange={e => setNoteForm({ ...noteForm, contenu: e.target.value })} required style={{ width: '100%', padding: '10px', height: '80px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Enregistrer la note</button>
            </form>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px' }}>
              {notesList.map(n => (
                <div key={n.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{n.date}</span>
                  <h4 style={{ margin: '5px 0 10px 0', color: '#0f172a' }}>{n.titre}</h4>
                  <p style={{ color: '#475569', fontSize: '13px', margin: '0 0 15px 0' }}>{n.contenu}</p>
                  <button onClick={() => handleDeleteNote(n.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Supprimer</button>
                </div>
              ))}
            </div>
          </div>
        )}

    {activeTab === 'versions' && (
  <div className="versions-page">
    <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.versions}</h2>

    <div className="versions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
      <div className="versions-card" style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div className="versions-card-heading">
          <span className="versions-step-pill">ÉTAPE 1</span>
          <span className="versions-platform-pill versions-platform-pill--pc">Ordinateur</span>
        </div>
        <h3 style={{ color: '#0284c7', marginTop: 0 }}>Version PC</h3>
        <ul style={{ paddingLeft: '18px', color: '#334155', lineHeight: '1.8' }}>
          <li>Interface web : accessible via navigateur, pratique pour les administrateurs et responsables.</li>
          <li>Gestion multi-modules : Catalogue, Mouvements, Inventaire, Alertes, Rapports, Administration.</li>
        </ul>
      </div>

      <div className="versions-card" style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div className="versions-card-heading">
          <span className="versions-step-pill">ÉTAPE 2</span>
          <span className="versions-platform-pill versions-platform-pill--mobile">Téléphone</span>
        </div>
        <h3 style={{ color: '#0284c7', marginTop: 0 }}>Version Mobile</h3>
        <ul style={{ paddingLeft: '18px', color: '#334155', lineHeight: '1.8' }}>
          <li>Application mobile : Android/iOS, adaptée aux magasiniers et vendeurs.</li>
          <li>Scanner QR/barres : pour enregistrer entrées/sorties rapidement.</li>
          <li>Inventaire en temps réel : possibilité de compter directement depuis le smartphone.</li>
        </ul>
      </div>

      <div className="versions-card" style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div className="versions-card-heading">
          <span className="versions-step-pill">ÉTAPE 3</span>
          <span className="versions-platform-pill versions-platform-pill--sync">Synchronisation</span>
        </div>
        <h3 style={{ color: '#0284c7', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Icone nom="versions" taille={17} /> Synchronisation PC / Téléphone</h3>
        <ul style={{ paddingLeft: '18px', color: '#334155', lineHeight: '1.8' }}>
          <li>Base de données centralisée : tous les appareils se connectent au même serveur.</li>
          <li>Cloud et API : synchronisation automatique entre web et mobile.</li>
          <li>Avantage : cohérence des données, pas de doublons, accès partout.</li>
        </ul>
      </div>

      <div className="versions-card" style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div className="versions-card-heading">
          <span className="versions-step-pill">ÉTAPE 4</span>
          <span className="versions-platform-pill versions-platform-pill--advanced">Modules</span>
        </div>
        <h3 style={{ color: '#0284c7', marginTop: 0 }}>Modules avancés</h3>
        <ul style={{ paddingLeft: '18px', color: '#334155', lineHeight: '1.8' }}>
          <li>Facturation et caisse : relier ventes et stock.</li>
          <li>CRM clients : suivi des clients et fidélisation.</li>
          <li>E-commerce intégré : connecter stock à une boutique en ligne.</li>
        </ul>
      </div>
    </div>
  </div>
)}


        {/* 16. PARAMÈTRES GÉNÉRAUX — Administration & Géographie (sous-onglets) */}
        {activeTab === 'parametresGeneraux' && (
          <div>
          <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '9px' }}><Icone nom="parametres" taille={22} /> Paramètres Généraux</h2>

          {/* Barre de sous-onglets : Administration | Géographie. */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px' }}>
            <button
              type="button"
              onClick={() => setSousOngletParametres('administration')}
              style={{
                padding: '9px 18px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px',
                backgroundColor: sousOngletParametres === 'administration' ? '#0284c7' : '#e2e8f0',
                color: sousOngletParametres === 'administration' ? 'white' : '#334155'
              }}
            >
              <Icone nom="parametres" taille={15} /> Administration
            </button>
            <button
              type="button"
              onClick={() => setSousOngletParametres('geographie')}
              style={{
                padding: '9px 18px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px',
                backgroundColor: sousOngletParametres === 'geographie' ? '#0284c7' : '#e2e8f0',
                color: sousOngletParametres === 'geographie' ? 'white' : '#334155'
              }}
            >
              <Icone nom="monde" taille={15} /> Géographie
            </button>
          </div>

          {sousOngletParametres === 'administration' && (
          <div>
          <h3 style={{ fontSize: '15px', color: '#0284c7', marginTop: 0 }}>{t.config}</h3>

          <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', margin: '0 0 6px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="annonce" taille={15} /> Panneau publicitaire du tableau de bord</h3>
              {currentUserRole !== 'Administrateur' ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Icone nom="verrou" taille={13} /> Accès réservé aux administrateurs.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={publicite.actif} onChange={e => setPublicite({ ...publicite, actif: e.target.checked })} /> Activer la bannière
                  </label>
                  <input type="text" placeholder="Titre" value={publicite.titre} onChange={e => setPublicite({ ...publicite, titre: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} />
                  <input type="text" placeholder="Message" value={publicite.message} onChange={e => setPublicite({ ...publicite, message: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} />
                  <input type="color" title="Couleur de la bannière" value={publicite.couleur} onChange={e => setPublicite({ ...publicite, couleur: e.target.value })} style={{ height: '28px', width: '60px', border: 'none', cursor: 'pointer' }} />
                  <input type="url" placeholder="Lien (optionnel)" value={publicite.lien} onChange={e => setPublicite({ ...publicite, lien: e.target.value })} style={{ padding: '5px 6px', fontSize: '12px' }} />
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', margin: '0 0 6px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="abonnements" taille={15} /> Niveau d'abonnement ({palierActif?.libelle})</h3>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: aAccesAvance ? '#16a34a' : '#b45309', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {aAccesAvance
                  ? <><Icone nom="succes" taille={13} /> Accès complet : fonctionnalités avancées débloquées.</>
                  : <><Icone nom="verrou" taille={13} /> Modules avancés verrouillés (Sécurité, Comptabilité, Rapports KPI, Multi-dépôts).</>}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px', alignItems: 'center' }}>
                <select value={subscriptionLevel} onChange={e => setSubscriptionLevel(e.target.value)} style={{ padding: '5px 6px', fontSize: '12px' }}>
                  <option value="Essai">Essai gratuit — 3 jours</option>
                  <option value="Standard">Standard / Boutique — 10 000 FCFA</option>
                  <option value="Pro">Professionnel / ERP — 25 000 FCFA</option>
                  <option value="Enterprise">Enterprise / Master — 45 000 FCFA</option>
                </select>
                <button type="button" onClick={() => setActiveTab('abonnements')} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Choisir un palier</button>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Comptes configurés : {usersList.length}</span>
              </div>
            </div>

            {invitationCompte && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '8px', marginBottom: '15px' }}>
                <strong style={{ color: '#15803d', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="succes" taille={15} /> Compte créé — transmettez ces informations à {invitationCompte.nom}</strong>
                <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: 'bold', color: invitationCompte.mailEnvoye ? '#16a34a' : '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {invitationCompte.mailEnvoye
                    ? <><Icone nom="email" taille={14} /> Demande d’envoi acceptée par le fournisseur ; vérifiez la livraison dans la boîte ou le dossier spam.</>
                    : <><Icone nom="avertissement" taille={14} /> Email non envoyé : transmettez le lien ci-dessous manuellement.</>}
                </p>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#166534' }}>Identifiant : <strong>{invitationCompte.email}</strong> · Rôle : <strong>{invitationCompte.role}</strong></p>
                {!invitationCompte.mailEnvoye && <p style={{ margin: '4px 0', fontSize: '12px', color: '#166534' }}>L’utilisateur est créé. Le message de connexion n’a pas été envoyé ; utilisez le bouton de renvoi une fois le service d’envoi d’e-mails disponible.</p>}
                <button type="button" onClick={() => setInvitationCompte(null)} style={{ marginTop: '6px', backgroundColor: '#15803d', color: '#fff', border: 'none', padding: '5px 10px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer' }}>Masquer</button>
              </div>
            )}

            {isSubscribed ? (
            <>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Icone nom="parametres" taille={17} /> Informations de votre entreprise</h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>Ces informations figurent obligatoirement sur vos factures et reçus, conformément à la réglementation fiscale ivoirienne.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <input type="text" placeholder="Nom de l’entreprise" aria-label="Nom de l'entreprise" value={storeInfo.nomMagasin} onChange={e => setStoreInfo({ ...storeInfo, nomMagasin: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="Adresse" aria-label="Adresse" value={storeInfo.adresse} onChange={e => setStoreInfo({ ...storeInfo, adresse: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="Ville" aria-label="Ville" value={storeInfo.ville || ''} onChange={e => setStoreInfo({ ...storeInfo, ville: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="Pays" aria-label="Pays" value={storeInfo.pays || "Côte d'Ivoire"} onChange={e => setStoreInfo({ ...storeInfo, pays: e.target.value })} style={{ padding: '8px' }} />
                <input type="tel" placeholder="Téléphone" aria-label="Téléphone" value={storeInfo.telephone} onChange={e => setStoreInfo({ ...storeInfo, telephone: e.target.value })} style={{ padding: '8px' }} />
                <input type="email" placeholder="Email professionnel" aria-label="Email professionnel" value={storeInfo.email} onChange={e => setStoreInfo({ ...storeInfo, email: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="RCCM (ex. CI-ABJ-2026-B-12345)" aria-label="Numéro RCCM" value={storeInfo.rccm} onChange={e => setStoreInfo({ ...storeInfo, rccm: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="NCC — Numéro de Compte Contribuable" aria-label="Numéro de Compte Contribuable" value={storeInfo.ncc || ''} onChange={e => setStoreInfo({ ...storeInfo, ncc: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="Capital social (facultatif)" aria-label="Capital social" value={storeInfo.capitalSocial || ''} onChange={e => setStoreInfo({ ...storeInfo, capitalSocial: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="Slogan" aria-label="Slogan" value={storeInfo.motto} onChange={e => setStoreInfo({ ...storeInfo, motto: e.target.value })} style={{ padding: '8px' }} />
                <div>
                  <label htmlFor="regime-fiscal" style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '3px' }}>Régime d’imposition (DGI)</label>
                  <select id="regime-fiscal" value={storeInfo.regimeFiscal || 'Réel Normal'} onChange={e => setStoreInfo({ ...storeInfo, regimeFiscal: e.target.value })} style={{ padding: '8px', width: '100%' }}>
                    {REGIMES_FISCAUX_CI.map(regime => <option key={regime} value={regime}>{regime}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="tva-defaut" style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '3px' }}>Taux de TVA par défaut</label>
                  <select id="tva-defaut" value={Number(entrepriseCourante?.tauxTva ?? 18)} onChange={e => setEntrepriseCourante(prev => ({ ...(prev || {}), tauxTva: Number(e.target.value) }))} style={{ padding: '8px', width: '100%' }}>
                    {TAUX_TVA_CI.map(taux => <option key={taux.valeur} value={taux.valeur}>{taux.libelle}</option>)}
                  </select>
                </div>
              </div>

              {/* Indicateur de conformité des mentions obligatoires */}
              {(() => {
                const manquants = verifierConformite(storeInfo);
                return manquants.length === 0 ? (
                  <p role="status" style={{ marginTop: '12px', fontSize: '12px', color: '#16a34a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icone nom="succes" taille={14} /> Vos mentions légales sont complètes : vos factures sont conformes.
                  </p>
                ) : (
                  <p role="alert" style={{ marginTop: '12px', fontSize: '12px', color: '#b45309', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icone nom="avertissement" taille={14} /> Mentions manquantes pour la conformité de vos factures : {manquants.join(', ')}.
                  </p>
                );
              })()}
            </div>

            {/* ============ MOYENS DE PAIEMENT DU COMMERÇANT ============
                Ces références reçoivent l'argent de VOS VENTES. Elles sont
                propres à votre compte et distinctes du compte qui encaisse
                les abonnements (celui de l'éditeur de l'application). */}
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Icone nom="paiements" taille={17} /> Moyens de paiement du commerçant (paiement de vos ventes)</h3>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: 0 }}>
                Renseignez vos propres références : elles reçoivent l’argent de vos ventes. Ce compte est <strong>totalement distinct</strong> de celui qui encaisse les abonnements de la plateforme.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <div>
                  <label htmlFor="pay-benef" style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '3px' }}>Nom du bénéficiaire</label>
                  <input id="pay-benef" type="text" placeholder="Ex. Quincaillerie Katiénéfohoua" value={paiementCommercant.nomBeneficiaire} onChange={e => setPaiementCommercant({ ...paiementCommercant, nomBeneficiaire: e.target.value })} style={{ padding: '8px', width: '100%' }} />
                </div>
                <div>
                  <label htmlFor="pay-kkiapay" style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '3px' }}>Clé publique Kkiapay (carte en ligne)</label>
                  <input id="pay-kkiapay" type="text" placeholder="Clé Kkiapay de votre entreprise" value={paiementCommercant.kkiapayClePublique} onChange={e => setPaiementCommercant({ ...paiementCommercant, kkiapayClePublique: e.target.value })} style={{ padding: '8px', width: '100%' }} />
                </div>
              </div>

              <h4 style={{ color: '#0f172a', fontSize: '13px', margin: '16px 0 8px' }}>Mobile Money</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <input type="tel" placeholder="Orange Money" aria-label="Orange Money" value={paiementCommercant.mobileMoney?.orange || ''} onChange={e => setPaiementCommercant({ ...paiementCommercant, mobileMoney: { ...paiementCommercant.mobileMoney, orange: e.target.value } })} style={{ padding: '8px' }} />
                <input type="tel" placeholder="MTN MoMo" aria-label="MTN MoMo" value={paiementCommercant.mobileMoney?.mtn || ''} onChange={e => setPaiementCommercant({ ...paiementCommercant, mobileMoney: { ...paiementCommercant.mobileMoney, mtn: e.target.value } })} style={{ padding: '8px' }} />
                <input type="tel" placeholder="Moov Money" aria-label="Moov Money" value={paiementCommercant.mobileMoney?.moov || ''} onChange={e => setPaiementCommercant({ ...paiementCommercant, mobileMoney: { ...paiementCommercant.mobileMoney, moov: e.target.value } })} style={{ padding: '8px' }} />
                <input type="tel" placeholder="Wave" aria-label="Wave" value={paiementCommercant.mobileMoney?.wave || ''} onChange={e => setPaiementCommercant({ ...paiementCommercant, mobileMoney: { ...paiementCommercant.mobileMoney, wave: e.target.value } })} style={{ padding: '8px' }} />
              </div>

              <h4 style={{ color: '#0f172a', fontSize: '13px', margin: '16px 0 8px' }}>Compte bancaire (facultatif)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <input type="text" placeholder="Nom de la banque" aria-label="Nom de la banque" value={paiementCommercant.banque?.nom || ''} onChange={e => setPaiementCommercant({ ...paiementCommercant, banque: { ...paiementCommercant.banque, nom: e.target.value } })} style={{ padding: '8px' }} />
                <input type="text" placeholder="IBAN / Numéro de compte" aria-label="IBAN" value={paiementCommercant.banque?.iban || ''} onChange={e => setPaiementCommercant({ ...paiementCommercant, banque: { ...paiementCommercant.banque, iban: e.target.value } })} style={{ padding: '8px' }} />
                <input type="text" placeholder="SWIFT / BIC" aria-label="SWIFT" value={paiementCommercant.banque?.swift || ''} onChange={e => setPaiementCommercant({ ...paiementCommercant, banque: { ...paiementCommercant.banque, swift: e.target.value } })} style={{ padding: '8px' }} />
              </div>

              <div style={{ marginTop: '14px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={paiementCommercant.accepterEspeces} onChange={e => setPaiementCommercant({ ...paiementCommercant, accepterEspeces: e.target.checked })} /> Espèces
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={paiementCommercant.accepterMobileMoney} onChange={e => setPaiementCommercant({ ...paiementCommercant, accepterMobileMoney: e.target.checked })} /> Mobile Money
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={paiementCommercant.accepterCarteEnLigne} onChange={e => setPaiementCommercant({ ...paiementCommercant, accepterCarteEnLigne: e.target.checked })} /> Carte bancaire en ligne (Kkiapay)
                </label>
              </div>

              <textarea placeholder="Instructions de paiement affichées au client (facultatif)" aria-label="Instructions de paiement" value={paiementCommercant.instructions || ''} onChange={e => setPaiementCommercant({ ...paiementCommercant, instructions: e.target.value })} rows={2} style={{ width: '100%', marginTop: '12px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }} />

              {/* Indicateur de conformité des références de paiement */}
              {(() => {
                const manquants = verifierReferencesCommercant(paiementCommercant);
                return manquants.length === 0 ? (
                  <p role="status" style={{ marginTop: '12px', fontSize: '12px', color: '#16a34a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icone nom="succes" taille={14} /> Vos moyens de paiement sont renseignés. Moyens actifs : {resumerPaiementsCommercant(paiementCommercant).join(' · ')}
                  </p>
                ) : (
                  <p role="alert" style={{ marginTop: '12px', fontSize: '12px', color: '#b45309', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icone nom="avertissement" taille={14} /> À compléter pour recevoir vos paiements : {manquants.join(', ')}.
                  </p>
                );
              })()}
            </div>

            {/* Rappel : le compte qui encaisse les abonnements appartient à l'éditeur. */}
            <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
              <strong style={{ color: '#0369a1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="info" taille={15} /> À propos des deux comptes de paiement</strong>
              <p style={{ color: '#0c4a6e', fontSize: '12px', margin: '6px 0 0' }}>
                Les paiements de <strong>vos ventes</strong> sont encaissés sur <strong>vos propres références</strong> ci-dessus.
                L’<strong>abonnement</strong> que vous payez pour utiliser SKYS ERP Solution est, lui, encaissé par l’éditeur de la plateforme
                ({COMPTE_DEVELOPPEUR.operateur}) sur un compte totalement séparé, que vous ne voyez ni ne modifiez.
              </p>
            </div>
            </>
          ) : (
            <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              <strong style={{ color: '#c2410c' }}>Personnalisation disponible après abonnement</strong>
              <p style={{ color: '#7c2d12', fontSize: '13px', margin: '6px 0 10px' }}>Abonnez-vous pour renseigner les informations de votre entreprise et personnaliser SKYS ERP Solution.</p>
              <button type="button" onClick={() => setActiveTab('abonnements')} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Voir les abonnements</button>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '15px 0' }}>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={e => setNotificationsEnabled(e.target.checked)}
              />
              Activer les notifications et les messages de mise à jour
            </label>

            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '10px', marginBottom: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Icone nom="utilisateurs" taille={17} /> Gestion des Comptes & Attribution des Rôles</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>La création et la désactivation des comptes sont envoyées à l’API et réservées à l’administrateur authentifié.</p>
              <button type="button" onClick={async () => {
                setChargementUtilisateurs(true);
                setErreurChargementUtilisateurs('');
                try {
                  const liste = await listerUtilisateursApi();
                  setUsersList(Array.isArray(liste) ? liste : []);
                } catch (error) {
                  setErreurChargementUtilisateurs(messageErreur(error));
                } finally {
                  setChargementUtilisateurs(false);
                }
              }} disabled={chargementUtilisateurs} style={{ marginBottom: 12, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 10px', cursor: chargementUtilisateurs ? 'wait' : 'pointer' }}>
                {chargementUtilisateurs ? 'Actualisation…' : 'Actualiser la liste'}
              </button>
              <form onSubmit={handleUserSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <input type="text" placeholder="Nom de l'utilisateur" value={userForm.nom} onChange={e => setUserForm({ ...userForm, nom: e.target.value })} required style={{ padding: '8px' }} />
                <input type="email" placeholder="Email / Identifiant" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required style={{ padding: '8px' }} />
                <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} style={{ padding: '8px' }}>
                  <option value="Administrateur">Administrateur (Accès Total)</option>
                  <option value="Caissier">Caissier (Caisse & Ventes)</option>
                  <option value="Magasinier">Magasinier (Stocks & Mouvements)</option>
                </select>
                <input type="password" placeholder="Mot de passe (vide = généré automatiquement)" value={userForm.motDePasse} onChange={e => setUserForm({ ...userForm, motDePasse: e.target.value })} minLength={12} maxLength={256} autoComplete="new-password" style={{ padding: '8px' }} />
                <p style={{ margin: 0, color: '#64748b', fontSize: '12px', gridColumn: '1 / -1' }}>
                  Laissez le mot de passe vide pour en générer un automatiquement. L’employé devra le remplacer à sa première connexion.
                </p>
                <div style={{ display: 'flex', gap: '10px', gridColumn: '1 / -1' }}>
                  <button type="submit" disabled={chargementUtilisateurs || !isAuthenticated || utilisateurCourant?.role !== 'Administrateur'} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{chargementUtilisateurs ? 'Chargement…' : 'Créer le compte'}</button>
                </div>
              </form>

              {erreurChargementUtilisateurs && (
                <p role="alert" style={{ margin: '0 0 12px', color: '#b45309', fontSize: '13px' }}>
                  Impossible de charger la liste depuis le serveur : {erreurChargementUtilisateurs}
                </p>
              )}
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                      <th style={{ padding: '10px' }}>Nom</th>
                      <th style={{ padding: '10px' }}>Email / Login</th>
                      <th style={{ padding: '10px' }}>Rôle Attribué</th>
                      <th style={{ padding: '10px' }}>État du code</th>
                      <th style={{ padding: '10px' }}>Sécurité</th>
                      <th style={{ padding: '10px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.length === 0 ? <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>{chargementUtilisateurs ? 'Chargement des comptes…' : 'Aucun compte à afficher.'}</td></tr> : usersList.map(u => (
                      <tr key={u._id || u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{u.nom}</td>
                        <td style={{ padding: '10px' }}>{u.email}</td>
                        <td style={{ padding: '10px', color: '#0284c7', fontWeight: 'bold' }}>{u.role}</td>
                        <td style={{ padding: '10px', color: u.forcePasswordChange ? '#eab308' : '#16a34a', fontWeight: 'bold' }}>{u.forcePasswordChange ? 'Code initial à remplacer' : 'Code personnalisé'}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: u.bloqueReinitialisation ? '#dc2626' : '#16a34a' }}>
                          {u.bloqueReinitialisation
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="verrou" taille={13} /> Bloqué ({u.reinitialisations || 0} réinit.)</span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Icone nom="succes" taille={13} /> OK ({u.reinitialisations || 0} réinit.)</span>}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => handleDeleteUser(u._id || u.id)} disabled={u.actif === false} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Désactiver</button>
                            {u.bloqueReinitialisation && (
                              <>
                                <button type="button" onClick={() => handleDebloquerUser(u._id || u.id, 'debloquer')} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Débloquer</button>
                                <button type="button" onClick={() => handleDebloquerUser(u._id || u.id, 'laisser')} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Laisser bloqué</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <button
                  type="button"
                  onClick={() => setOpenSubMenus(current => ({ ...current, apparence: !(current.apparence ?? true) }))}
                  aria-expanded={openSubMenus.apparence ?? true}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, color: '#0284c7', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', textAlign: 'left' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Icone nom="apparence" taille={15} /> Apparence & En-têtes</span>
                  <span>{(openSubMenus.apparence ?? true) ? '▾' : '▸'}</span>
                </button>

                {(openSubMenus.apparence ?? true) && <div style={{ marginTop: '15px' }}>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Couleur de fond de l'application :</label>
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: '60px', height: '40px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Police d'écriture :</label>
                  <select value={headerConfig.policeEnTete} onChange={e => setHeaderConfig({ ...headerConfig, policeEnTete: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                    <option value="Segoe UI">Segoe UI</option>
                    <option value="Arial">Arial</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Tahoma">Tahoma</option>
                    <option value="Trebuchet MS">Trebuchet MS</option>
                    <option value="Georgia">Georgia</option>
                    <option value="system-ui">System UI</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Taille globale des écritures :</label>

                  <select
                    value={headerConfig.tailleTexteGlobal}
                    onChange={e => {
                      const taille = Number(e.target.value.replace('px', ''));
                      setHeaderConfig({
                        ...headerConfig,
                        tailleTexteGlobal: e.target.value,
                        tailleTitre: `${taille + 4}px`
                      });
                    }}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    <option value="16px">Grand (16 px)</option>
                    <option value="18px">Très grand (18 px)</option>
                    <option value="20px">Très grand (20 px)</option>
                    <option value="22px">Très grand (22 px)</option>
                    <option value="24px">Très grand (24 px)</option>
                    <option value="26px">Extra grand (26 px)</option>
                    <option value="28px">Extra grand (28 px)</option>
                    <option value="30px">Extra grand (30 px)</option>
                    <option value="32px">Extra grand (32 px)</option>
                  </select>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Verrouillage automatique par inactivité :</label>
                  <select
                    value={headerConfig.inactiviteMinutes || 10}
                    onChange={e => setHeaderConfig({ ...headerConfig, inactiviteMinutes: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    <option value="5">5 minutes</option>
                    <option value="6">6 minutes</option>
                    <option value="7">7 minutes</option>
                    <option value="8">8 minutes</option>
                    <option value="9">9 minutes</option>
                    <option value="10">10 minutes</option>
                  </select>
                  <small style={{ fontSize: '11px', color: '#64748b' }}>Après cette durée sans activité, la session se verrouille et revient à la connexion.</small>
                </div>
                </div>}
              </div>
            </div>

          {/* Accessibilité : adaptation aux handicaps visuels et auditifs */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ color: '#0284c7', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Icone nom="accessibilite" taille={17} /> Accessibilité</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: 0 }}>
              Adaptez l’application à votre besoin : malvoyance, cécité, surdité ou malentendance.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={prefsA11y.contrasteEleve} onChange={e => setPrefsA11y({ ...prefsA11y, contrasteEleve: e.target.checked })} />
                Contraste élevé (malvoyants)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={prefsA11y.texteAgrandi} onChange={e => setPrefsA11y({ ...prefsA11y, texteAgrandi: e.target.checked })} />
                Texte agrandi (+15 %)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  /* Marqueur lu par le moteur : cocher cette case démarre ou
                     arrête la lecture, elle ne doit donc pas déclencher en plus
                     la lecture « au clic » de l'application. */
                  data-a11y-voix="1"
                  checked={prefsA11y.annoncesVocales}
                  onChange={e => {
                    const actif = e.target.checked;
                    setPrefsA11y({ ...prefsA11y, annoncesVocales: actif });
                    if (actif) {
                      /* Lecture automatique : tout l'écran est lu dès l'activation. */
                      demarrerLectureAutoA11y(conteneurPrincipalRef.current);
                    } else {
                      arreterLectureAutoA11y();
                    }
                  }}
                />
                Annonces vocales (lecture à voix haute)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={prefsA11y.alertesVisuelles} onChange={e => setPrefsA11y({ ...prefsA11y, alertesVisuelles: e.target.checked })} />
                Alertes visuelles et vibration (sourds / malentendants)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={prefsA11y.soulignerLiens} onChange={e => setPrefsA11y({ ...prefsA11y, soulignerLiens: e.target.checked })} />
                Souligner les liens (repère visuel)
              </label>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const prefs = { ...prefsA11y, annoncesVocales: true };
                  setPrefsA11y(prefs);
                  demarrerLectureAutoA11y(conteneurPrincipalRef.current);
                  annoncerA11y('Test des annonces vocales. L’accessibilité est activée.', { priorite: 'assertive', parler: false });
                  if (prefs.alertesVisuelles) alerteVisuelleA11y('Test d’alerte visuelle');
                }}
                style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Tester les annonces et alertes
              </button>
              {/* Lecture intégrale du contenu affiché (malvoyants). */}
              <button
                type="button"
                onClick={() => {
                  const prefs = { ...prefsA11y, annoncesVocales: true };
                  setPrefsA11y(prefs);
                  demarrerLectureAutoA11y(conteneurPrincipalRef.current);
                  const ok = lirePageA11y({ cible: conteneurPrincipalRef.current });
                  if (!ok) annoncerA11y('Aucun contenu lisible détecté sur cet écran.', { priorite: 'polite', parler: false });
                }}
                style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' }}
              >
                <Icone nom="lecture" taille={14} /> Lire la page
              </button>
              <button
                type="button"
                onClick={() => arreterLectureAutoA11y()}
                style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' }}
              >
                <Icone nom="fermer" taille={14} /> Arrêter la lecture
              </button>
            </div>
          </div>

          {/* Personnalisation du reçu / facture */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ color: '#0284c7', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Icone nom="achats" taille={17} /> Personnalisation du Reçu / Facture</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Pied de page du reçu :</label>
                <input type="text" value={recuConfig.piedDePage} onChange={e => setRecuConfig({ ...recuConfig, piedDePage: e.target.value })} placeholder="Merci de votre confiance !" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Mention légale :</label>
                <input type="text" value={recuConfig.mentionLegale} onChange={e => setRecuConfig({ ...recuConfig, mentionLegale: e.target.value })} placeholder="Aucun échange sans ce reçu." style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Couleur d'accent :</label>
                <input type="color" value={recuConfig.couleur} onChange={e => setRecuConfig({ ...recuConfig, couleur: e.target.value })} style={{ width: '60px', height: '40px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                <label style={{ fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={recuConfig.afficherContact} onChange={e => setRecuConfig({ ...recuConfig, afficherContact: e.target.checked })} /> Afficher les coordonnées
                </label>
                <label style={{ fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={recuConfig.afficherRccm} onChange={e => setRecuConfig({ ...recuConfig, afficherRccm: e.target.checked })} /> Afficher le RCCM
                </label>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>
              Les informations du magasin (nom, adresse, téléphone, RCCM, slogan) se modifient ci-dessous dans « Paramètres Généraux ».
            </p>
          </div>

          {/* AJOUT : Paramètres Généraux, Multi-dépôts & Droits des Utilisateurs */}
    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h3 style={{ color: '#0284c7', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Icone nom="monde" taille={17} /> Paramètres Généraux & Multi-dépôts</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '15px' }}>
     <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Langue :</label>
         <select
           value={lang}
           onChange={e => setLang(e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
   >
         <option value="FR">Français</option>
         <option value="EN">English</option>
         <option value="ES">Español</option>
      </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Devise :</label>
          <select value={paysActif} onChange={e => setPaysActif(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            {Object.keys(PAYS_DEVISES).map(p => <option key={p} value={p}>{p} ({PAYS_DEVISES[p].devise})</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Sélectionner le dépôt ou site actif :</label>
        <select value={depotActif} onChange={e => setDepotActif(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          {DEPOTS_LISTE.map(dep => <option key={dep} value={dep}>{dep}</option>)}
        </select>
      </div>

      <h4 style={{ color: '#0f172a', marginBottom: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}><Icone nom="utilisateurs" taille={14} /> Droits des Utilisateurs & Rôles</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
        <thead>
          <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
            <th style={{ padding: '3px 6px' }}>Nom</th>
            <th style={{ padding: '3px 6px' }}>Rôle / Accès</th>
            <th style={{ padding: '3px 6px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {usersList.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '2px 6px', fontWeight: 'bold' }}>{u.nom}</td>
              <td style={{ padding: '2px 6px', color: '#0284c7' }}>{u.role}</td>
              <td style={{ padding: '2px 6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteUser(u._id || u.id);
                  }}
                  style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '2px 7px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px', lineHeight: 1.2 }}
                >
                  <Icone nom="retirer" taille={12} /> Retirer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
          </div>
          )}
          </div>
        )}

        {activeTab === 'aide' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>
              {t.aide}
            </h2>

            <div
              style={{
                backgroundColor: '#fff',
                padding: '25px',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                lineHeight: '1.6',
                color: '#334155'
              }}
            >
              <h3 style={{ color: '#0284c7', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icone nom="guide" taille={17} /> Guide complet d'utilisation de SKYS ERP Solution
              </h3>

              <p>
                Bienvenue dans votre système de gestion intégré. Utilisez le menu
                « Catégories principales » pour ouvrir un module selon votre rôle.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '15px', marginTop: '20px' }}>
                <section>
                  <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>1. Accès et navigation</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>Connectez-vous avec votre email et votre code d’accès.</li>
                    <li>Un nouveau compte reçoit un code temporaire à remplacer lors de la première connexion.</li>
                    <li>Le menu affiche uniquement les modules autorisés pour votre rôle.</li>
                    <li>Déconnectez-vous toujours après avoir terminé votre session.</li>
                  </ul>
                </section>

                <section>
                  <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>2. Tableau de bord</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>Consultez le chiffre d’affaires, les dépenses et le bénéfice net.</li>
                    <li>Analysez la répartition du stock par famille.</li>
                    <li>Utilisez les alertes de stock pour lancer un réapprovisionnement.</li>
                  </ul>
                </section>

                <section>
                  <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>3. Catalogue et stock</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>Créez une fiche avec référence, désignation, fournisseur, prix et seuils.</li>
                    <li>Modifiez ou supprimez un article depuis le tableau du catalogue.</li>
                    <li>Utilisez Recherche rapide pour retrouver une référence ou un fournisseur.</li>
                    <li>Le dépôt actif est réglable dans Configuration.</li>
                  </ul>
                </section>

                <section>
                  <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>4. Caisse et transactions</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>Recherchez un article ou scannez sa référence avec le bouton caméra.</li>
                    <li>Ajoutez les articles au panier, vérifiez les quantités puis encaissez.</li>
                    <li>Choisissez le mode de paiement avant de valider la transaction.</li>
                    <li>Imprimez le reçu ou la facture depuis les actions de caisse.</li>
                  </ul>
                </section>

                <section>
                  <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>5. Mouvements, inventaire et achats</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>Enregistrez les entrées, sorties et motifs de mouvement.</li>
                    <li>Saisissez le comptage physique pour calculer les écarts.</li>
                    <li>Dans Stock Multi-dépôts, consultez et ajustez les quantités par site.</li>
                    <li>Activez le réapprovisionnement automatique au seuil minimum.</li>
                    <li>Dans Achats, créez une commande puis cliquez sur Réceptionner pour mettre le stock à jour.</li>
                  </ul>
                </section>

                <section>
                  <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>6. Clients, devis et transport</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>Enregistrez les coordonnées et la localisation des clients.</li>
                    <li>Créez un devis proforma, puis faites évoluer son statut.</li>
                    <li>Planifiez les livraisons avec responsable, véhicule, destination et frais.</li>
                  </ul>
                </section>

                <section>
                  <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>7. Paiements et justificatifs</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>Sélectionnez Espèces, Carte, MTN, Orange, Moov ou Wave.</li>
                    <li>Pour Mobile Money, choisissez l’opérateur puis générez le lien et le QR code.</li>
                    <li>Téléversez les photos et PDF dans Justificatifs & Pièces.</li>
                    <li>Ouvrez ou supprimez chaque fichier avec confirmation.</li>
                  </ul>
                </section>

                <section>
                  <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>8. Rapports et configuration</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>Comptabilité automatique regroupe recettes, dépenses, achats et résultat net.</li>
                    <li>Choisissez une période mensuelle, trimestrielle ou annuelle.</li>
                    <li>Utilisez Exporter CSV pour transmettre les indicateurs à la comptabilité.</li>
                    <li>Configurez la langue, la devise, le dépôt, les notifications et l’affichage.</li>
                  </ul>
                </section>

                <section>
                  <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>9. Rôles et sécurité</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>L’Administrateur gère les comptes, les paramètres et les incidents.</li>
                    <li>Le Caissier travaille sur les ventes, clients, devis et paiements.</li>
                    <li>Le Magasinier gère le catalogue, les mouvements, l’inventaire et les achats.</li>
                    <li>Les mots de passe doivent contenir 8 caractères, une majuscule, une minuscule et un chiffre.</li>
                    <li>Les activités suspectes sont journalisées et peuvent entraîner le verrouillage du compte.</li>
                  </ul>
                </section>
              </div>

              <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
                <h4 style={{ color: '#0284c7', margin: '0 0 8px' }}>En cas de problème</h4>
                <p style={{ margin: 0 }}>Vérifiez d’abord votre rôle, le dépôt actif, la connexion Internet et les permissions de caméra. Pour un compte verrouillé, seul un administrateur peut le déverrouiller. Les alertes email et WhatsApp nécessitent une configuration du backend.</p>
              </div>
            </div>
          </div>
        )}
      </main>
        <ChatbotAssistant
          contexte={{
            produits: products,
            clients,
            commandes: purchaseOrders,
            depenses: depensesList,
            transports,
            chiffreAffaires: caTotalEstime,
            charges: chargesPeriode,
            beneficeNet,
            role: currentUserRole
          }}
          nonLu={stockBasNonLues}
        />

        {/* Bouton d'accessibilité flottant : accès rapide aux réglages
            d'adaptation (contraste, taille, annonces) depuis tout module. */}
        <button
          type="button"
          onClick={() => { setSousOngletParametres('administration'); setActiveTab('parametresGeneraux'); }}
          aria-label="Ouvrir les réglages d'accessibilité"
          title="Accessibilité : contraste, taille, annonces vocales"
          style={{
            position: 'fixed',
            left: '18px',
            bottom: '18px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: '2px solid #fff',
            backgroundColor: prefsA11y.contrasteEleve ? '#facc15' : '#0284c7',
            color: prefsA11y.contrasteEleve ? '#000' : '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
            zIndex: 9999
          }}
        >
          <Icone nom="accessibilite" taille={20} />
        </button>

        {/* Surveillance globale — bouton VOLONTAIREMENT INVISIBLE.
            Accessible uniquement à l'administrateur disposant de l'option.
            Aucun élément visuel ne trahit sa présence : on l'active par un
            appui long (mobile) ou un double-clic (ordinateur) sur le coin
            inférieur droit de l'écran. */}
        <Surveillance
          utilisateurCourant={utilisateurCourant}
          aAccesCameraEspion={aAccesCameraEspion}
          surveillanceGlobaleOuverte={surveillanceGlobaleOuverte}
          setSurveillanceGlobaleOuverte={setSurveillanceGlobaleOuverte}
          authEmail={authEmail}
          setSecurityEvents={setSecurityEvents}
        />

        {/* Avertissement d'inactivité : la session va se verrouiller. */}
        {avertissementInactivite !== null && isAuthenticated && (
          <div className="modal-overlay">
            <div className="modal-card" style={{ textAlign: 'center', maxWidth: '380px' }}>
              <h3 style={{ marginTop: 0, color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}><Icone nom="mouvements" taille={17} /> Inactivité détectée</h3>
              <p style={{ fontSize: '13px', color: '#334155' }}>
                Aucune activité depuis un moment. Votre session sera verrouillée automatiquement
                dans <strong>{avertissementInactivite}s</strong> et vous reviendrez à la page de connexion.
              </p>
              <button
                type="button"
                onClick={() => setAvertissementInactivite(null)}
                style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Je reste connecté
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

export default App;
