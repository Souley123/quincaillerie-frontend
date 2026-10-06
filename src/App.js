import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import logoImage from './Assets/logo.png.jpeg';
import MontrePro from './components/MontrePro';
import CameraEspion from './components/CameraEspion';
import TresorerieEpargne from './components/TresorerieEpargne';
import { DISTRICTS_CI, VILLES_CI, STATS_GEO, trouverVille } from './data/geographie-ci';
import PasserellePaiement from './components/PasserellePaiement';
import { signerLienPaiement } from './utils/signaturePaiement';
import ChatbotAssistant from './components/ChatbotAssistant';
import useDonneesServeur from './hooks/useDonneesServeur';
import {
  connexion as apiConnexion,
  inscriptionEntreprise as apiInscription,
  moi as apiMoi,
  enregistrerSession,
  effacerSession,
  lireJeton,
  lireEntreprise,
  messageErreur
} from './services/api';

// 🌐 Dictionnaire des traductions
const translations = {
  FR: {
    title: "🏢 SKYS ERP Solution",
    stock: "🛠️ Gestion de Stock",
    mouvements: "Mouvements (Entrées / Sorties)",
    reappro: "  Réapprovisionnement Auto",
    transport: "🚚 Transport & Logistique",
    clients: "👤Clients & Contacts",
    dossiers: "Justificatifs & Pièces",
    paiements: "💳Moyens de Paiement",
    reports: "📊Rapports & Indicateurs KPI",
    config: "⚙️Administration et Paramétrage",
    recherche: "🔍Recherche Rapide",
    transaction: "💰 Caisse & Transactions",
    notes: "📝 Cahier de notes",
    depenses: "📉 Dépenses & Charges",
    devis: "📄 Devis & Proforma",
    dashboard: "📈 Tableau de Bord",
    inventaire: "📦Inventaire Physique",
    aide: "❓ Aide & Guide d'Utilisation",
    versions: "📱 Versions & Modules",
    lock: "🔒 Se Déconnecter",
    loginTitle: "🔒Connexion Sécurisée",
    registerTitle: "📝 Créer un Compte",
    loginSub: "Veuillez entrer vos identifiants pour accéder à l'application",
    registerSub: "Remplissez le formulaire pour créer votre compte",
    emailPlaceholder: "Adresse Email ou Login",
    passPlaceholder: "Mot de passe (ex: Souley123)",
    nomPlaceholder: "Nom complet / Raison sociale",
    enter: "Se connecter",
    registerBtn: "S'inscrire",
    showPass: "Afficher le mot de passe",
    hidePass: "Masquer le mot de passe",
    noAccount: "Vous n'avez pas de compte ? Créer un compte",
    hasAccount: "Déjà un compte ? Se connecter",
    valeurStock: "Valeur Totale du Stock :",
    actions: "Actions (Menu)",
    edit: "✏️ Modifier",
    delete: "🗑️ Supprimer",
    cancel: "Annuler",
    save: "Enregistrer",
    add: "Ajouter",
    printReceipt: "🧾 Imprimer Reçu / Facture PDF",
    qrGenerator: "📲 Générateur QR Code & Paiement Mobile",
    demoMode: "⚡ Mode Démo (Essai 15 Jours)",
    downloadApp: "📲 Télécharger l'Application Mobile / Desktop",
    mainMenuLabel: "☰ Menu Principal Navigation"
  },
  EN: {
    title: "🏢 SKYS ERP Solution",
    stock: "🛠️ Inventory Management",
    mouvements: "📅 Stock Movements",
    reappro: "🔔 Auto Replenishment",
    transport: "🚚 Freight & Logistics",
    clients: "👤 Clients & Contacts",
    dossiers: "📁 Receipts & Proofs",
    paiements: "💳 Payment Methods",
    reports: "📊 KPI Reports & Analytics",
    config: "⚙️ Settings & Configuration",
    recherche: "🔍 Quick Search",
    transaction: "💰 POS & Transactions",
    notes: "📝 Notebook",
    depenses: "📉 Expenses & Charges",
    devis: "📄 Quotes & Proforma",
    dashboard: "📈 Dashboard",
    inventaire: "📦 Physical Inventory",
    aide: "❓ Help & User Guide",
    versions: "📱 Versions & Modules",
    lock: "🔒 Logout",
    loginTitle: "🔒 Secure Access",
    registerTitle: "📝 Register Account",
    loginSub: "Enter your credentials to access the system",
    registerSub: "Fill out the form to create your account",
    emailPlaceholder: "Email or Username",
    passPlaceholder: "Password (e.g., Souley1234)",
    nomPlaceholder: "Full Name / Company",
    enter: "Sign In",
    registerBtn: "Sign Up",
    showPass: "Show Password",
    hidePass: "Hide Password",
    noAccount: "Don't have an account? Register",
    hasAccount: "Already have an account? Sign In",
    valeurStock: "Total Inventory Value:",
    actions: "Actions (Menu)",
    edit: "✏️ Edit",
    delete: "🗑️ Delete",
    cancel: "Cancel",
    save: "Save",
    add: "Add",
    printReceipt: "🧾 Print Receipt / PDF Invoice",
    qrGenerator: "📲 QR Code & Mobile Payment Generator",
    demoMode: "⚡ Demo Mode (15-Day Trial)",
    downloadApp: "📲 Download Mobile / Desktop App",
    mainMenuLabel: "☰ Main Navigation Menu"
  },
  ES: {
    title: "🏢 SKYS ERP Solution",
    stock: "🛠️ Gestión de Inventario",
    mouvements: "📅 Movimientos de Stock",
    reappro: "Reaprovisionamiento Auto",
    transport: "🚚 Transporte y Logística",
    clients: "👤 Clientes y Contactos",
    dossiers: "📁 Comprobantes",
    paiements: "💳 Métodos de Pago",
    reports: "📊 Informes e Indicadores KPI",
    config: "⚙️ Configuración y Ajustes",
    recherche: "🔍 Búsqueda Rápida",
    transaction: "💰 Caja y Transacciones",
    notes: "📝 Bloc de Notas",
    depenses: "📉 Gastos y Cargos",
    devis: "📄 Cotizaciones Proforma",
    dashboard: "📈 Panel de Control",
    inventaire: "📦 Inventario Físico",
    aide: "❓ Ayuda y Guía de Uso",
    versions: "📱 Versiones y Módulos",
    lock: "🔒 Cerrar Sesión",
    loginTitle: "🔒 Acceso Seguro",
    registerTitle: "📝 Crear Cuenta",
    loginSub: "Ingrese sus credenciales para ingresar",
    registerSub: "Complete el formulario para crear su cuenta",
    emailPlaceholder: "Correo o Usuario",
    passPlaceholder: "Contraseña (ej: Souley1234)",
    nomPlaceholder: "Nombre completo / Empresa",
    enter: "Iniciar Sesión",
    registerBtn: "Registrarse",
    showPass: "Mostrar contraseña",
    hidePass: "Ocultar contraseña",
    noAccount: "¿No tienes cuenta? Regístrate",
    hasAccount: "¿Ya tienes cuenta? Inicia sesión",
    valeurStock: "Valor Total del Inventario:",
    actions: "Acciones (Menú)",
    edit: "✏️ Editar",
    delete: "🗑️ Eliminar",
    cancel: "Cancelar",
    save: "Guardar",
    add: "Añadir",
    printReceipt: "🧾 Imprimir Recibo / Factura PDF",
    qrGenerator: "📲 Generador QR y Pago Móvil",
    demoMode: "⚡ Modo Demo (Prueba 15 Días)",
    downloadApp: "📲 Descargar Aplicación Móvil / Desktop",
    mainMenuLabel: "☰ Menú Principal Navegación"
  }
};

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
  "Produits chimiques"
];

/* =========================================================
     LISTES COMPLÈTES : Préfectures / Départements et
     Villes / Chefs-lieux de la Côte d'Ivoire (14 districts)
     ========================================================= */
const PREFECTURES_CI = [
    "Département d'Abidjan", "Département de Lagunes", "Département des Deux-Plateaux",
    "Département de la Comoé", "Département de l'Indénié-Djuablin", "Département du Nawa",
    "Département du Sud-Comoé", "Département de la Sassandra-Marahoué", "Département du Woroba",
    "Département du Bafing", "Département du Bagoué", "Département du Poro", "Département du Tchologo",
    "Département de la Baféké", "Département du Gbêkê", "Département du Hambol",
    "Département du Lacs", "Département des Lagunes (Région)", "Département de la Bélier",
    "Département du Montagnes", "Département du Sassandra", "Département du Zanzan",
    "Département du Cavally", "Département du Guémon", "Département du Tonkpi",
    "Département du Ivoire", "Département du Bélier (Région)", "Département du N'Zi"
  ];

const VILLES_CHEFS_LIEUS_CI = [
    "Abidjan", "Adzopé", "Agboville", "Grand-Bassam", "Dabou", "Tiassalé",
    "Bougouni", "Divo", "Gagnoa", "Oumé", "Grand-Zattry", "Lakota",
    "Aboisso", "Adiapé", "Béoumi", "Bouaké", "Sakassou", "Katiola",
    "Dabakala", "Korhogo", "Ferkessédougou", "Sinematiali", "Dikodougou",
    "Kong", "Minignan", "Odienné", "Boundiali", "Fouta", "Tengréla",
    "Bondoukou", "Bouna", "Tanda", "Béoumi (Côte d'Ivoire)", "Soubré",
    "San-Pédro", "Tabou", "Guiglo", "Duékoué", "Bangolo", "Man",
    "Danané", "Guéné", "Bouaflé", "Zuénoula", "Vavoua", "Issia",
    "Daloa", "Gbeuliville", "Séguéla", "Bouaflé (Côte d'Ivoire)", "Kani",
    "Korhogo (Côte d'Ivoire)", "Ferkessédougou (Côte d'Ivoire)", "Ferkessédougou",
    "Tabou (Côte d'Ivoire)", "Guiglo (Côte d'Ivoire)", "Yamoussoukro",
    "Toumodi", "Tiébissou", "Didiévi", "Attécoubé", "Dimbokro", "Daoukro",
    "Bouaké (Côte d'Ivoire)", "Bouaflé (Côte d'Ivoire)", "Béoumi (Yamoussoukro)",
    "Katiola (Côte d'Ivoire)", "Sakassou (Côte d'Ivoire)", "Kong (Côte d'Ivoire)",
    "Dimbokro (Côte d'Ivoire)", "Bouaké", "Man (Côte d'Ivoire)"
  ];

const VILLES_CI_COMPLETES = [...new Set(VILLES_CHEFS_LIEUS_CI)].sort((a, b) => a.localeCompare(b, 'fr'));
const PREFECTURES_CI_COMPLETES = [...new Set(PREFECTURES_CI)].sort((a, b) => a.localeCompare(b, 'fr'));

const REGIONS_VILLES = {
  "Lagunes": ["Abidjan", "Dabou", "Grand-Lahou", "Jacqueville"],
  "Gbêkê": ["Bouaké", "Béoumi", "Sakassou"],
  "Bélier": ["Yamoussoukro", "Toumodi", "Tiébissou"],
  "Poro": ["Korhogo", "Sinematiali", "Dikodougou"],
  "Haut-Sassandra": ["Daloa", "Issia", "Vavoua"],
  "San-Pédro": ["San-Pédro", "Tabou"]
};

const COUNTRY_OPTIONS = [
  { name: "Côte d'Ivoire", locale: 'fr-CI', currency: 'XOF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'France', locale: 'fr-FR', currency: 'EUR', currencyLabel: 'EUR', language: 'FR' },
  { name: 'Sénégal', locale: 'fr-SN', currency: 'XOF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'Bénin', locale: 'fr-BJ', currency: 'XOF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'Burkina Faso', locale: 'fr-BF', currency: 'XOF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'Mali', locale: 'fr-ML', currency: 'XOF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'Niger', locale: 'fr-NE', currency: 'XOF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'Togo', locale: 'fr-TG', currency: 'XOF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'Cameroun', locale: 'fr-CM', currency: 'XAF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'République démocratique du Congo', locale: 'fr-CD', currency: 'CDF', currencyLabel: 'CDF', language: 'FR' },
  { name: 'République du Congo', locale: 'fr-CG', currency: 'XAF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'Gabon', locale: 'fr-GA', currency: 'XAF', currencyLabel: 'FCFA', language: 'FR' },
  { name: 'Maroc', locale: 'fr-MA', currency: 'MAD', currencyLabel: 'MAD', language: 'FR' },
  { name: 'Algérie', locale: 'fr-DZ', currency: 'DZD', currencyLabel: 'DZD', language: 'FR' },
  { name: 'Tunisie', locale: 'fr-TN', currency: 'TND', currencyLabel: 'TND', language: 'FR' },
  { name: 'Belgique', locale: 'fr-BE', currency: 'EUR', currencyLabel: 'EUR', language: 'FR' },
  { name: 'Suisse', locale: 'fr-CH', currency: 'CHF', currencyLabel: 'CHF', language: 'FR' },
  { name: 'Canada', locale: 'fr-CA', currency: 'CAD', currencyLabel: 'CAD', language: 'FR' },
  { name: 'États-Unis', locale: 'en-US', currency: 'USD', currencyLabel: 'USD', language: 'EN' },
  { name: 'Royaume-Uni', locale: 'en-GB', currency: 'GBP', currencyLabel: 'GBP', language: 'EN' },
  { name: 'Irlande', locale: 'en-IE', currency: 'EUR', currencyLabel: 'EUR', language: 'EN' },
  { name: 'Nigeria', locale: 'en-NG', currency: 'NGN', currencyLabel: 'NGN', language: 'EN' },
  { name: 'Ghana', locale: 'en-GH', currency: 'GHS', currencyLabel: 'GHS', language: 'EN' },
  { name: 'Afrique du Sud', locale: 'en-ZA', currency: 'ZAR', currencyLabel: 'ZAR', language: 'EN' },
  { name: 'Kenya', locale: 'en-KE', currency: 'KES', currencyLabel: 'KES', language: 'EN' },
  { name: 'Espagne', locale: 'es-ES', currency: 'EUR', currencyLabel: 'EUR', language: 'ES' },
  { name: 'Mexique', locale: 'es-MX', currency: 'MXN', currencyLabel: 'MXN', language: 'ES' },
  { name: 'Argentine', locale: 'es-AR', currency: 'ARS', currencyLabel: 'ARS', language: 'ES' },
  { name: 'Colombie', locale: 'es-CO', currency: 'COP', currencyLabel: 'COP', language: 'ES' },
  { name: 'République dominicaine', locale: 'es-DO', currency: 'DOP', currencyLabel: 'DOP', language: 'ES' }
];
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

/* =========================================================
   SCANNER HTML5-QRCODE
   - Lit tous les formats (EAN-13, UPC, Code 128, Code 39,
     ITF, Codabar, Data Matrix, Aztec, QR, PDF417...)
   - formatsToSupport volontairement vide/omis : la bilibothèque
     active nativement tous les décodeurs, ce qui est plus
     robuste que d'ACode 39 / Html5QrcodeScanType, non importes ici.
   ========================================================= */
function ScannerHtml5({ onScan, onError, onStop }) {
  const conteneurRef = useRef(null);
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  // Verrou de demarrage : empeche deux lancements concurrents sur le meme
  // scanner. C'est la source de l'erreur "Cannot transition to a new state,
  // already under transition" levee par la bibliotheque quand on tente de
  // demarrer / changer de camera alors qu'un demarrage est deja en cours.
  const demarrageEnCoursRef = useRef(false);
  const cameraCouranteRef = useRef(null);

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onScan, onError]);

  const arreter = () => {
    const instance = scannerRef.current;
    scannerRef.current = null;

    if (!instance) return Promise.resolve();

    try {
      const resultat = instance.stop();
      if (resultat && typeof resultat.then === 'function') {
        return resultat
          .then(() => {
            try {
              const detach = instance.clear();
              if (detach && typeof detach.catch === 'function') detach.catch(() => {});
            } catch (error) { /* deja detache */ }
          })
          .catch(() => {});
      }
    } catch (error) {
      /* scanner deja arrete */
    }
    return Promise.resolve();
  };

  const demarrer = async cameraId => {
    const conteneur = conteneurRef.current;
    if (!conteneur) return;

    if (demarrageEnCoursRef.current) return;
    demarrageEnCoursRef.current = true;
    cameraCouranteRef.current = cameraId;

    // Toujours repartir d'un scanner propre avant d'en creer un nouveau.
    await arreter();

    const instance = new Html5Qrcode('skys-reader-video', { verbose: false });
    scannerRef.current = instance;

    try {
      await instance.start(
        cameraId || { facingMode: 'environment' },
        { fps: 10, qrbox: (largeurVue, hauteurVue) => ({
          width: Math.floor(largeurVue * 0.85),
          height: Math.min(140, Math.floor(hauteurVue * 0.35))
        }) },
        (codeDecode) => {
          const valeur = String(codeDecode || '').trim();
          if (valeur) onScanRef.current(valeur);
        },
        () => {
          // Aucun code dans le champ : cas NORMAL, absorbe silencieusement.
        }
      );
    } catch (error) {
      const message = String(error?.message || error || '');
      const cameraIntrouvable = /NotFoundError|No camera|Requested device/i.test(message);
      const refusee = /NotAllowedError|Permission denied/i.test(message);

      if (refusee) {
        onErrorRef.current?.('Acces a la camera refuse. Autorisez la camera dans votre navigateur puis reessayez.');
      } else if (cameraIntrouvable) {
        onErrorRef.current?.('Aucune camera disponible. Branchez une camera puis reessayez.');
      } else {
        onErrorRef.current?.('Impossible de demarrer la camera. Verifiez vos peripheriques et les autorisations du navigateur.');
      }
    } finally {
      demarrageEnCoursRef.current = false;
    }
  };

  useEffect(() => {
    let annule = false;

    (async () => {
      try {
        const appareils = await Html5Qrcode.getCameras();
        if (annule) return;

        if (!appareils || appareils.length === 0) {
          onErrorRef.current?.('Aucune camera detectee sur cet appareil. Branchez une camera ou utilisez la saisie manuelle du code-barres.');
          return;
        }

        // Preference : camera arriere (numerique de telephone), sinon la 1re.
        const cameraArriere = appareils.find(camera => /back|rear|environment|arriere/i.test(camera.label));
        setCameraActive(cameraArriere?.id || appareils[0].id);
        await demarrer(cameraArriere?.id || appareils[0].id);
      } catch (error) {
        if (!annule) {
          onErrorRef.current?.('Acces a la camera indisponible. Verifiez les autorisations du navigateur ou utilisez la saisie manuelle.');
        }
      }
    })();

    return () => {
      annule = true;
      arreter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [cameras, setCameras] = useState([]);
  const [cameraActive, setCameraActive] = useState('');

  useEffect(() => {
    let annule = false;
    Html5Qrcode.getCameras()
      .then(liste => {
        if (!annule) setCameras(liste || []);
      })
      .catch(() => { /* la liste reste vide : le select est alors masque */ });
    return () => { annule = true; };
  }, []);

  const changerCamera = async event => {
    const cameraId = event.target.value;
    setCameraActive(cameraId);
    await demarrer(cameraId);
  };

  return (
    <div>
      <div id="skys-reader-video" ref={conteneurRef} style={{ width: '100%' }} />

      {cameras.length > 1 && (
        <div style={{ margin: '10px 0' }}>
          <label
            htmlFor="skys-select-camera"
            style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}
          >
            Camera utilisee
          </label>
          <select
            id="skys-select-camera"
            value={cameraActive}
            onChange={changerCamera}
            style={{ width: '100%', maxWidth: '380px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {cameras.map(camera => (
              <option key={camera.id} value={camera.id}>
                {camera.label || 'Camera sans nom'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onStop}
          style={{ backgroundColor: '#64748b', color: 'white', border: 'none', padding: '9px 14px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Fermer la camera
        </button>
        <button
            type="button"
            onClick={() => demarrer(cameraActive)}
            style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '9px 14px', borderRadius: '6px', cursor: 'pointer' }}
          >
          Redemarrer la camera
        </button>
      </div>
    </div>
  );
}

function SkysLogo({ centered = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: centered ? 'center' : 'flex-start', width: '100%' }}>
      <img src={logoImage} alt="Logo SKYS ERP Solution" style={{ display: 'block', width: '150px', maxWidth: '100%', height: 'auto', objectFit: 'contain' }} />
    </div>
  );
}

const MODULES_AUTORISES_PAR_ROLE = {
  Administrateur: ['dashboard', 'quincaillerie', 'multiDepots', 'transaction', 'recherche', 'mouvements', 'reappro', 'achats', 'depenses', 'devis', 'inventaire', 'transport', 'clients', 'credits', 'dossiers', 'paiements', 'abonnements', 'comptabilite', 'reports', 'securite', 'tresorerie', 'geographie', 'notes', 'versions', 'config', 'aide'],
  Caissier: ['transaction', 'recherche', 'devis', 'clients', 'credits', 'paiements', 'notes', 'versions', 'aide'],
  Magasinier: ['quincaillerie', 'multiDepots', 'recherche', 'mouvements', 'reappro', 'achats', 'inventaire', 'notes', 'versions', 'aide']
};

const motDePasseSecurise = motDePasse => (
  typeof motDePasse === 'string'
  && motDePasse.length >= 8
  && /[A-Z]/.test(motDePasse)
  && /[a-z]/.test(motDePasse)
  && /\d/.test(motDePasse)
);

const genererCodeAcces = () => {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const valeurs = window.crypto?.getRandomValues(new Uint32Array(12));
  return Array.from({ length: 12 }, (_, index) => caracteres[valeurs[index] % caracteres.length]).join('');
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [passwordChangeUserId, setPasswordChangeUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [authNom, setAuthNom] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState(() => localStorage.getItem('erp_role') || 'Administrateur');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEnvoye, setResetEnvoye] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(() => Number(localStorage.getItem('erp_failed_attempts') || 0));
  const [authError, setAuthError] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  // Session multi-tenant : identité et entreprise renvoyées par le backend.
  const [utilisateurCourant, setUtilisateurCourant] = useState(() => lireEntreprise()?.utilisateur || null);
  const [entrepriseCourante, setEntrepriseCourante] = useState(() => lireEntreprise()?.entreprise || null);
  const [sousDomaine, setSousDomaine] = useState(() => {
    if (typeof window === 'undefined') return '';
    // En local aucun sous-domaine ; en ligne, on lit celui de l'URL.
    return window.location.hostname.endsWith('skyserp.com')
      ? window.location.hostname.split('.')[0]
      : '';
  });
  const [paysActif, setPaysActif] = useState("Côte d'Ivoire");
  const [depotActif, setDepotActif] = useState("Dépôt Principal");
  const [openSubMenus, setOpenSubMenus] = useState({});

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

  const [usersList, setUsersList] = useState(() => {
    const saved = localStorage.getItem('erp_users');
    return saved ? JSON.parse(saved) : [
      { id: 1, nom: 'Admin Principal', email: 'admin@quincaillerie.ci', role: 'Administrateur', password: 'Souley1234' },
      { id: 2, nom: 'Jean Caissier', email: 'caissier@quincaillerie.ci', role: 'Caissier', password: 'password123' },
      { id: 3, nom: 'Paul Magasinier', email: 'magasinier@quincaillerie.ci', role: 'Magasinier', password: 'password123' }
    ];
  });

  const [editingUserId, setEditingUserId] = useState(null);
  const [depensesPersonnelles, setDepensesPersonnelles] = useState(() => {
    const saved = localStorage.getItem('erp_depenses_personnelles');
    return saved ? JSON.parse(saved) : [
      { id: 1, libelle: 'Retrait personnel mensuel', montant: 120000, categorie: 'Retrait personnel', date: new Date().toISOString().slice(0, 10) }
    ];
  });
  const [seuilCritique, setSeuilCritique] = useState(() => Number(localStorage.getItem('erp_seuil_critique') || 100000));
  const [epargneCible, setEpargneCible] = useState(() => Number(localStorage.getItem('erp_epargne_cible') || 500000));

  useEffect(() => {
    localStorage.setItem('erp_depenses_personnelles', JSON.stringify(depensesPersonnelles));
    localStorage.setItem('erp_seuil_critique', String(seuilCritique));
    localStorage.setItem('erp_epargne_cible', String(epargneCible));
  }, [depensesPersonnelles, seuilCritique, epargneCible]);

  const [invitationCompte, setInvitationCompte] = useState(null);
  const [userForm, setUserForm] = useState({ nom: '', email: '', role: 'Caissier', password: '' });

  useEffect(() => {
    localStorage.setItem('erp_users', JSON.stringify(usersList));
    localStorage.setItem('erp_role', currentUserRole);
  }, [usersList, isAuthenticated, currentUserRole]);

  const [trialExpireDate, setTrialExpireDate] = useState(() => {
    const saved = localStorage.getItem('erp_trial_expire');
    if (saved) return Number(saved);
    const expireTime = Date.now() + 15 * 24 * 60 * 60 * 1000;
    localStorage.setItem('erp_trial_expire', expireTime);
    return expireTime;
  });

  const [isSubscribed, setIsSubscribed] = useState(() => {
    return localStorage.getItem('erp_subscribed') === 'true';
  });

  /* =========================================================
     NIVEAU D'ABONNEMENT (subscriptionLevel)
     - 'Essai'   : accès aux modules de base pendant la période d'essai
     - 'Solo'    : 1 compte
     - 'Standard': jusqu'à 5 comptes
     - 'Pro'     : comptes illimités + fonctionnalités avancées
     ========================================================= */
  const PALIERS_ABONNEMENT = {
    Essai: { libelle: 'Essai gratuit', prix: 'Gratuit (15 jours)', comptes: 1, modulesAvances: false, tresorerie: false, cameraEspion: false },
    Standard: { libelle: 'Standard / Boutique', prix: '10 000 FCFA / mois', comptes: 3, modulesAvances: false, tresorerie: false, cameraEspion: false },
    Pro: { libelle: 'Professionnel / ERP', prix: '25 000 FCFA / mois', comptes: 10, modulesAvances: true, tresorerie: false, cameraEspion: false },
    Enterprise: { libelle: 'Enterprise / Master', prix: '45 000 FCFA / mois', comptes: Infinity, modulesAvances: true, tresorerie: true, cameraEspion: true },
    Transport: { libelle: 'Transporteur (Spécial Transport)', prix: '5 000 FCFA / mois', comptes: 3, modulesAvances: false, tresorerie: false, cameraEspion: false, transport: true }
    };

    const [subscriptionLevel, setSubscriptionLevel] = useState(() => {
      const saved = localStorage.getItem('erp_subscription_level');
      if (saved && PALIERS_ABONNEMENT?.[saved]) return saved;
      return 'Essai';
    });

  useEffect(() => {
    localStorage.setItem('erp_subscription_level', subscriptionLevel);
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

  const joursRestants = Math.max(0, Math.ceil((trialExpireDate - Date.now()) / (1000 * 60 * 60 * 24)));
  const trialExpired = !isSubscribed && Date.now() > trialExpireDate;

  const [lang, setLang] = useState('FR');
  const t = translations[lang];
  const [bgColor, setBgColor] = useState(() => localStorage.getItem('erp_bgcolor') || '#f1f5f9');

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem('erp_notifications_enabled') !== 'false'
  );
  const [showNotifications, setShowNotifications] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState(null);
  const [securityEvents, setSecurityEvents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('erp_security_events')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('erp_failed_attempts', String(failedAttempts));
  }, [failedAttempts]);

  /* Restauration de session au chargement : un jeton est present dans
     le navigateur, mais seule une vérification serveur garantit qu'il
     est encore valide et que l'abonnement est toujours actif. */
  useEffect(() => {
    let annule = false;

    const restaurer = async () => {
      const jeton = lireJeton();
      if (!jeton) return;

      try {
        const moi = await apiMoi();
        if (annule) return;

        setUtilisateurCourant(moi.utilisateur);
        setEntrepriseCourante(moi.entreprise);
        setCurrentUserRole(moi.utilisateur.role);
        setIsAuthenticated(true);
      } catch {
        // Jeton expiré ou révoqué : l'intercepteur l'a déjà effacé.
        if (!annule) setIsAuthenticated(false);
      }
    };

    restaurer();
    return () => { annule = true; };
  }, []);

  /* L'API émet cet évènement quand un 401 invalide la session en cours
     d'utilisation : on renvoie l'utilisateur vers l'écran de connexion. */
  useEffect(() => {
    const surExpiration = () => {
      setIsAuthenticated(false);
      setEntrepriseCourante(null);
      setUtilisateurCourant(null);
      setAuthError('Votre session a expiré. Veuillez vous reconnecter.');
    };

    window.addEventListener('skys:session-expiree', surExpiration);
    return () => window.removeEventListener('skys:session-expiree', surExpiration);
  }, []);

  useEffect(() => {
    localStorage.setItem('erp_notifications_enabled', String(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('erp_security_events', JSON.stringify(securityEvents));
  }, [securityEvents]);

  useEffect(() => {
    localStorage.setItem('erp_bgcolor', bgColor);
  }, [bgColor]);

  const [searchTermInput, setSearchTermInput] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [panier, setPanier] = useState([]);
  const [selectedClientTx, setSelectedClientTx] = useState('');
  const [searchPosInput, setSearchPosInput] = useState('');
  const [selectedPosCatalogItem, setSelectedPosCatalogItem] = useState('');
  const [derniereTransaction, setDerniereTransaction] = useState(null);
  const [scanResult, setScanResult] = useState(null); // article détecté par le scanner universel
  const [qrGeneratedData, setQrGeneratedData] = useState(null);
  const [notesList, setNotesList] = useState(() => {
    const saved = localStorage.getItem('erp_notes');
    return saved ? JSON.parse(saved) : [{ id: 1, titre: 'Rappel Commande Ciment', contenu: 'Vérifier la livraison de 50 sacs de ciment.', date: '2026-09-26' }];
  });

  useEffect(() => { localStorage.setItem('erp_notes', JSON.stringify(notesList)); }, [notesList]);
  const [noteForm, setNoteForm] = useState({ titre: '', contenu: '' });

  const [depensesList, setDepensesList] = useState(() => {
    const saved = localStorage.getItem('erp_depenses');
    if (!localStorage.getItem('erp_legacy_depenses') && saved) {
      localStorage.setItem('erp_legacy_depenses', saved);
    }
    return saved ? JSON.parse(saved) : [
      { id: 1, libelle: 'Loyer Magasin', montant: 250000, categorie: 'Fixe', date: '2026-09-01' },
      { id: 2, libelle: 'Facture Électricité', montant: 75000, categorie: 'Fixe', date: '2026-09-05' }
    ];
  });

  useEffect(() => { localStorage.setItem('erp_depenses', JSON.stringify(depensesList)); }, [depensesList]);
  const [editingDepenseId, setEditingDepenseId] = useState(null);
  const [depenseForm, setDepenseForm] = useState({ libelle: '', montant: '', categorie: 'Fixe', date: new Date().toISOString().split('T')[0] });

  const [devisList, setDevisList] = useState(() => {
    const saved = localStorage.getItem('erp_devis');
    return saved ? JSON.parse(saved) : [{ id: 'DEV-1001', client: 'Société BTP Ivoire', date: '2026-09-20', montant: 450000, statut: 'Validé' }];
  });

  useEffect(() => { localStorage.setItem('erp_devis', JSON.stringify(devisList)); }, [devisList]);
  const [devisForm, setDevisForm] = useState({ client: '', quantite: 1, prixUnitaire: '', tva: 18, conditions: 'Paiement à 30 jours', remise: 0, validite: '2 semaines', statut: 'En attente' });

  const devisSousTotal = Number(devisForm.quantite || 0) * Number(devisForm.prixUnitaire || 0);
  const devisRemise = devisSousTotal * (Number(devisForm.remise || 0) / 100);
  const devisHT = devisSousTotal - devisRemise;
  const devisTVA = devisHT * (Number(devisForm.tva || 0) / 100);
  const devisTTC = devisHT + devisTVA;

  const [inventaireList, setInventaireList] = useState(() => {
    const saved = localStorage.getItem('erp_inventaire');
    return saved ? JSON.parse(saved) : [{ id: 1, ref: 'FIX-001', nom: 'Vis à bois 5x50', stockTheorique: 200, stockPhysique: 198, ecart: -2, date: '2026-09-25' }];
  });

  useEffect(() => { localStorage.setItem('erp_inventaire', JSON.stringify(inventaireList)); }, [inventaireList]);
  const [invForm, setInvForm] = useState({ ref: '', nom: '', stockPhysique: '' });
  const [invMode, setInvMode] = useState('AUTO'); // AUTO = inventaire physique auto, LIBRE = saisie libre
  const [invLibreForm, setInvLibreForm] = useState({ ref: '', nom: '', stockTheorique: '', stockPhysique: '' });

  const [storeInfo, setStoreInfo] = useState(() => {
    const saved = localStorage.getItem('erp_store_info');
    return saved ? JSON.parse(saved) : {
      nomMagasin: 'SKYS ERP Solution',
      adresse: 'Boulevard Principal, Abidjan',
      telephone: '+225 07 00 00 00 00',
      email: 'contact@quincaillerie-erp.ci',
      rccm: 'CI-ABJ-2026-B-12345',
      motto: 'La qualité au service des bâtisseurs'
    };
  });

  useEffect(() => {
    localStorage.setItem('erp_store_info', JSON.stringify(storeInfo));
  }, [storeInfo]);

  const [headerConfig, setHeaderConfig] = useState(() => {
    const saved = localStorage.getItem('erp_headerconfig');
    return saved ? JSON.parse(saved) : {
      policeEnTete: 'Segoe UI',
      tailleTexteGlobal: '16px',
      tailleTitre: '20px'
    };
  });

  useEffect(() => { localStorage.setItem('erp_headerconfig', JSON.stringify(headerConfig)); }, [headerConfig]);

  const [selectedRegion, setSelectedRegion] = useState("Lagunes");
  const [selectedVille, setSelectedVille] = useState("Abidjan");

  /* Sauvegarde figée des données historiques AVANT tout écrasement.
   Sans cela, le premier rendu écrase localStorage et la migration
   n'a plus rien à transferser vers le serveur. */
const [products, setProducts] = useState(() => {
    if (!localStorage.getItem('erp_legacy_products')) {
      const existant = localStorage.getItem('erp_products');
      if (existant) localStorage.setItem('erp_legacy_products', existant);
    }
    if (!localStorage.getItem('erp_legacy_clients')) {
      const clientsExistants = localStorage.getItem('erp_clients');
      if (clientsExistants) localStorage.setItem('erp_legacy_clients', clientsExistants);
    }
    if (!localStorage.getItem('erp_legacy_fournisseurs')) {
      const fournisseurs = JSON.parse(localStorage.getItem('erp_products') || '[]')
        .map(produit => produit.fournisseur)
        .filter(Boolean);
      if (fournisseurs.length) {
        localStorage.setItem('erp_legacy_fournisseurs', JSON.stringify([...new Set(fournisseurs)].map(nom => ({ nom }))));
      }
    }

    const saved = localStorage.getItem('erp_products');
    return saved ? JSON.parse(saved) : [
      { _id: '1', ref: 'FIX-001', nom: 'Vis à bois 5x50', codeBarre: '6947370120027', famille: 'Quincaillerie de fixation', fournisseur: 'SOCIETE VISSAG', prixAchat: 15, prix: 30, quantiteStock: 200, minStock: 500, maxStock: 2000, emplacement: 'Zone A', zone: 'Zone A', classe: 'Classe A' },
      { _id: '2', ref: 'ELE-002', nom: 'Prise électrique double', codeBarre: '6947370120034', famille: 'Électricité', fournisseur: 'ELEC-PRO', prixAchat: 600, prix: 1200, quantiteStock: 50, minStock: 150, maxStock: 600, emplacement: 'Zone A', zone: 'Zone A', classe: 'Classe A' },
      { _id: '3', ref: 'OUT-003', nom: 'Marteau de coffreur', codeBarre: '6947370120041', famille: 'Outillage manuel', fournisseur: 'OUTIL-IVOIRE', prixAchat: 2500, prix: 4500, quantiteStock: 45, minStock: 20, maxStock: 100, emplacement: 'Zone B', zone: 'Zone B', classe: 'Classe B' },
      { _id: '4', ref: 'MAT-004', nom: 'Sac de Ciment 50kg', codeBarre: '6947370120058', famille: 'Matériaux légers', fournisseur: 'CIMIVOIRE', prixAchat: 4000, prix: 4800, quantiteStock: 10, minStock: 100, maxStock: 500, emplacement: 'Zone D', zone: 'Zone D', classe: 'Classe A' }
    ];
  });

  // Hors session serveur, le miroir local continue d'être persisté.
  useEffect(() => {
    if (isAuthenticated) return;
    localStorage.setItem('erp_products', JSON.stringify(products));
  }, [products, isAuthenticated]);

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
    fournisseurs: fournisseursApi,
    transports: transportsApi,
    depenses: depensesApi,
    abonnements: abonnementsApi,
    chargement: chargementDonnees,
    erreur: erreurDonnees,
    rechargerDonnees,
    ajouterProduit,
    modifierProduit,
    supprimerProduit,
    ajusterStock,
    ajouterClient,
    enregistrerVente,
    ajouterFournisseur,
    ajouterTransport,
    modifierTransport,
    supprimerTransport,
    ajouterDepense,
    modifierDepense,
    supprimerDepense,
    souscrireAbonnement,
    rechercherArticleParCode
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

  // Modules complémentaires branchés sur l'API multi-tenant.
  useEffect(() => {
    if (!isAuthenticated) return;
    setTransports(transportsApi);
  }, [transportsApi, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDepensesList(depensesApi);
  }, [depensesApi, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const courant = abonnementsApi.find(a => a.actif) || abonnementsApi[0];
    if (courant?.palier && PALIERS_ABONNEMENT?.[courant.palier]) {
      setSubscriptionLevel(courant.palier);
      setIsSubscribed(true);
    }
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
        return JSON.parse(localStorage.getItem('erp_alertes_vues') || '[]');
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
      new window.Notification('⚠️ Stock bas - SKYS ERP Solution', {
        body: nouvelles.length > 1
          ? `${alerte.titre} et ${nouvelles.length - 1} autre(s) article(s) sous le seuil.`
          : `${alerte.titre} : ${alerte.message}`
      });
    }

    const maj = [...alertesVuesRef.current, ...nouvelles.map(a => a.id)];
    alertesVuesRef.current = maj;
    localStorage.setItem('erp_alertes_vues', JSON.stringify(maj));
    setShowNotifications(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const marquerAlertesVues = () => {
    const vus = [...new Set([
      ...alertesVuesRef.current,
      ...stockBasNotifications.map(a => a.id)
    ])];
    alertesVuesRef.current = vus;
    localStorage.setItem('erp_alertes_vues', JSON.stringify(vus));
  };

  const [stockParDepot, setStockParDepot] = useState(() => {
    const saved = localStorage.getItem('erp_stock_par_depot');
    if (saved) return JSON.parse(saved);

    return products.reduce((stock, produit) => {
      stock[produit.ref] = DEPOTS_LISTE.reduce((depots, depot, index) => {
        depots[depot] = index === 0 ? Number(produit.quantiteStock) : 0;
        return depots;
      }, {});
      return stock;
    }, {});
  });

  useEffect(() => {
    localStorage.setItem('erp_stock_par_depot', JSON.stringify(stockParDepot));
  }, [stockParDepot]);

  const modifierStockDepot = (ref, depot, quantite) => {
    setStockParDepot(stock => ({
      ...stock,
      [ref]: { ...(stock[ref] || {}), [depot]: Math.max(0, Number(quantite) || 0) }
    }));
  };

  const [transferts, setTransferts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('erp_transferts')) || [];
    } catch {
      return [];
    }
  });
  const [transferForm, setTransferForm] = useState({ ref: '', source: DEPOTS_LISTE[0], destination: DEPOTS_LISTE[1], quantite: '' });
  const [creditsList, setCreditsList] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('erp_credits')) || [];
    } catch {
      return [];
    }
  });
  const [creditForm, setCreditForm] = useState({ client: '', telephone: '', montant: '', echeance: '', note: '' });

  useEffect(() => {
    localStorage.setItem('erp_transferts', JSON.stringify(transferts));
  }, [transferts]);

  useEffect(() => {
    localStorage.setItem('erp_credits', JSON.stringify(creditsList));
  }, [creditsList]);

  const handleTransferSubmit = e => {
    e.preventDefault();
    const quantite = Number(transferForm.quantite);
    const stockSource = Number(stockParDepot[transferForm.ref]?.[transferForm.source] || 0);
    if (!transferForm.ref || transferForm.source === transferForm.destination || quantite <= 0 || quantite > stockSource) {
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

  const famillesDisponibles = FAMILLES_PRODUITS.filter(famille =>
    products.some(produit => produit.famille === famille)
  );

  useEffect(() => {
    if (!famillesDisponibles.length) {
      setSelectedFamille(FAMILLES_PRODUITS[0]);
      return;
    }

    if (!famillesDisponibles.includes(selectedFamille)) {
      setSelectedFamille(famillesDisponibles[0]);
    }
  }, [famillesDisponibles, selectedFamille]);

  const [autoReappro, setAutoReappro] = useState(
    () => localStorage.getItem('erp_auto_reappro') === 'true'
  );

  const [purchaseOrders, setPurchaseOrders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('erp_purchase_orders')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('erp_auto_reappro', String(autoReappro));
  }, [autoReappro]);

  useEffect(() => {
    localStorage.setItem('erp_purchase_orders', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  /* Bon de commande pré-rempli par le réapprovisionnement automatique */
  const [bonCommandePrefill, setBonCommandePrefill] = useState(null);
  const [bonCommandeForm, setBonCommandeForm] = useState({ ref: '', nom: '', fournisseur: '', quantite: '', prixAchat: '', depot: '' });

  const creerCommande = (produit, mode = 'Manuelle', { ouvrirAchats = false } = {}) => {
    const quantiteManquante = Math.max(1, Number(produit.maxStock) - Number(produit.quantiteStock));

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

    setPurchaseOrders(commandes => {
      const nouvellesCommandes = products
        .filter(produit => Number(produit.quantiteStock) <= Number(produit.minStock))
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
  }, [products, autoReappro]);

  const [publicite, setPublicite] = useState(() => {
    const saved = localStorage.getItem('erp_publicite');
    return saved ? JSON.parse(saved) : {
      actif: true,
      titre: 'Bienvenue sur SKYS ERP Solution',
      message: 'Gérez votre stock, votre caisse et vos livraisons depuis un seul poste.',
      couleur: '#0f172a',
      lien: ''
    };
  });

  useEffect(() => {
    localStorage.setItem('erp_publicite', JSON.stringify(publicite));
  }, [publicite]);

  const [editingProdId, setEditingProdId] = useState(null);
  const [prodForm, setProdForm] = useState({
    ref: '', nom: '', famille: FAMILLES_PRODUITS[0], fournisseur: '', prixAchat: '', prix: '',
    quantiteStock: '', minStock: '', maxStock: '', emplacement: 'Zone A', zone: 'Zone A', classe: 'Classe A'
  });

  const [mouvementSubTab, setMouvementSubTab] = useState('ENTREE');
  const [mouvements, setMouvements] = useState(() => {
    const saved = localStorage.getItem('erp_mouvements');
    return saved ? JSON.parse(saved) : [{ id: 1, date: '2026-09-20', type: 'ENTREE', refProd: 'FIX-001', nomProd: 'Vis à bois 5x50', quantite: 500, motif: 'Réapprovisionnement Fournisseur' }];
  });

  useEffect(() => { localStorage.setItem('erp_mouvements', JSON.stringify(mouvements)); }, [mouvements]);

  const recevoirCommande = commande => {
    if (commande.statut === 'Réceptionnée') return;

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

  const [clients, setClients] = useState(() => {
    // Sauvegarde figée pour la reprise multi-tenant (cf. useDonneesServeur).
    if (!localStorage.getItem('erp_legacy_clients')) {
      const existant = localStorage.getItem('erp_clients');
      if (existant) localStorage.setItem('erp_legacy_clients', existant);
    }

    const saved = localStorage.getItem('erp_clients');
    return saved ? JSON.parse(saved) : [
      { id: 1, nom: 'Kouassi Jean', email: 'kouassi@gmail.com', telephone: '+225 0707070707', region: 'Lagunes', ville: 'Abidjan' },
      { id: 2, nom: 'Société BTP Ivoire', email: 'contact@btp-ivoire.ci', telephone: '+225 0101010101', region: 'Gbêkê', ville: 'Bouaké' }
    ];
  });

  // Hors session serveur, le miroir local continue d'être persisté.
  useEffect(() => {
    if (isAuthenticated) return;
    localStorage.setItem('erp_clients', JSON.stringify(clients));
  }, [clients, isAuthenticated]);

  /* Référentiel fournisseurs lu depuis l'API (module Achats & Fournisseurs). */
  const [fournisseursServeur, setFournisseursServeur] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setFournisseursServeur(fournisseursApi);
  }, [fournisseursApi, isAuthenticated]);
  const [selectedDistrictGeo, setSelectedDistrictGeo] = useState(DISTRICTS_CI[0]?.id || '');
  const [selectedRegionGeo, setSelectedRegionGeo] = useState('District Autonome d\'Abidjan');
  const [selectedPrefectureGeo, setSelectedPrefectureGeo] = useState('Département d\'Abidjan');
  const [selectedVilleGeo, setSelectedVilleGeo] = useState('Abidjan');

  // Listes dérivées de la sélection courante
  const districtActifGeo = DISTRICTS_CI.find(d => d.id === selectedDistrictGeo) || DISTRICTS_CI[0];
  const regionsDuDistrict = districtActifGeo ? districtActifGeo.regions.map(r => r.nom) : [];
  const regionActifGeo = districtActifGeo?.regions.find(r => r.nom === selectedRegionGeo) || districtActifGeo?.regions[0];
  const prefecturesDeRegion = regionActifGeo ? regionActifGeo.prefectures : [];
  const prefectureActiveGeo = prefecturesDeRegion.find(p => p.nom === selectedPrefectureGeo) || prefecturesDeRegion[0];
  const sousPrefecturesPrefecture = prefectureActiveGeo ? prefectureActiveGeo.sousPrefectures : [];

  // Cascade : district -> région -> préfecture -> ville
  useEffect(() => {
    if (!districtActifGeo) return;
    const regions = districtActifGeo.regions.map(r => r.nom);
    const premiere = regions[0] || '';
    if (selectedRegionGeo !== premiere) {
      setSelectedRegionGeo(premiere);
    }
  }, [selectedDistrictGeo]);

  /* Les listes Préfecture / Département et Ville / Chef-lieu sont désormais
     alimentées par les référentiels complets (PREFECTURES_CI_COMPLETES /
     VILLES_CI_COMPLETES) : on neutralise les anciens effets de cascade
     district → région → préfecture → ville qui imposaient des valeurs
     absentes des listes dropdown. */
  useEffect(() => {
    if (!PREFECTURES_CI_COMPLETES.includes(selectedPrefectureGeo)) {
      setSelectedPrefectureGeo(PREFECTURES_CI_COMPLETES[0] || '');
    }
  }, [selectedPrefectureGeo]);

  useEffect(() => {
    if (!VILLES_CI_COMPLETES.includes(selectedVilleGeo)) {
      setSelectedVilleGeo(VILLES_CI_COMPLETES[0] || '');
    }
  }, [selectedVilleGeo]);

  const [editingClientId, setEditingClientId] = useState(null);
  const [clientForm, setClientForm] = useState({ nom: '', email: '', telephone: '', region: 'Lagunes', ville: 'Abidjan' });

  const [transports, setTransports] = useState(() => {
    const saved = localStorage.getItem('erp_transports');
    if (!localStorage.getItem('erp_legacy_transports') && saved) {
      localStorage.setItem('erp_legacy_transports', saved);
    }
    return saved ? JSON.parse(saved) : [{ id: 1, nomResponsable: 'Kouadio', prenomsResponsable: 'Marc', vehicule: 'Camion 10T', destination: 'Yamoussoukro', client: 'Société BTP Ivoire', frais: 150000, commentaires: 'Livraison prioritaire chantier', date: '2026-09-20' }];
  });

  useEffect(() => { localStorage.setItem('erp_transports', JSON.stringify(transports)); }, [transports]);
  const [editingTransportId, setEditingTransportId] = useState(null);
  const [transpForm, setTranspForm] = useState({ nomResponsable: '', prenomsResponsable: '', vehicule: '', immatriculation: '', nombreVoyage: 1, destination: '', client: '', frais: '', commentaires: '' });

  // Flotte de véhicules : immatriculations enregistrées
  const [vehicules, setVehicules] = useState(() => {
    const saved = localStorage.getItem('erp_vehicules');
    return saved ? JSON.parse(saved) : [
      { id: 1, immatriculation: '1234 AB 01', type: 'Camion 10T', capacite: '10 tonnes', conducteur: 'Kouadio Marc' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('erp_vehicules', JSON.stringify(vehicules));
  }, [vehicules]);

  const [ficheVehicule, setFicheVehicule] = useState(null);

  // Depot personnalise (parametrage geographique)
  const [depotPerso, setDepotPerso] = useState(() => localStorage.getItem('erp_depot_perso') || '');

  useEffect(() => {
    localStorage.setItem('erp_depot_perso', depotPerso);
  }, [depotPerso]);

  const [dossiers, setDossiers] = useState([]);
  const [newDossierTitre, setNewDossierTitre] = useState('');
  const [newDossierFile, setNewDossierFile] = useState(null);
  const [selectedDocPreview, setSelectedDocPreview] = useState(null);

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

  const [paiements] = useState([
    { id: 1, nom: 'Espèces (Comptoir)', type: 'Cash', icon: '💵', desc: 'Paiement direct en espèces', logo: 'cash' },
    { id: 2, nom: 'Visa', type: 'Card', icon: '💳', desc: 'Paiement sécurisé par TPE', logo: 'visa' },
    { id: 7, nom: 'Mastercard', type: 'Card', icon: '💳', desc: 'Paiement sécurisé par TPE', logo: 'mastercard' },
    { id: 8, nom: 'American Express', type: 'Card', icon: '💳', desc: 'Paiement sécurisé par TPE', logo: 'amex' },
    { id: 3, nom: 'Wave Money', type: 'Wave', icon: '🌊', desc: 'Paiement mobile Wave', logo: 'wave' },
    { id: 4, nom: 'Orange Money', type: 'Orange', icon: '🟠', desc: 'Paiement mobile Orange', logo: 'orange' },
    { id: 5, nom: 'Moov Money', type: 'Moov', icon: '🟢', desc: 'Paiement mobile Moov', logo: 'moov' },
    { id: 6, nom: 'MTN Mobile Money', type: 'MTN', icon: '🟡', desc: 'Paiement mobile MTN', logo: 'mtn' }
  ]);

  /* =========================================================
     MOYENS DE PAIEMENT (menu déroulant professionnel)
     ========================================================= */
  const MOYENS_PAIEMENT = [
    'Espèces',
    'Carte Bancaire',
    'Virement Bancaire',
    'Mobile Money',
    'Paiement à 30 jours / Crédit'
  ];

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Espèces');
  const [selectedMobilePayment, setSelectedMobilePayment] = useState('Wave');
  const [reportPeriod, setReportPeriod] = useState('mensuel');

  /* Choix de règlement / palier dans le module Abonnements */
  const [abonnementPaiement, setAbonnementPaiement] = useState('Mobile Money');
  const [abonnementPalier, setAbonnementPalier] = useState('Professionnel / ERP');
  const [paiementParPalier, setPaiementParPalier] = useState({});
  const [ventesManuel] = useState(1500000);

  const enregistrerEvenementSecurite = (type, detail, niveau = 'Moyen') => {
    setSecurityEvents(events => [{
      id: Date.now(),
      date: new Date().toLocaleString(),
      utilisateur: authEmail || 'Utilisateur inconnu',
      type,
      detail,
      niveau,
      statut: 'À examiner',
      preuveImage: null
    }, ...events].slice(0, 100));
  };

  const capturerPreuveSecurite = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return null;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.75);
    } catch (error) {
      return null;
    } finally {
      if (stream) stream.getTracks().forEach(track => track.stop());
    }
  };

  const notifierAdministrateur = detail => {
    if (!notificationsEnabled || !('Notification' in window)) return;

    const afficherNotification = () => new window.Notification('Alerte sécurité ERP', { body: detail });
    if (window.Notification.permission === 'granted') {
      afficherNotification();
    } else if (window.Notification.permission === 'default') {
      window.Notification.requestPermission().then(permission => {
        if (permission === 'granted') afficherNotification();
      });
    }
  };

  const SEUIL_TENTATIVES_AVANT_BLOCAGE = 4;

  const envoyerAlerteBackend = async (detail, niveau, preuveImage) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/security/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: authEmail, detail, level: niveau, imageData: preuveImage })
      });
    } catch (error) {
      console.warn('Backend d’alerte indisponible :', error.message);
    }
  };

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
      lienConnexion: invitation.lienConnexion
    };

    try {
      const reponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/email/lien-connexion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps)
      });

      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      return { envoye: true };
    } catch (error) {
      console.warn('Envoi du mail indisponible :', error.message);
      return { envoye: false, erreur: error.message };
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setAuthError('Connexion au serveur SKYS ERP Solution impossible : aucun accès à Internet pour le moment. Vérifiez votre connexion (Wi-Fi ou données mobiles) puis réessayez.');
      return;
    }

    if (isRegistering) {
      if (!authEmail || !authPassword || !authNom) {
        setAuthError('Veuillez remplir tous les champs !');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) {
        setAuthError('Veuillez utiliser une adresse email valide.');
        return;
      }

      if (!motDePasseSecurise(authPassword)) {
        setAuthError('Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.');
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
        setIsAuthenticated(true);
      } catch (err) {
        setAuthError(messageErreur(err));
      }
      return;
    }

    // Connexion réelle : le backend vérifie l'empreinte du mot de passe,
    // verrouille le compte après 5 échecs et renvoie un jeton signé
    // contenant le companyId de l'entreprise.
    try {
      const resultat = await apiConnexion(authEmail, authPassword, sousDomaine);

      setFailedAttempts(0);
      setCurrentUserRole(resultat.utilisateur.role);
      setEntrepriseCourante(resultat.entreprise);
      setUtilisateurCourant(resultat.utilisateur);

      enregistrerSession(resultat.jeton, resultat.utilisateur, resultat.entreprise);
      setIsAuthenticated(true);
    } catch (err) {
      const message = messageErreur(err);
      setAuthError(message);

      // Journalise l'échec comme avant, pour la piste d'audit.
      const preuveImage = await capturerPreuveSecurite();
      const tentatives = failedAttempts + 1;
      setFailedAttempts(tentatives);
      const seuilAtteint = tentatives >= SEUIL_TENTATIVES_AVANT_BLOCAGE;
      const niveauIncident = seuilAtteint ? 'Critique' : tentatives >= 2 ? 'Élevé' : 'Moyen';

      setSecurityEvents(events => [{
        id: Date.now(),
        date: new Date().toLocaleString(),
        utilisateur: authEmail || 'Utilisateur inconnu',
        type: seuilAtteint ? 'Blocage temporaire du compte' : 'Connexion échouée',
        detail: `${message} (tentative ${tentatives}/${SEUIL_TENTATIVES_AVANT_BLOCAGE})`,
        niveau: niveauIncident,
        statut: 'À examiner',
        preuveImage
      }, ...events].slice(0, 100));

      envoyerAlerteBackend(message, niveauIncident, preuveImage);
    }
  };

  const handleFirstPasswordChange = e => {
    e.preventDefault();

    if (!motDePasseSecurise(newPassword)) {
      setAuthError('Le nouveau code doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.');
      return;
    }

    if (newPassword !== newPasswordConfirmation) {
      setAuthError('Les deux nouveaux codes ne correspondent pas.');
      return;
    }

    setUsersList(users => users.map(user => user.id === passwordChangeUserId
      ? { ...user, password: newPassword, forcePasswordChange: false }
      : user
    ));
    setPasswordChangeUserId(null);
    setNewPassword('');
    setNewPasswordConfirmation('');
    setAuthError('');
  };

  const logout = () => {
    // Efface le jeton : sans lui, l'API refusera toute requête.
    effacerSession();
    setIsAuthenticated(false);
    setEntrepriseCourante(null);
    setUtilisateurCourant(null);
  };

  const handlePaySubscription = async (provider) => {
    setIsSubscribed(true);
    localStorage.setItem('erp_subscribed', 'true');
    const map = {
      'Solo': 'Standard',
      'Standard': 'Standard',
      'Pro / Illimité': 'Pro',
      'Professionnel / ERP': 'Pro',
      'Enterprise / Master': 'Enterprise',
      'Standard / Boutique': 'Standard',
      'Transporteur (Spécial Transport)': 'Transport',
      'Transporteur': 'Transport',
      'wave': 'Standard',
      'orange': 'Standard',
      'moov': 'Standard',
      'mtn': 'Standard'
    };
    const niveau = map[provider] || 'Standard';
    const palierCourant = PALIERS_ABONNEMENT?.[niveau] || PALIERS_ABONNEMENT.Essai;
    setSubscriptionLevel(niveau);

    // Persistance serveur : l'abonnement devient actif pour le tenant.
    if (isAuthenticated) {
      const resultat = await souscrireAbonnement({
        palier: niveau,
        prix: Number(String(palierCourant.prix).replace(/[^0-9]/g, '')) || 0,
        periode: 'mensuel',
        moyenPaiement: abonnementPaiement || 'Mobile Money'
      });

      if (!resultat.ok) {
        alert(resultat.erreur);
        return;
      }
    }

    alert(`Paiement ${provider} simulé avec succès. Abonnement ${palierCourant.libelle} activé (${palierCourant.prix}).`);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userForm.nom || !userForm.email || (editingUserId && !userForm.password)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
      alert('Veuillez saisir une adresse email valide.');
      return;
    }
    if (editingUserId && !motDePasseSecurise(userForm.password)) {
      alert('Le nouveau mot de passe doit contenir 8 caractères avec majuscule, minuscule et chiffre.');
      return;
    }
    if (usersList.some(user => user.email.toLowerCase() === userForm.email.toLowerCase() && user.id !== editingUserId)) {
      alert('Cette adresse email est déjà utilisée.');
      return;
    }
    if (editingUserId) {
      setUsersList(usersList.map(u => u.id === editingUserId ? { ...u, ...userForm, id: editingUserId, forcePasswordChange: true } : u));
      setEditingUserId(null);
    } else {
      const nouveauCode = genererCodeAcces();
      setUsersList([...usersList, { ...userForm, password: nouveauCode, id: Date.now(), bloque: false, forcePasswordChange: true }]);
      const jetonActivation = genererCodeAcces();
      const lienConnexion = `${window.location.origin}/connexion?email=${encodeURIComponent(userForm.email)}&role=${encodeURIComponent(userForm.role)}&jeton=${jetonActivation}`;
      const invitation = { nom: userForm.nom, email: userForm.email, role: userForm.role, code: nouveauCode, jetonActivation, lienConnexion };
      setInvitationCompte(invitation);
      const resultatMail = await envoyerLienConnexionParMail(invitation);
      setInvitationCompte(prev => ({ ...prev, mailEnvoye: resultatMail.envoye }));
      alert(`Compte créé pour ${userForm.nom}.\nCode d'accès initial : ${nouveauCode}\nLien de connexion : ${lienConnexion}`
        + (resultatMail.envoye ? '\n\n✅ Email de connexion envoyé.' : '\n\n⚠️ Email non envoyé : transmettez le lien manuellement.'));
      setUserForm({ nom: '', email: '', role: 'Caissier', password: '' });
      return;
    }
    setUserForm({ nom: '', email: '', role: 'Caissier', password: '' });
    alert("Utilisateur enregistré avec succès !");
  };

  const handleEditUser = (u) => {
    setEditingUserId(u.id);
    setUserForm({ nom: u.nom, email: u.email, role: u.role, password: u.password });
  };

  const handleDeleteUser = (id) => {
    if (window.confirm("Supprimer cet utilisateur ?")) {
      setUsersList(usersList.filter(u => u.id !== id));
    }
  };

  const handleDepenseSubmit = async (e) => {
    e.preventDefault();
    if (!depenseForm.libelle || !depenseForm.montant) return;

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

  const handleEditDepense = (d) => {
    setEditingDepenseId(d._id || d.id);
    setDepenseForm({ libelle: d.libelle, montant: d.montant, categorie: d.categorie, date: (d.date || '').toString().slice(0, 10) || new Date().toISOString().split('T')[0] });
  };

  const handleDeleteDepense = (id) => {
    if (!window.confirm("Supprimer cette dépense ?")) return;

    if (isAuthenticated) {
      supprimerDepense(id).then(resultat => {
        if (!resultat.ok) alert(resultat.erreur);
      });
      return;
    }

    setDepensesList(depensesList.filter(d => d.id !== id));
  };

  const handleDevisSubmit = (e) => {
    e.preventDefault();
    if (!devisForm.client || Number(devisForm.prixUnitaire) <= 0) return;
    setDevisList([...devisList, {
      ...devisForm,
      id: 'DEV-' + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString().split('T')[0],
      quantite: Number(devisForm.quantite) || 1,
      prixUnitaire: Number(devisForm.prixUnitaire) || 0,
      tva: Number(devisForm.tva) || 0,
      remise: Number(devisForm.remise) || 0,
      sousTotal: devisSousTotal,
      montantHT: devisHT,
      montantTVA: devisTVA,
      montant: devisTTC
    }]);
    setDevisForm({ client: '', quantite: 1, prixUnitaire: '', tva: 18, conditions: 'Paiement à 30 jours', remise: 0, validite: '2 semaines', statut: 'En attente' });
    alert(`Devis/Proforma créé avec succès !\nTotal TTC : ${devisTTC.toLocaleString()} FCFA`);
  };

  const handleInventaireSubmit = (e) => {
    e.preventDefault();
    const prodTarget = products.find(p => p.ref === invForm.ref);
    if (!prodTarget) { alert("Référence article introuvable !"); return; }
    const qtePhysique = Number(invForm.stockPhysique);
    const ecartCalcul = qtePhysique - prodTarget.quantiteStock;
    setInventaireList([...inventaireList, { id: Date.now(), ref: prodTarget.ref, nom: prodTarget.nom, stockTheorique: prodTarget.quantiteStock, stockPhysique: qtePhysique, ecart: ecartCalcul, date: new Date().toISOString().split('T')[0] }]);
    setInvForm({ ref: '', nom: '', stockPhysique: '' });
    alert("Inventaire physique enregistré avec succès !");
  };

  const handleInventaireLibreSubmit = (e) => {
    e.preventDefault();
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
    const champsObligatoires = ['ref', 'nom', 'fournisseur', 'famille', 'prixAchat', 'prix', 'quantiteStock', 'minStock', 'maxStock'];
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
      quantiteStock: Number(prodForm.quantiteStock),
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
    if (!window.confirm("Supprimer cet article ?")) return;
    if (isAuthenticated) {
      const resultat = await supprimerProduit(id);
      if (!resultat.ok) alert(resultat.erreur);
      return;
    }
    setProducts(products.filter(p => p._id !== id));
  };

  const resetProdForm = () => {
    setEditingProdId(null);
    setProdForm({ ref: '', nom: '', famille: FAMILLES_PRODUITS[0], fournisseur: '', prixAchat: '', prix: '', quantiteStock: '', minStock: '', maxStock: '', emplacement: 'Zone A', zone: 'Zone A', classe: 'Classe A' });
  };

  const handleMouvementSubmit = (e) => {
    e.preventDefault();
    const prodTarget = products.find(p => p.ref === mouvForm.refProd);
    const nomArticle = mouvForm.nomCustom || (prodTarget ? prodTarget.nom : 'Article divers');
    const qte = Number(mouvForm.quantite);

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
    if (!trouverVille(clientForm.ville)) {
      alert('Ville non reconnue dans le référentiel Côte d\'Ivoire.');
      return;
    }

    if (isAuthenticated) {
      const resultat = await ajouterClient({
        nom: clientForm.nom,
        email: clientForm.email || '',
        telephone: clientForm.telephone || '',
        region: clientForm.region || selectedRegion,
        ville: clientForm.ville || selectedVille,
        district: clientForm.district || ''
      });

      if (resultat.ok) {
        setClientForm({ nom: '', email: '', telephone: '', region: selectedRegion, ville: selectedVille });
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
    setClientForm({ nom: '', email: '', telephone: '', region: selectedRegion, ville: selectedVille });
  };

  const handleEditClient = (c) => { setEditingClientId(c.id); setClientForm({ nom: c.nom, email: c.email, telephone: c.telephone, region: c.region, ville: c.ville }); };
  const handleDeleteClient = (id) => { if (window.confirm("Supprimer ce client ?")) setClients(clients.filter(c => c.id !== id)); };

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

  const handleDeleteTransport = id => {
    if (!window.confirm('Supprimer cet enregistrement de transport ?')) return;

    if (isAuthenticated) {
      supprimerTransport(id).then(resultat => {
        if (!resultat.ok) alert(resultat.erreur);
      });
      return;
    }

    setTransports(transports.filter(tr => tr.id !== id));
  };

  const handleDeleteDossier = async dossier => {
    if (!window.confirm(`Supprimer le document « ${dossier.titre} » ?`)) return;

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

  const retirerDuPanier = (id) => setPanier(panier.filter(item => item._id !== id));
  const totalPanier = panier.reduce((acc, item) => acc + (item.prix * item.qteVente), 0);

const lancerPaiementKkiapay = () => {
    if (panier.length === 0) return alert("Panier vide !");

    // Kkiapay n'encaisse que par carte : tout autre moyen est enregistré
    // directement sur le reçu sans appel au widget.
    if (selectedPaymentMethod !== 'Carte Bancaire') {
      const confirmation = window.confirm(
        `Moyen de paiement sélectionné : ${selectedPaymentMethod}.\n\n`
        + 'Kkiapay n\'accepte que la carte bancaire. Voulez-vous encaisser par '
        + `${selectedPaymentMethod} et valider directement la transaction ?`
      );
      if (!confirmation) return;
      return validerTransaction();
    }

    if (typeof window.openKkiapayWidget !== "function") {
      return alert("Le module de paiement Kkiapay n'est pas chargé. Vérifiez le script CDN dans index.html.");
    }
    window.openKkiapayWidget({
      amount: totalPanier,
      position: "center",
      key: "dd07f3b0f51c11efa1b7dd84e0e85289",
      callback: (response) => {
        console.log("Réponse Kkiapay :", response);
        if (response && response.transaction_id) validerTransaction();
        else alert("Paiement non abouti.");
      }
    });

  };
  const validerTransaction = async () => {
    if (panier.length === 0) return alert("Panier vide !");
    const lignes = [...panier];
    const total = totalPanier;

    if (isAuthenticated) {
      // Le serveur décrémente le stock en transaction et journalise
      // les mouvements : ne rien faire en local pour éviter un doublon.
      const client = clients.find(c => String(c.id || c._id) === String(selectedClientTx));

      const resultat = await enregistrerVente({
        clientId: client?._id || null,
        clientNom: selectedClientTx || 'Client Comptoir',
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
      setBarcodeInput('');
      setSelectedClientTx('');
      setSearchPosInput('');
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

    setDerniereTransaction({
      id: 'REC-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toLocaleString(),
      client: selectedClientTx || 'Client Comptoir',
      items: lignes,
      total,
      paiement: selectedPaymentMethod
    });

    // Nettoyage automatique des champs pour l'opération suivante
    setPanier([]);
    setBarcodeInput('');
    setSelectedClientTx('');
    setSearchPosInput('');
    setSelectedPosCatalogItem('');
    setScanResult(null);
    alert(`Transaction validée ! ${lignes.length} ligne(s) enregistrée(s) dans l'historique des mouvements.`);
  };

  const imprimerRecuFacture = () => {
    window.print();
  };

  /* =========================================================
     SCANNER UNIVERSEL
     Associe un code-barres lu (EAN-13, code article, etc.)
     à la base articles, puis remplit nom + prix automatiquement.
     ========================================================= */
  const rechercherParCode = code => {
    const brut = String(code || '').trim();
    if (!brut) return null;

    const normalise = valeur => valeur.toLowerCase().replace(/[\s-_]/g, '');
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

    const produit = rechercherParCode(brut);

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
    traiterCodeScanne(barcodeInput);
  };

  /* =========================================================
     CAMERA : le composant ScannerHtml5 gere lui-meme le flux video
        et le changement de camera. Aucun <video> React a monter ici.
     ========================================================= */

  const generateQrCodePayment = (paymentType = selectedMobilePayment) => {
    const operateur = String(paymentType || '').toLowerCase();
    const refCode = 'QR-PAY-' + Math.floor(100000 + Math.random() * 900000);
    const amount = Number(totalPanier) > 0 ? Number(totalPanier) : 25000;

    // Lien signe : le client ne peut pas modifier operateur / reference / montant
    const { expire, signature } = signerLienPaiement({
      operateur,
      reference: refCode,
      montant: amount
    });

    const lienPaiement = `${window.location.origin}/paiement`
      + `?operateur=${encodeURIComponent(operateur)}`
      + `&reference=${encodeURIComponent(refCode)}`
      + `&montant=${amount}`
      + `&devise=FCFA`
      + `&expire=${expire}`
      + `&signature=${signature}`;

    setSelectedMobilePayment(paymentType);
    setQrGeneratedData({
      ref: refCode,
      montant: amount,
      operateur,
      lienPaiement,
      expire,
      urlQr: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(lienPaiement)}`
    });
  };

  const handleMobilePaymentRedirect = (op) => alert(`Redirection vers ${op}... Paiement simulé avec succès !`);

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!noteForm.titre || !noteForm.contenu) return;
    setNotesList([{ id: Date.now(), ...noteForm, date: new Date().toLocaleDateString() }, ...notesList]);
    setNoteForm({ titre: '', contenu: '' });
  };

  const handleDeleteNote = (id) => setNotesList(notesList.filter(n => n.id !== id));

  const totalValeurStock = products.reduce((acc, item) => acc + (item.prix * item.quantiteStock), 0);
  const totalFraisTransport = transports.reduce((acc, item) => acc + item.frais, 0);
  const totalDepensesReelles = depensesList.reduce((acc, item) => acc + item.montant, 0);
  const totalAchatsRecus = purchaseOrders
    .filter(commande => commande.statut === 'Réceptionnée')
    .reduce((total, commande) => total + (Number(commande.prixAchat) * Number(commande.quantite)), 0);
  const periodMultiplier = reportPeriod === 'mensuel' ? 1 : reportPeriod === 'trimestriel' ? 3 : 12;
  const caTotalEstime = (ventesManuel + totalFraisTransport) * periodMultiplier;
  const beneficeNet = caTotalEstime - ((400000 + totalDepensesReelles) * periodMultiplier);

  const exporterRapportCsv = () => {
    const lignes = [
      ['Indicateur', 'Montant'],
      ['Période', reportPeriod],
      ['Chiffre d’affaires estimé', `${caTotalEstime} FCFA`],
      ['Charges d’exploitation', `${(400000 + totalDepensesReelles) * periodMultiplier} FCFA`],
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

  if (!isAuthenticated) {
    return (
      <div
        className="login-shell"
        style={{ background: `linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0284c7 100%)` }}
      >
        {isResetPassword ? (
          <div className="login-card" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', textAlign: 'center' }}>
            <h1 style={{ fontSize: '18px', color: '#0f172a', margin: '4px 0 6px', fontWeight: 'bold' }}>🔑 Réinitialisation du mot de passe</h1>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Saisissez votre adresse email : un lien de réinitialisation vous sera envoyé.
            </p>

            {resetEnvoye ? (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#166534', fontWeight: 'bold' }}>✅ Email envoyé à {resetEmail}</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#166534' }}>Consultez votre boîte de réception et le dossier spam pour finaliser la réinitialisation.</p>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); setResetEnvoye(true); }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input type="email" placeholder="Adresse email du compte" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <button type="submit" style={{ padding: '12px', fontSize: '14px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Envoyer le lien de réinitialisation</button>
              </form>
            )}

            <button type="button" onClick={() => { setIsResetPassword(false); setResetEnvoye(false); }} style={{ marginTop: '14px', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>← Retour à la connexion</button>
          </div>
        ) : (
        <div className="login-card" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', textAlign: 'center' }}>
          <div className="login-logo"><SkysLogo centered /></div>
          <h1 className="login-title" style={{ color: '#0f172a', margin: '4px 0 6px', fontWeight: 'bold' }}>{isRegistering ? t.registerTitle : t.loginTitle}</h1>
          <p className="login-sub" style={{ color: '#64748b', marginBottom: '14px' }}>{isRegistering ? t.registerSub : t.loginSub}</p>

          <form className="login-form" onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            {isRegistering && <input type="text" placeholder={t.nomPlaceholder} value={authNom} onChange={e => setAuthNom(e.target.value)} style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} required />}
            {isRegistering && (
              <input
                type="text"
                placeholder="Sous-domaine (ex. maquincaillerie)"
                value={sousDomaine}
                onChange={e => setSousDomaine(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                required
              />
            )}
            {isRegistering && sousDomaine && (
              <p style={{ margin: '-6px 0 0', fontSize: '11px', color: '#0284c7', textAlign: 'left' }}>
                Accès : {sousDomaine}.skyserp.com
              </p>
            )}
            <input type="text" placeholder={t.emailPlaceholder} value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
            {authEmail && !isRegistering && (
              <p style={{ margin: '-4px 0 0', fontSize: '11px', color: '#64748b', textAlign: 'right' }}>
                <button type="button" onClick={() => { setIsResetPassword(true); setResetEnvoye(false); setAuthError(''); }} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '11px', fontWeight: '600', padding: 0 }}>Mot de passe oublié ?</button>
              </p>
            )}
            <input type={showPassword ? "text" : "password"} placeholder={t.passPlaceholder} value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
            {isRegistering && <input type="password" placeholder="Confirmer le mot de passe" value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} style={{ borderRadius: '8px', border: '1px solid #cbd5e1' }} required />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#475569' }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} /> {showPassword ? t.hidePass : t.showPass}
              </label>
            </div>

            {authError && <p style={{ color: '#ef4444', fontSize: '12px', margin: '0' }}>{authError}</p>}
            <button className="login-btn" type="submit" style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{isRegistering ? t.registerBtn : t.enter}</button>
          </form>

          <div className="login-block">
            <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 6px' }}>Ou continuer avec</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {['Google', 'Facebook', 'WhatsApp', 'LinkedIn'].map(provider => (
                <button
                  key={provider}
                  className="login-social"
                  type="button"
                  onClick={() => alert(`La connexion ${provider} doit être configurée.`)}
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>

          <hr className="login-sep" style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />
          <button onClick={() => setIsRegistering(!isRegistering)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{isRegistering ? t.hasAccount : t.noAccount}</button>
          <div className="login-block" style={{ marginTop: 'clamp(6px, 1.4vh, 14px)' }}>
            <p style={{ color: '#94a3b8', fontSize: '11px', margin: 0, lineHeight: 1.5 }}>
              {sousDomaine
                ? `Vous êtes sur ${sousDomaine}.skyserp.com`
                : 'Vos données sont isolées par entreprise. Chaque accès nécessite un compte validé.'}
            </p>
          </div>
        </div>
        )}
      </div>
    );
  }

  if (passwordChangeUserId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0284c7 100%)`, padding: '20px', fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.35)' }}>
          <h1 style={{ fontSize: '22px', color: '#0f172a', marginBottom: '8px' }}>Changer votre code d’accès</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '25px' }}>Pour sécuriser votre compte, remplacez le code temporaire avant de continuer.</p>
          <form onSubmit={handleFirstPasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="password" placeholder="Nouveau code d’accès" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ padding: '12px 15px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <input type="password" placeholder="Confirmer le nouveau code" value={newPasswordConfirmation} onChange={e => setNewPasswordConfirmation(e.target.value)} required style={{ padding: '12px 15px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            {authError && <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>{authError}</p>}
            <button type="submit" style={{ padding: '12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Enregistrer le nouveau code</button>
          </form>
        </div>
      </div>
    );
  }

  if (trialExpired) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '20px', fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>⏳</div>
          <h1 style={{ fontSize: '22px', color: '#1e293b', marginBottom: '10px' }}>Période d'essai de 15 jours expirée</h1>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '25px' }}>Procédez au règlement pour continuer à gérer votre activité.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              onClick={() => handlePaySubscription('wave')}
              style={{
                backgroundColor: '#0ea5e9',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🌊 Wave
            </button>

            <button
              onClick={() => handlePaySubscription('orange')}
              style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🟠 Orange Money
            </button>

            <button
              onClick={() => handlePaySubscription('moov')}
              style={{ backgroundColor: '#047857', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🟢 Moov Money
            </button>

            <button
              onClick={() => handlePaySubscription('mtn')}
              style={{ backgroundColor: '#eab308', color: '#111', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🟡 MTN Money
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    'geographie',
    'notes',
    'versions',
    'config',
    'aide'
];

const dropdownLabels = {
  quincaillerie: 'Catalogue',
  mouvements: 'Mouvements',
  inventaire: 'Inventaire',
  reappro: 'Alertes',
  reports: 'Rapports',
};

const getAllTabs = () => {
  let tabs = [
    { id: 'dashboard', label: '📈 Tableau de Bord', icon: '📈', roles: ['Administrateur'] },
    { id: 'quincaillerie', label: t.stock, icon: '🛠️', roles: ['Administrateur', 'Magasinier'] },
    { id: 'multiDepots', label: '🏬 Stock Multi-dépôts', icon: '🏬', roles: ['Administrateur', 'Magasinier'] },
    { id: 'transaction', label: t.transaction, icon: '💰', roles: ['Administrateur', 'Caissier'] },
    { id: 'recherche', label: t.recherche, icon: '🔍', roles: ['Administrateur', 'Caissier', 'Magasinier'] },
    { id: 'mouvements', label: t.mouvements, icon: '📅', roles: ['Administrateur', 'Magasinier'] },
    { id: 'reappro', label: t.reappro, icon: '🔔', roles: ['Administrateur', 'Magasinier'] },
    { id: 'achats', label: '🧾 Achats & Fournisseurs', icon: '🧾', roles: ['Administrateur', 'Magasinier'] },
    { id: 'depenses', label: t.depenses, icon: '📉', roles: ['Administrateur'] },
    { id: 'devis', label: t.devis, icon: '📄', roles: ['Administrateur', 'Caissier'] },
    { id: 'inventaire', label: t.inventaire, icon: '📦', roles: ['Administrateur', 'Magasinier'] },
    { id: 'transport', label: t.transport, icon: '🚚', roles: ['Administrateur'] },
    { id: 'clients', label: t.clients, icon: '👤', roles: ['Administrateur', 'Caissier'] },
    { id: 'credits', label: '💰 Crédits & Dettes', icon: '💰', roles: ['Administrateur', 'Caissier'] },
    { id: 'dossiers', label: t.dossiers, icon: '📁', roles: ['Administrateur'] },
    { id: 'paiements', label: t.paiements, icon: '💳', roles: ['Administrateur', 'Caissier'] },
    { id: 'abonnements', label: '🏷️ Abonnements', icon: '🏷️', roles: ['Administrateur'] },
    { id: 'comptabilite', label: '🧮 Comptabilité automatique', icon: '🧮', roles: ['Administrateur'] },
    { id: 'reports', label: t.reports, icon: '📊', roles: ['Administrateur'] },
    { id: 'securite', label: '🛡️Sécurité & Incidents', icon: '🛡️', roles: ['Administrateur'] },
    { id: 'tresorerie', label: '🔐 Trésorerie & Épargne', icon: '🔐', roles: ['Administrateur'] },
    { id: 'geographie', label: '🗺️ Paramétrage Géographique CI', icon: '🗺️', roles: ['Administrateur'] },
    { id: 'notes', label: t.notes, icon: '📝', roles: ['Administrateur', 'Caissier', 'Magasinier'] },
    { id: 'versions', label: t.versions, icon: '📱', roles: ['Administrateur', 'Caissier', 'Magasinier'] },
    { id: 'config', label: t.config, icon: '⚙️', roles: ['Administrateur'] },
    { id: 'aide', label: t.aide, icon: '❓', roles: ['Administrateur', 'Caissier', 'Magasinier'] }
  ];
  return tabs.filter(tb => tb.roles.includes(currentUserRole))
    .filter(tab => !estModuleAvanceBloque(tab.id));
};

return (
  <div className="app-shell" style={{ backgroundColor: bgColor }}>
    <aside
      className="sidebar app-sidebar"
      style={{
        width: '260px',
        minWidth: '260px',
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
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: '#0f172a',
          paddingBottom: '10px'
        }}
      >
        <SkysLogo centered />
      </div>

        <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '6px', marginBottom: '12px', textAlign: 'center' }}>
          <span style={{ display: 'block', color: '#94a3b8', fontSize: '11px' }}>
            Abonnement : {palierActif?.libelle} · Essai : {joursRestants}j
          </span>
        </div>

        <div style={{ position: 'sticky', top: 0, zIndex: 15, marginBottom: '15px', padding: '10px 10px 12px', backgroundColor: '#0f172a' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px' }}>
          <label
            htmlFor="categorie-principale"
            style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}
          >
            📚 Catégories principales
          </label>

          <select
            id="categorie-principale"
            value={dropdownTabIds.includes(activeTab) ? activeTab : ''}
            onChange={e => setActiveTab(e.target.value)}
            style={{ width: '100%', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
          >
            <option value="">-- Sélectionner une catégorie --</option>
            {getAllTabs()
              .filter(tab => dropdownTabIds.includes(tab.id))
              .map(tab => (
                <option key={tab.id} value={tab.id}>
                  {dropdownLabels[tab.id] || tab.label}
                </option>
              ))}
          </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpenSubMenus(current => ({ ...current, modules: !(current.modules ?? true) }))}
          aria-expanded={openSubMenus.modules ?? true}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', marginBottom: '6px', backgroundColor: '#1e293b', color: '#38bdf8', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
        >
          <span>📋 Modules disponibles</span>
          <span>{(openSubMenus.modules ?? true) ? '▾' : '▸'}</span>
        </button>

        {(openSubMenus.modules ?? true) && <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
          {getAllTabs().map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
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
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
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
    style={{ backgroundColor: bgColor }}
  >
    <div className="app-header" style={{ backgroundColor: bgColor }}>
      <span className="app-header-title">
        {t.title} · {(() => { const current = getAllTabs().find(tab => tab.id === activeTab); return current ? current.label : 'Module'; })()}
        {estModuleAvanceBloque(activeTab) && ' 🔒'}
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
          🔔
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
                style={{ position: 'absolute', top: '8px', right: '8px', border: 'none', background: 'transparent', color: '#64748b', fontSize: '15px', lineHeight: 1, cursor: 'pointer', padding: '2px 5px' }}
              >
                ✕
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px' }}>🔔 Notifications</strong>
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
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0' }}>Aucun article en stock bas. ✅</p>
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
                  <strong style={{ color: '#dc2626', fontSize: '12px' }}>🛡️ Alerte sécurité</strong>
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
              <h2 className="dashboard-title">📈 Tableau de Bord & Indicateurs Graphiques</h2>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0' }}>SKYS ERP Solution · {depotActif} · {selectedVilleGeo} ({selectedRegionGeo})</p>
            </div>
            {publicite.actif && (
              <div className="ad-banner" style={{ background: `linear-gradient(100deg, ${publicite.couleur} 0%, #1e3a8a 45%, #312e81 75%, #0f172a 100%)` }}>
                <div className="ad-viewport">
                  <span className="ad-track">
                    <span style={{ marginRight: '10px' }}>✦</span>
                    <strong style={{ letterSpacing: '0.4px' }}>{publicite.titre}</strong>
                    <span style={{ margin: '0 14px', opacity: 0.6 }}>•</span>
                    <span style={{ fontWeight: '500' }}>{publicite.message}</span>
                    {publicite.lien && (
                      <span style={{ marginLeft: '18px', textDecoration: 'underline', fontWeight: '600' }}>👉 {publicite.lien}</span>
                    )}
                    <span style={{ margin: '0 14px', opacity: 0.6 }}>•</span>
                    <span style={{ fontWeight: '600' }}>📦 Stock · 💰 Caisse · 🚚 Livraison · 📊 KPI</span>
                  </span>
                </div>
              </div>
            )}
            <div className="dashboard-welcome">
              <div>
                <p className="dashboard-eyebrow">SKYS ERP Solution · {depotActif}</p>
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
            <div className="dashboard-metrics">
              <div className="dashboard-panel" style={{ borderLeft: '4px solid #0284c7' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#64748b' }}>Chiffre d'Affaires</h4>
                <p className="dashboard-value" style={{ color: '#0f172a' }}>{caTotalEstime.toLocaleString()} FCFA</p>
              </div>
              <div className="dashboard-panel" style={{ borderLeft: '4px solid #ef4444' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#64748b' }}>Total Dépenses & Charges</h4>
                <p className="dashboard-value" style={{ color: '#ef4444' }}>{((400000 + totalDepensesReelles) * periodMultiplier).toLocaleString()} FCFA</p>
              </div>
              <div className="dashboard-panel" style={{ borderLeft: '4px solid #16a34a' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#64748b' }}>Bénéfice Net Réel</h4>
                <p className="dashboard-value" style={{ color: '#16a34a' }}>{beneficeNet.toLocaleString()} FCFA</p>
              </div>
            </div>

            <div className="dashboard-charts">
              <div className="dashboard-panel">
                <h3 className="dashboard-panel-title">📊 Répartition des Stocks par Famille</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {FAMILLES_PRODUITS.slice(0, 5).map((fam, idx) => {
                    const count = products.filter(p => p.famille === fam).length;
                    const pct = products.length ? (count / products.length) * 100 : 0;
                    return (
                      <div key={fam}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span>{fam}</span>
                          <span style={{ fontWeight: 'bold' }}>{count} articles</span>
                        </div>
                        <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '7px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: ['#0284c7', '#16a34a', '#eab308', '#f97316', '#8b5cf6'][idx % 5], height: '100%' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="dashboard-panel dashboard-finance">
                <h3 className="dashboard-panel-title">🍩 Diagramme Circulaire - Santé Financière</h3>
                <div className="dashboard-donut" style={{ background: 'conic-gradient(#16a34a 0% 65%, #0284c7 65% 85%, #ef4444 85% 100%)' }}></div>
                <div className="dashboard-legend">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', backgroundColor: '#16a34a', display: 'inline-block', borderRadius: '50%' }}></span> Bénéfices (65%)</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', backgroundColor: '#0284c7', display: 'inline-block', borderRadius: '50%' }}></span> Investissements (20%)</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', backgroundColor: '#ef4444', display: 'inline-block', borderRadius: '50%' }}></span> Charges (15%)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quincaillerie' && (
          <div>
            <div style={{ position: 'sticky', top: 0, backgroundColor: bgColor, padding: '6px 0 10px 0', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>
                {t.stock} - <span style={{ color: '#0284c7' }}>{selectedFamille}</span>
              </h2>

              <div style={{ backgroundColor: '#16a34a', color: 'white', padding: '7px 11px', borderRadius: '7px', fontWeight: 'bold', fontSize: '13px' }}>
                  {t.valeurStock} {totalValeurStock.toLocaleString()} FCFA
              </div>
            </div>

            <form onSubmit={handleProductSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, color: '#0284c7' }}>{editingProdId ? "Modifier l'article" : "Créer une fiche article"}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <input type="text" placeholder="Référence Unique" list="liste-refs-produits" value={prodForm.ref} onChange={e => setProdForm({ ...prodForm, ref: e.target.value })} required style={{ padding: '8px' }} />
                <datalist id="liste-refs-produits">
                  {products.map(product => <option key={product._id} value={product.ref}>{product.nom}</option>)}
                </datalist>
                <input type="text" placeholder="Code-barres (EAN) — optionnel" list="liste-codes-barres" value={prodForm.codeBarre || ''} onChange={e => setProdForm({ ...prodForm, codeBarre: e.target.value })} style={{ padding: '8px' }} />
                <datalist id="liste-codes-barres">
                  {products.filter(product => product.codeBarre).map(product => <option key={product._id} value={product.codeBarre} />)}
                </datalist>
                <input type="text" placeholder="Désignation" list="liste-designations" value={prodForm.nom} onChange={e => setProdForm({ ...prodForm, nom: e.target.value })} required style={{ padding: '8px' }} />
                <datalist id="liste-designations">
                  {products.map(product => <option key={product._id} value={product.nom} />)}
                </datalist>
                <input type="text" placeholder="Fournisseur" list="liste-fournisseurs" value={prodForm.fournisseur} onChange={e => setProdForm({ ...prodForm, fournisseur: e.target.value })} required style={{ padding: '8px' }} />
                <datalist id="liste-fournisseurs">
                  {[...new Set([
                    ...fournisseursServeur.map(f => f.nom),
                    ...products.map(product => product.fournisseur)
                  ].filter(Boolean))].map(fournisseur => <option key={fournisseur} value={fournisseur} />)}
                </datalist>
                <select value={prodForm.famille} onChange={e => setProdForm({ ...prodForm, famille: e.target.value })} required style={{ padding: '8px' }}>
                  {FAMILLES_PRODUITS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input type="number" placeholder="Prix d'Achat" value={prodForm.prixAchat} onChange={e => setProdForm({ ...prodForm, prixAchat: e.target.value })} required style={{ padding: '8px' }} />
                <input type="number" placeholder="Prix de Vente" value={prodForm.prix} onChange={e => setProdForm({ ...prodForm, prix: e.target.value })} required style={{ padding: '8px' }} />
                <input type="number" placeholder="Stock Actuel" value={prodForm.quantiteStock} onChange={e => setProdForm({ ...prodForm, quantiteStock: e.target.value })} required style={{ padding: '8px' }} />
                <input type="number" placeholder="Seuil Min" value={prodForm.minStock} onChange={e => setProdForm({ ...prodForm, minStock: e.target.value })} required style={{ padding: '8px' }} />
                <input type="number" placeholder="Capacité Max" value={prodForm.maxStock} onChange={e => setProdForm({ ...prodForm, maxStock: e.target.value })} required style={{ padding: '8px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" style={{ backgroundColor: editingProdId ? '#eab308' : '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{editingProdId ? t.save : t.add}</button>
                <button type="button" onClick={resetProdForm} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>{t.cancel}</button>
              </div>
            </form>

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '12px' }}>Réf</th>
                    <th style={{ padding: '12px' }}>Désignation</th>
                    <th style={{ padding: '12px' }}>Fournisseur</th>
                    <th style={{ padding: '12px' }}>Prix Vente</th>
                    <th style={{ padding: '12px' }}>Stock</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.filter(p => p.famille === selectedFamille).map(p => (
                    <tr key={p._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.ref}</td>
                      <td style={{ padding: '12px' }}>{p.nom}</td>
                      <td style={{ padding: '12px' }}>{p.fournisseur}</td>
                      <td style={{ padding: '12px' }}>{p.prix.toLocaleString()} FCFA</td>
                      <td style={{ padding: '12px', color: p.quantiteStock <= p.minStock ? '#ef4444' : '#16a34a', fontWeight: 'bold' }}>{p.quantiteStock}</td>
                      <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEditProd(p)} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>{t.edit}</button>
                        <button onClick={() => handleDeleteProduct(p._id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>{t.delete}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'multiDepots' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>🏬 Stock Multi-dépôts</h2>
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
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>📍 Dépôt consulté : cliquez sur ce champ pour changer de dépôt actif.</p>
            </div>

            <form onSubmit={handleTransferSubmit} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <input
                type="text"
                list="liste-articles-transfert"
                placeholder="Article à transférer"
                value={transferForm.ref}
                onChange={e => setTransferForm({ ...transferForm, ref: e.target.value })}
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
                onChange={e => setTransferForm({ ...transferForm, source: e.target.value })}
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
              {/* Quantité de stock : champ cliquable (détail de la quantité) */}
              <button
                type="button"
                onClick={() => {
                  if (!transferForm.ref) return;
                  const article = products.find(product => product.ref === transferForm.ref);
                  alert(
                    `Quantité de stock — ${article?.nom || transferForm.ref}\n`
                    + `Depuis « ${transferForm.source} » : ${Number(stockParDepot[transferForm.ref]?.[transferForm.source] || 0)} unité(s)\n`
                    + `Vers « ${transferForm.destination} » : ${Number(stockParDepot[transferForm.ref]?.[transferForm.destination] || 0)} unité(s)\n`
                    + `Stock global catalogue : ${Number(article?.quantiteStock || 0)} unité(s)`
                  );
                }}
                title="Cliquez pour voir le détail de la quantité de stock"
                style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '12px', color: '#075985', display: 'flex', alignItems: 'center', cursor: transferForm.ref ? 'pointer' : 'not-allowed', textAlign: 'left' }}
              >
                <strong>📦 Quantité de stock :</strong>&nbsp;
                {transferForm.ref
                  ? `${Number(stockParDepot[transferForm.ref]?.[transferForm.source] || 0)} unité(s) · ${Number(stockParDepot[transferForm.ref]?.[transferForm.destination] || 0)} en destination`
                  : 'Sélectionnez un article'}
              </button>
              <input type="number" min="1" placeholder="Quantité" value={transferForm.quantite} onChange={e => setTransferForm({ ...transferForm, quantite: e.target.value })} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '9px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Transférer</button>
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
                📋 Tableau de consultation des stocks par dépôt (lecture seule).
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
              {transferts.length === 0 ? <p style={{ color: '#64748b' }}>Aucun transfert enregistré.</p> : transferts.map(transfert => <p key={transfert.id} style={{ margin: '8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>{transfert.date} - <strong>{transfert.article}</strong> : {transfert.quantite} unité(s), {transfert.source} → {transfert.destination}</p>)}
            </div>
          </div>
        )}

        {activeTab === 'transaction' && (
          <div>
            <h2 className="no-print" style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.transaction}</h2>

            <form className="no-print" onSubmit={handleBarcodeScan} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                title="Ouvrir la caméra pour scanner"
                style={{ padding: '10px 12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '18px' }}
              >
                📷
              </button>
              <input id="saisie-manuelle-code" type="text" placeholder="Saisie manuelle : référence article (ex: FIX-001) ou code-barres..." value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter au panier</button>
            </form>

            {scanResult && (
              <div style={{ backgroundColor: scanResult.trouvé ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (scanResult.trouvé ? '#bbf7d0' : '#fecaca'), borderRadius: '8px', padding: '9px 12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '16px' }}>{scanResult.trouvé ? '✅' : '❌'}</span>
                <span style={{ fontSize: '12px', color: '#334155' }}>Code <strong>{scanResult.code}</strong> :</span>
                {scanResult.trouvé ? (
                  <span style={{ fontSize: '12px', color: '#166534' }}>
                    <strong>{scanResult.produit.nom}</strong> — Prix auto : <strong>{Number(scanResult.produit.prix).toLocaleString()} FCFA</strong> (stock : {scanResult.produit.quantiteStock})
                  </span>
                ) : (
                  <span style={{ fontSize: '12px', color: '#991b1b' }}>inconnu — ajoutez-le au catalogue ou saisissez la référence manuellement.</span>
                )}
              </div>
            )}

            {cameraOpen && (
              <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                {cameraError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 10px' }}>{cameraError}</p>}
                <ScannerHtml5
                  onScan={code => {
                    // 1 seule lecture par ouverture : on ferme des la premiere detection
                    if (traiterCodeScanne(code, { ajouter: true })) {
                      setCameraOpen(false);
                    }
                  }}
                  onError={setCameraError}
                  onStop={() => {
                    setCameraOpen(false);
                    setCameraError('');
                  }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <h3>Articles du catalogue</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                  <input type="text" placeholder="Rechercher article..." value={searchPosInput} onChange={e => setSearchPosInput(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <select value={selectedPosCatalogItem} onChange={e => setSelectedPosCatalogItem(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <option value="">-- Sélectionner --</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.nom} (Stock: {p.quantiteStock})</option>)}
                  </select>
                  <button onClick={() => { const prod = products.find(p => p._id === selectedPosCatalogItem) || products.find(p => p.nom.toLowerCase().includes(searchPosInput.toLowerCase())); if(prod) ajouterAuPanier(prod); }} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter au panier</button>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <h3>Panier Actuel</h3>
                {panier.length === 0 ? <p style={{ color: '#64748b' }}>Panier vide.</p> : (
                  <div>
                    {panier.map(item => (
                      <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                        <span>{item.nom} (x{item.qteVente}) - {(item.prix * item.qteVente).toLocaleString()} FCFA</span>
                        <button onClick={() => retirerDuPanier(item._id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Retirer</button>
                      </div>
                    ))}
                    <h3 style={{ marginTop: '15px' }}>Total : {totalPanier.toLocaleString()} FCFA</h3>
                    {/* Liste déroulante classique et professionnelle des moyens de paiement */}
                    <div style={{ marginTop: '10px' }}>
                      <label htmlFor="paiement-panier" style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                        Moyen de paiement
                      </label>
                      <select
                        id="paiement-panier"
                        value={selectedPaymentMethod}
                        onChange={e => setSelectedPaymentMethod(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                      >
                        {MOYENS_PAIEMENT.map(moyen => <option key={moyen} value={moyen}>{moyen}</option>)}
                      </select>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>Mode de règlement enregistré sur le reçu : <strong>{selectedPaymentMethod}</strong></p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button onClick={validerTransaction} style={{ flex: 1, backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Valider et Encaisser</button>
                      <button onClick={lancerPaiementKkiapay} style={{ flex: 1, backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                        💳 Payer par carte (Kkiapay) — {selectedPaymentMethod}
                      </button>
                      <button onClick={imprimerRecuFacture} style={{ backgroundColor: '#475569', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{t.printReceipt}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recherche' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.recherche}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', padding: '8px 12px', borderRadius: '999px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', height: '36px' }}>
              <span aria-hidden="true" style={{ fontSize: '13px', color: '#64748b' }}>🔍</span>
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
                  style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '2px 4px' }}
                >
                  ✕
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
              <button onClick={() => setMouvementSubTab('ACHAT')} style={{ padding: '8px 14px', backgroundColor: mouvementSubTab === 'ACHAT' ? '#16a34a' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>🛒 Achats</button>
              <button onClick={() => setMouvementSubTab('RECEPTION')} style={{ padding: '8px 14px', backgroundColor: mouvementSubTab === 'RECEPTION' ? '#16a34a' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>📦 Réceptions</button>
              <button onClick={() => setMouvementSubTab('RESTE')} style={{ padding: '8px 14px', backgroundColor: mouvementSubTab === 'RESTE' ? '#f59e0b' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>📊 Restes (Inventaire)</button>
            </div>

            {mouvementSubTab !== 'RESTE' ? (
              <form onSubmit={handleMouvementSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <input type="date" value={mouvForm.date} onChange={e => setMouvForm({ ...mouvForm, date: e.target.value })} style={{ padding: '8px' }} required />
                  <select value={mouvForm.refProd} onChange={e => setMouvForm({ ...mouvForm, refProd: e.target.value })} style={{ padding: '8px' }} required>
                    <option value="">-- Sélectionner Article --</option>
                    {products.map(p => <option key={p._id} value={p.ref}>{p.ref} - {p.nom}</option>)}
                  </select>
                  <input type="number" placeholder="Quantité" value={mouvForm.quantite} onChange={e => setMouvForm({ ...mouvForm, quantite: e.target.value })} required style={{ padding: '8px' }} />
                  <input type="text" placeholder="Motif ou Fournisseur" value={mouvForm.motif} onChange={e => setMouvForm({ ...mouvForm, motif: e.target.value })} required style={{ padding: '8px' }} />
                </div>
                <button type="submit" style={{ marginTop: '15px', backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Enregistrer l'opération ({mouvementSubTab})</button>
              </form>
            ) : (
              <div style={{ backgroundColor: '#fff', padding: '7px 10px', borderRadius: '7px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ color: '#0284c7', margin: 0, fontSize: '13px' }}>📊 Suivi des restes en stock par article</h3>
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
                    <tr key={m.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}>{m.date}</td>
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

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '7px' }}>Réf</th>
                    <th style={{ padding: '7px' }}>Article</th>
                    <th style={{ padding: '7px' }}>Fournisseur</th>
                    <th style={{ padding: '7px' }}>Stock actuel</th>
                    <th style={{ padding: '7px' }}>Seuil min.</th>
                    <th style={{ padding: '7px' }}>Action recommandée</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const isLow = Number(p.quantiteStock) <= Number(p.minStock);

                    return (
                      <tr key={p._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '7px', fontWeight: 'bold' }}>{p.ref}</td>
                        <td style={{ padding: '7px' }}>{p.nom}</td>
                        <td style={{ padding: '7px' }}>{p.fournisseur}</td>
                        <td style={{ padding: '7px', color: isLow ? '#ef4444' : '#16a34a', fontWeight: 'bold' }}>
                          {p.quantiteStock}
                        </td>
                        <td style={{ padding: '7px' }}>{p.minStock}</td>
                        <td style={{ padding: '7px' }}>
                          {isLow ? (
                            <button
                              type="button"
                              onClick={() => creerCommande(p, 'Manuelle', { ouvrirAchats: true })}
                              title={`Commander ${Math.max(1, Number(p.maxStock) - Number(p.quantiteStock))} unité(s) chez ${p.fournisseur}`}
                              style={{ padding: '5px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: '#f97316', color: '#fff', border: 'none', borderRadius: '4px' }}
                            >
                              🛒 Commander / Approvisionner
                            </button>
                          ) : (
                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Stock suffisant</span>
                          )}
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
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>🧾 Achats & Fournisseurs</h2>
            {bonCommandePrefill && (
              <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', padding: '11px 13px', borderRadius: '8px', marginBottom: '12px' }}>
                <h3 style={{ color: '#c2410c', margin: '0 0 7px 0', fontSize: '13px' }}>
                  ⚡ Bon de commande pré-rempli depuis Réapprovisionnement — {bonCommandePrefill.ref} ({bonCommandePrefill.nom})
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '20px' }}>
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
                    <tr><td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Aucune commande d’achat enregistrée.</td></tr>
                  ) : purchaseOrders.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'depenses' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>📉 Gestion des Dépenses & Charges</h2>
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
            <h2 className="no-print" style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>📄 Création de Devis & Factures Proforma</h2>
            {/* Zone imprimable : tableau des prestations + totaux (HT / TVA / TTC) */}
            <div className="print-only" style={{ marginBottom: '16px', color: '#0f172a' }}>
              <h2 style={{ textAlign: 'center', margin: '0 0 2px' }}>{storeInfo.nomMagasin}</h2>
              <p style={{ textAlign: 'center', margin: 0, fontSize: '11px' }}>{storeInfo.adresse} · {storeInfo.telephone} · RCCM {storeInfo.rccm}</p>
              <p style={{ margin: '10px 0 0', fontSize: '11px' }}>
                Offre valable : <strong>{devisList[devisList.length - 1]?.validite || '2 semaines'}</strong>
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
                  {devisList.map(dv => (
                    <tr key={dv.id}>
                      <td style={{ border: '1px solid #94a3b8', padding: '6px' }}>{dv.client} — prestation {dv.id}</td>
                      <td style={{ border: '1px solid #94a3b8', padding: '6px' }}>{dv.quantite ?? 1}</td>
                      <td style={{ border: '1px solid #94a3b8', padding: '6px' }}>{Number(dv.prixUnitaire ?? 0).toLocaleString()}</td>
                      <td style={{ border: '1px solid #94a3b8', padding: '6px' }}>{Number(dv.montantHT ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Totaux : sous-total HT, TVA puis Total TTC en gras, sous le tableau */}
              <div style={{ marginTop: '8px', marginLeft: 'auto', width: '260px', fontSize: '12px' }}>
                {devisList.map(dv => (
                  <div key={`tot-${dv.id}`} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sous-total HT</span><span>{Number(dv.montantHT ?? 0).toLocaleString()} FCFA</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TVA ({Number(dv.tva || 0)} %)</span><span>{Number(dv.montantTVA ?? 0).toLocaleString()} FCFA</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #94a3b8', paddingTop: '3px' }}><span>Total TTC</span><span>{Number(dv.montant ?? 0).toLocaleString()} FCFA</span></div>
                  </div>
                ))}
              </div>
            </div>
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
                <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Générer</button>
              </form>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '7px', fontSize: '11px', color: '#475569' }}>
                <span>Sous-total : <strong>{devisSousTotal.toLocaleString()} FCFA</strong></span>
                {Number(devisForm.remise) > 0 && <span>Remise : <strong>-{devisRemise.toLocaleString()}</strong></span>}
                <span>TVA ({Number(devisForm.tva) || 0} %) : <strong>{devisTVA.toLocaleString()}</strong></span>
                <span>Total TTC : <strong style={{ color: '#16a34a' }}>{devisTTC.toLocaleString()} FCFA</strong></span>
              </div>
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
                      <td style={{ padding: '8px', fontSize: '12px' }}>{dv.date}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{dv.quantite ?? 1}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{Number(dv.prixUnitaire ?? dv.montant ?? 0).toLocaleString()}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{Number(dv.tva || 0)} %</td>
                      <td style={{ padding: '8px', fontSize: '12px', fontWeight: 'bold', color: '#16a34a' }}>{Number(dv.montant || 0).toLocaleString()} FCFA</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{dv.conditions || '—'}</td>
                      <td style={{ padding: '8px', fontSize: '12px', color: dv.statut === 'Validé' ? '#16a34a' : '#f59e0b', fontWeight: 'bold' }}>{dv.statut}</td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={imprimerRecuFacture} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>🖨️ Imprimer / PDF</button>
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
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>📦 Inventaire Physique & Écarts de Stock</h2>
            <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>Mode de saisie :</span>
                <button type="button" onClick={() => setInvMode('AUTO')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '999px', border: '1px solid ' + (invMode === 'AUTO' ? '#0284c7' : '#cbd5e1'), background: invMode === 'AUTO' ? '#0284c7' : '#fff', color: invMode === 'AUTO' ? '#fff' : '#334155' }}>📷 Inventaire physique auto</button>
                <button type="button" onClick={() => setInvMode('LIBRE')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '999px', border: '1px solid ' + (invMode === 'LIBRE' ? '#16a34a' : '#cbd5e1'), background: invMode === 'LIBRE' ? '#16a34a' : '#fff', color: invMode === 'LIBRE' ? '#fff' : '#334155' }}>✍️ Saisie libre</button>
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
                <input type="text" placeholder="Destination" value={transpForm.destination} onChange={e => setTranspForm({ ...transpForm, destination: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} list="liste-villes-ci" />
                <datalist id="liste-villes-ci">
                  {VILLES_CI.map(entree => <option key={entree.ville} value={entree.ville} />)}
                </datalist>
                <input type="text" placeholder="Client" value={transpForm.client} onChange={e => setTranspForm({ ...transpForm, client: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <input type="number" placeholder="Frais (FCFA)" value={transpForm.frais} onChange={e => setTranspForm({ ...transpForm, frais: e.target.value })} required style={{ padding: '5px 6px', fontSize: '12px' }} />
                <button type="submit" style={{ backgroundColor: editingTransportId ? '#eab308' : '#16a34a', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>{editingTransportId ? t.save : "Enregistrer"}</button>
                {editingTransportId && <button type="button" onClick={() => { setEditingTransportId(null); setTranspForm({ nomResponsable: '', prenomsResponsable: '', vehicule: '', immatriculation: '', nombreVoyage: 1, destination: '', client: '', frais: '', commentaires: '' }); }} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '5px', cursor: 'pointer' }}>{t.cancel}</button>}
              </div>
            </form>

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Responsable (Nom & Prénoms)</th>
                    <th style={{ padding: '12px' }}>Véhicule</th>
                    <th style={{ padding: '12px' }}>Immatriculation</th>
                    <th style={{ padding: '12px' }}>Nb. voyages</th>
                    <th style={{ padding: '12px' }}>Destination</th>
                    <th style={{ padding: '12px' }}>Client</th>
                    <th style={{ padding: '12px' }}>Frais</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transports.map(tr => (
                    <tr key={tr._id || tr.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}>{tr.date}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{tr.nomResponsable} {tr.prenomsResponsable}</td>
                      <td style={{ padding: '12px' }}>{tr.vehicule}</td>
                      <td style={{ padding: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setFicheVehicule({ mode: 'fiche', immatriculation: tr.immatriculation })}
                          style={{ background: 'none', border: '1px dashed #0284c7', color: '#0284c7', padding: '2px 7px', fontSize: '11px', fontWeight: 'bold', borderRadius: '999px', cursor: 'pointer' }}
                        >
                          {tr.immatriculation || '—'} ⓘ
                        </button>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>{tr.nombreVoyage || 1}</td>
                      <td style={{ padding: '12px' }}>{tr.destination}</td>
                      <td style={{ padding: '12px' }}>{tr.client}</td>
                      <td style={{ padding: '12px' }}>{tr.frais.toLocaleString()} FCFA</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="button" onClick={() => handleEditTransport(tr)} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>✏️ {t.edit}</button>
                          <button type="button" onClick={() => handleDeleteTransport(tr._id || tr.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>🗑️ {t.delete}</button>
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
                    <button type="button" className="modal-close" aria-label="Fermer" onClick={() => setFicheVehicule(null)}>✕</button>

                    {ficheVehicule.mode === 'liste' ? (
                      <>
                        <h3 style={{ marginTop: 0, color: '#0284c7' }}>🚘 Immatriculations enregistrées</h3>
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
                        <h3 style={{ marginTop: 0, color: '#0284c7' }}>🚘 Fiche véhicule — {plaqueRecherchee || 'Non renseignée'}</h3>
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
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.clients}</h2>
            <form onSubmit={handleClientSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>{editingClientId ? "Modifier le client" : "Ajouter un client"}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <input type="text" placeholder="Nom / Raison Sociale" value={clientForm.nom} onChange={e => setClientForm({ ...clientForm, nom: e.target.value })} required style={{ padding: '8px' }} />
                <input type="email" placeholder="Email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} required style={{ padding: '8px' }} />
                <input type="text" placeholder="Téléphone" value={clientForm.telephone} onChange={e => setClientForm({ ...clientForm, telephone: e.target.value })} required style={{ padding: '8px' }} />
                <select value={clientForm.region} onChange={e => { setSelectedRegion(e.target.value); setClientForm({ ...clientForm, region: e.target.value, ville: REGIONS_VILLES[e.target.value][0] }); }} style={{ padding: '8px' }}>
                  {Object.keys(REGIONS_VILLES).map(reg => <option key={reg} value={reg}>{reg}</option>)}
                </select>
                <select value={clientForm.ville} onChange={e => setClientForm({ ...clientForm, ville: e.target.value })} style={{ padding: '8px' }}>
                  {(REGIONS_VILLES[clientForm.region] || []).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{editingClientId ? t.save : t.add}</button>
                <button type="button" onClick={() => { setEditingClientId(null); setClientForm({ nom: '', email: '', telephone: '', region: 'Lagunes', ville: 'Abidjan' }); }} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>{t.cancel}</button>
              </div>
            </form>

            <div style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '12px' }}>Nom / Entreprise</th>
                    <th style={{ padding: '12px' }}>Email</th>
                    <th style={{ padding: '12px' }}>Téléphone</th>
                    <th style={{ padding: '12px' }}>Région / Ville</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{c.nom}</td>
                      <td style={{ padding: '12px' }}>{c.email}</td>
                      <td style={{ padding: '12px' }}>{c.telephone}</td>
                      <td style={{ padding: '12px' }}>{c.region} - {c.ville}</td>
                      <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEditClient(c)} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>{t.edit}</button>
                        <button onClick={() => handleDeleteClient(c.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>{t.delete}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'credits' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>💰 Crédits & Dettes clients</h2>
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
                    <div style={{ fontSize: '32px' }}>📄</div>
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
                  <button type="button" className="modal-close" aria-label="Fermer" onClick={() => setSelectedDocPreview(null)}>✕</button>
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

                  {pm.type === 'Wave' || pm.type === 'Orange' || pm.type === 'Moov' || pm.type === 'MTN' ? (
                    <button
                      onClick={() => generateQrCodePayment(pm.type)}
                      style={{
                        width: '100%',
                        backgroundColor:
                          pm.type === 'Wave'
                            ? '#0ea5e9'
                            : pm.type === 'Orange'
                            ? '#f97316'
                            : pm.type === 'Moov'
                            ? '#047857'
                            : '#eab308',
                        color: pm.type === 'MTN' ? '#111' : '#fff',
                        border: 'none',
                        padding: '5px',
                        borderRadius: '5px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      QR {pm.nom}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const moyen = pm.type === 'Cash'
                          ? 'Espèces'
                          : pm.type === 'Card'
                          ? 'Carte Bancaire'
                          : 'Mobile Money';
                        setSelectedPaymentMethod(moyen);
                        alert(`Mode de paiement défini sur : ${moyen}`);
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: '#0284c7',
                        color: 'white',
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
                  )}
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
                Encaissez par Wave, Orange Money, MTN MoMo, Moov Money ou carte bancaire. Lien + QR Code générés automatiquement.
              </p>
              <PasserellePaiement
                montant={totalPanier || 0}
                onPaiementConfirme={paiement => {
                  setDerniereTransaction(prev => ({
                    ...(prev || { id: 'REC-' + Date.now(), date: new Date().toLocaleString(), client: 'Client à distance', items: [], total: paiement.montant }),
                    paiement: `${paiement.operateur} · ${paiement.reference}`
                  }));
                  alert(`Paiement ${paiement.operateur} confirmé : ${Number(paiement.montant).toLocaleString()} FCFA`);
                }}
              />
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
              <select
                value={selectedMobilePayment}
                onChange={e => setSelectedMobilePayment(e.target.value)}
                aria-label="Choisir le moyen de paiement mobile"
                style={{ width: '100%', maxWidth: '320px', padding: '9px 12px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="MTN">MTN Mobile Money</option>
                <option value="Orange">Orange Money</option>
                <option value="Moov">Moov Money</option>
                <option value="Wave">Wave Money</option>
              </select>
              <button
                onClick={() => generateQrCodePayment()}
                style={{
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginBottom: '15px'
                }}
              >
                {t.qrGenerator}
              </button>

              {qrGeneratedData && (
                <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img
                    src={qrGeneratedData.urlQr}
                    alt="QR Code Paiement"
                    style={{
                      border: '4px solid #fff',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      borderRadius: '8px',
                      marginBottom: '10px'
                    }}
                  />
                  <p style={{ fontWeight: 'bold', color: '#0f172a', margin: '0' }}>
                    {String(qrGeneratedData.operateur)} | Référence : {String(qrGeneratedData.ref)} | Montant : {Number(qrGeneratedData.montant).toLocaleString()} FCFA
                  </p>
                  <a href={qrGeneratedData.lienPaiement} target="_blank" rel="noopener noreferrer" style={{ marginTop: '8px', color: '#0284c7', fontSize: '13px', wordBreak: 'break-all' }}>
                    Ouvrir le lien de paiement
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 14. RAPPORTS & INDICATEURS KPI */}
        {activeTab === 'abonnements' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>🏷️ Abonnements par palier</h2>
            {/* Liste déroulante complète des moyens de paiement pour souscrire / renouveler */}
            <div style={{ backgroundColor: '#fff', padding: '13px', borderRadius: '8px', marginTop: '10px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', margin: '0 0 7px 0', fontSize: '13px' }}>💳 Moyen de règlement de l’abonnement</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', alignItems: 'center' }}>
                <select
                  id="paiement-abonnement"
                  value={abonnementPaiement}
                  onChange={e => setAbonnementPaiement(e.target.value)}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Carte Bancaire">Carte Bancaire</option>
                  <option value="Virement Bancaire">Virement Bancaire</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Paiement échelonné / Crédit">Paiement échelonné / Crédit (selon les conditions)</option>
                </select>
                <select
                  id="palier-abonnement"
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
                  onClick={() => handlePaySubscription(abonnementPalier)}
                  style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Souscrire / Renouveler
                </button>
              </div>
              <p style={{ margin: '7px 0 0', fontSize: '11px', color: '#64748b' }}>
                Règlement sélectionné : <strong>{abonnementPaiement}</strong> — Palier : <strong>{abonnementPalier}</strong>
              </p>
            </div>
            {/* Abonnement unique Transporteur */}
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bae6fd', padding: '13px', borderRadius: '8px', marginBottom: '14px' }}>
              <h3 style={{ color: '#1d4ed8', margin: '0 0 4px 0', fontSize: '13px' }}>🚛 Abonnement Transporteur (Spécial Transport)</h3>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a' }}>
                Forfait unique destiné aux profils transporteurs : <strong>5 000 FCFA / mois</strong>, avec accès aux fonctionnalités logistiques de l’ERP.
              </p>
              <button
                                type="button"
                                onClick={() => {
                                  setAbonnementPalier('Transporteur (Spécial Transport)');
                                  setAbonnementPaiement(paiementParPalier.Transporteur || 'Mobile Money');
                                  handlePaySubscription('Transporteur (Spécial Transport)');
                                }}
                style={{ backgroundColor: '#1d4ed8', color: 'white', border: 'none', padding: '7px 12px', fontSize: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🚛 Activer le forfait Transporteur
              </button>
            </div>
            <p style={{ color: '#64748b' }}>Choisissez un palier selon le nombre de comptes utilisateurs actifs : {usersList.length} compte(s) configuré(s).</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '8px', marginTop: '10px' }}>
              {[
                { nom: 'Solo', libelle: 'Standard / Boutique', comptes: 'Jusqu’à 3 comptes', prix: '10 000 FCFA / mois', limite: 3 },
                { nom: 'Standard', libelle: 'Professionnel / ERP', comptes: 'Jusqu’à 10 comptes', prix: '25 000 FCFA / mois', limite: 10 },
                { nom: 'Pro / Illimité', libelle: 'Enterprise / Master', comptes: 'Comptes illimités', prix: '45 000 FCFA / mois', limite: Infinity }
              ].map(plan => (
                <div key={plan.nom} style={{ backgroundColor: '#fff', padding: '9px 10px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', borderLeft: `3px solid ${usersList.length <= plan.limite ? '#16a34a' : '#cbd5e1'}` }}>
                  <h3 style={{ color: '#0284c7', margin: '0', fontSize: '13px' }}>{plan.libelle}</h3>
                  <p style={{ margin: '2px 0 0', fontWeight: 'bold', color: '#0f172a', fontSize: '11px' }}>{plan.comptes}</p>
                  <p style={{ margin: '1px 0 5px 0', color: '#64748b', fontSize: '10px' }}>{plan.prix}</p>
                  {/* Moyens de paiement propres a chaque palier */}
                  <select
                    aria-label={`Moyen de paiement pour ${plan.libelle}`}
                    value={paiementParPalier[plan.nom] || 'Mobile Money'}
                    onChange={e => setPaiementParPalier({ ...paiementParPalier, [plan.nom]: e.target.value })}
                    style={{ width: '100%', padding: '4px 5px', fontSize: '10px', borderRadius: '5px', border: '1px solid #cbd5e1', marginBottom: '5px', backgroundColor: '#f8fafc' }}
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Carte Bancaire">Carte Bancaire</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Paiement échelonné / Crédit">Paiement échelonné / Crédit</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setAbonnementPalier(plan.libelle);
                      setAbonnementPaiement(paiementParPalier[plan.nom] || 'Mobile Money');
                      handlePaySubscription(plan.nom);
                    }}
                    style={{ width: '100%', backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '6px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Choisir ce palier
                  </button>
                  <p style={{ margin: '4px 0 0', fontSize: '9px', color: '#64748b' }}>
                    Règlement : <strong>{paiementParPalier[plan.nom] || 'Mobile Money'}</strong>
                  </p>
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>Paiement local</h3>
              <p style={{ color: '#64748b', marginBottom: 0 }}>Les paiements Wave, Orange Money, MTN Money et Moov Money sont disponibles dans le module Moyens de Paiement.</p>
            </div>
          </div>
        )}

        {activeTab === 'comptabilite' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>🧮 Comptabilité automatique</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '7px', marginBottom: '10px' }}>
              <div style={{ backgroundColor: '#fff', padding: '8px 10px', borderRadius: '7px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                <strong style={{ fontSize: '11px', color: '#475569' }}>Recettes estimées</strong>
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
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '10px' }}>{new Date().toLocaleDateString()}</td><td style={{ padding: '10px' }}>RECETTE</td><td style={{ padding: '10px' }}>Ventes estimées</td><td style={{ padding: '10px' }}>0 FCFA</td><td style={{ padding: '10px', color: '#16a34a', fontWeight: 'bold' }}>{caTotalEstime.toLocaleString()} FCFA</td></tr>
                  {depensesList.map(depense => <tr key={`depense-${depense.id}`} style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '10px' }}>{depense.date}</td><td style={{ padding: '10px' }}>CHARGE</td><td style={{ padding: '10px' }}>{depense.libelle}</td><td style={{ padding: '10px', color: '#ef4444', fontWeight: 'bold' }}>{Number(depense.montant).toLocaleString()} FCFA</td><td style={{ padding: '10px' }}>0 FCFA</td></tr>)}
                  {purchaseOrders.filter(commande => commande.statut === 'Réceptionnée').map(commande => <tr key={`achat-${commande.id}`} style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '10px' }}>{commande.dateReception || commande.date || '-'}</td><td style={{ padding: '10px' }}>ACHAT</td><td style={{ padding: '10px' }}>{commande.nom}</td><td style={{ padding: '10px', color: '#ef4444', fontWeight: 'bold' }}>{(Number(commande.prixAchat) * Number(commande.quantite)).toLocaleString()} FCFA</td><td style={{ padding: '10px' }}>0 FCFA</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'reports' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.reports}</h2>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setReportPeriod('mensuel')} style={{ padding: '4px 11px', fontSize: '12px', backgroundColor: reportPeriod === 'mensuel' ? '#0284c7' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Mensuel</button>
              <button onClick={() => setReportPeriod('trimestriel')} style={{ padding: '4px 11px', fontSize: '12px', backgroundColor: reportPeriod === 'trimestriel' ? '#0284c7' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Trimestriel</button>
              <button onClick={() => setReportPeriod('annuel')} style={{ padding: '4px 11px', fontSize: '12px', backgroundColor: reportPeriod === 'annuel' ? '#0284c7' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Annuel</button>
              <button onClick={exporterRapportCsv} style={{ padding: '4px 11px', fontSize: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Exporter CSV</button>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '13px' }}>Rapport Financier Synthétique ({reportPeriod.toUpperCase()})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '6px' }}>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f0f9ff', border: '1px solid #e0f2fe' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Chiffre d'affaires estimé</span>
                  <strong style={{ fontSize: '13px', color: '#0284c7' }}>{caTotalEstime.toLocaleString()} FCFA</strong>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Charges d'exploitation</span>
                  <strong style={{ fontSize: '13px', color: '#ef4444' }}>{((400000 + totalDepensesReelles) * periodMultiplier).toLocaleString()} FCFA</strong>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Bénéfice net</span>
                  <strong style={{ fontSize: '13px', color: '#16a34a' }}>{beneficeNet.toLocaleString()} FCFA</strong>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#fefce8', border: '1px solid #fef9c3' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Marge nette</span>
                  <strong style={{ fontSize: '13px', color: '#ca8a04' }}>{caTotalEstime > 0 ? ((beneficeNet / caTotalEstime) * 100).toFixed(1) : '0.0'} %</strong>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f5f3ff', border: '1px solid #ede9fe' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Articles en stock bas</span>
                  <strong style={{ fontSize: '13px', color: '#7c3aed' }}>{products.filter(p => Number(p.quantiteStock) <= Number(p.minStock)).length}</strong>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Valeur du stock</span>
                  <strong style={{ fontSize: '13px', color: '#334155' }}>{totalValeurStock.toLocaleString()} FCFA</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tresorerie' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>🔐 Trésorerie & Épargne Personnelle</h2>
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

        {activeTab === 'geographie' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>🗺️ Paramétrage Géographique — Côte d'Ivoire</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '7px', marginBottom: '14px' }}>
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

            <div style={{ backgroundColor: '#fff', padding: '11px 13px', borderRadius: '8px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#0284c7' }}>🗂️ Navigation hiérarchique du territoire</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', alignItems: 'end' }}>
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
                    {PREFECTURES_CI_COMPLETES.map(prefecture => <option key={prefecture} value={prefecture}>{prefecture}</option>)}
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
                    {VILLES_CI_COMPLETES.map(ville => <option key={ville} value={ville}>{ville}</option>)}
                  </select>
                </div>
              </div>

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
                📍 Chemin actif : <strong>{districtActifGeo?.nom}</strong> › <strong>{selectedRegionGeo}</strong> › <strong>{selectedPrefectureGeo}</strong> › <strong>{selectedVilleGeo}</strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'securite' && (
          <div>
            <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>🛡️ Sécurité & Incidents</h2>
            <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 4px 0', color: '#0284c7', fontSize: '13px' }}>📹 Caméra de sécurité — Mode Espion</h3>
              {!aAccesCameraEspion ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#b45309', fontWeight: 'bold' }}>
                  🔒 Caméra espion réservée à l'abonnement Enterprise / Master (45 000 FCFA / mois).
                  <button type="button" onClick={() => setActiveTab('abonnements')} style={{ marginLeft: '8px', backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '4px 9px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Voir les abonnements</button>
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b' }}>
                    Cochez la case pour activer ou désactiver la surveillance en direct. Les captures horodatées sont archivées ci-dessous.
                  </p>
                  <CameraEspion
                    onPreuveCapturee={preuve => {
                      setSecurityEvents(events => [{
                        id: preuve.id,
                        date: preuve.horodatage,
                        utilisateur: authEmail || 'Administrateur',
                        type: 'Capture caméra espion',
                        detail: `Capture manuelle - session de ${preuve.dureeSession}s`,
                        niveau: 'Moyen',
                        statut: 'À examiner',
                        preuveImage: preuve.image
                      }, ...events].slice(0, 100));
                    }}
                  />
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
                onClick={() => {
                  const detail = window.prompt('Décrivez l’incident à enregistrer :');
                  if (detail) enregistrerEvenementSecurite('Incident manuel', detail, 'Moyen');
                }}
                style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '5px 10px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Enregistrer un incident
              </button>
            </div>

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
                  <button type="button" className="modal-close" aria-label="Fermer" onClick={() => setSelectedEventId(null)}>✕</button>
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
                <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span>{user.nom} ({user.role}) - {user.bloque ? 'Compte verrouillé' : 'Compte actif'}</span>
                  <button type="button" onClick={() => setUsersList(users => users.map(item => item.id === user.id ? { ...item, bloque: !item.bloque } : item))} style={{ backgroundColor: user.bloque ? '#16a34a' : '#ef4444', color: 'white', border: 'none', padding: '7px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                    {user.bloque ? 'Déverrouiller' : 'Verrouiller'}
                  </button>
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
  <div>
    <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.versions}</h2>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0284c7', marginTop: 0 }}>Étape 1 — Version PC</h3>
        <ul style={{ paddingLeft: '18px', color: '#334155', lineHeight: '1.8' }}>
          <li>Interface web : accessible via navigateur, pratique pour les administrateurs et responsables.</li>
          <li>Gestion multi-modules : Catalogue, Mouvements, Inventaire, Alertes, Rapports, Administration.</li>
        </ul>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0284c7', marginTop: 0 }}>Étape 2 — Version Mobile</h3>
        <ul style={{ paddingLeft: '18px', color: '#334155', lineHeight: '1.8' }}>
          <li>Application mobile : Android/iOS, adaptée aux magasiniers et vendeurs.</li>
          <li>Scanner QR/barres : pour enregistrer entrées/sorties rapidement.</li>
          <li>Inventaire en temps réel : possibilité de compter directement depuis le smartphone.</li>
        </ul>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0284c7', marginTop: 0 }}>Étape 3 — Synchronisation PC ↔ Téléphone</h3>
        <ul style={{ paddingLeft: '18px', color: '#334155', lineHeight: '1.8' }}>
          <li>Base de données centralisée : tous les appareils se connectent au même serveur.</li>
          <li>Cloud et API : synchronisation automatique entre web et mobile.</li>
          <li>Avantage : cohérence des données, pas de doublons, accès partout.</li>
        </ul>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#0284c7', marginTop: 0 }}>Étape 4 — Modules avancés</h3>
        <ul style={{ paddingLeft: '18px', color: '#334155', lineHeight: '1.8' }}>
          <li>Facturation et caisse : relier ventes et stock.</li>
          <li>CRM clients : suivi des clients et fidélisation.</li>
          <li>E-commerce intégré : connecter stock à une boutique en ligne.</li>
        </ul>
      </div>
    </div>
  </div>
)}


        {/* 16. PARAMÈTRES & CONFIGURATION */}
        {activeTab === 'config' && (
          <div>
          <h2 style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.config}</h2>

          <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', margin: '0 0 6px 0', fontSize: '13px' }}>📢 Panneau publicitaire du tableau de bord</h3>
              {currentUserRole !== 'Administrateur' ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', fontWeight: 'bold' }}>🔒 Accès réservé aux administrateurs.</p>
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
              <h3 style={{ color: '#0284c7', margin: '0 0 6px 0', fontSize: '13px' }}>🏷️ Niveau d'abonnement ({palierActif?.libelle})</h3>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: aAccesAvance ? '#16a34a' : '#b45309', fontWeight: 'bold' }}>
                {aAccesAvance
                  ? '✅ Accès complet : fonctionnalités avancées débloquées.'
                  : '🔒 Modules avancés verrouillés (Sécurité, Comptabilité, Rapports KPI, Multi-dépôts).'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px', alignItems: 'center' }}>
                <select value={subscriptionLevel} onChange={e => setSubscriptionLevel(e.target.value)} style={{ padding: '5px 6px', fontSize: '12px' }}>
                  <option value="Essai">Essai gratuit — 15 jours</option>
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
                <strong style={{ color: '#15803d', fontSize: '13px' }}>✅ Compte créé — transmettez ces informations à {invitationCompte.nom}</strong>
                <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: 'bold', color: invitationCompte.mailEnvoye ? '#16a34a' : '#b45309' }}>
                  {invitationCompte.mailEnvoye
                    ? '📧 Email de connexion envoyé automatiquement.'
                    : '⚠️ Email non envoyé : transmettez le lien ci-dessous manuellement.'}
                </p>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#166534' }}>Identifiant : <strong>{invitationCompte.email}</strong> · Rôle : <strong>{invitationCompte.role}</strong></p>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#166534' }}>Code d’accès initial : <strong>{invitationCompte.code}</strong> (à remplacer à la première connexion)</p>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#166534', wordBreak: 'break-all' }}>Lien de connexion : <a href={invitationCompte.lienConnexion} style={{ color: '#0284c7' }}>{invitationCompte.lienConnexion}</a></p>
                <button type="button" onClick={() => setInvitationCompte(null)} style={{ marginTop: '6px', backgroundColor: '#15803d', color: '#fff', border: 'none', padding: '5px 10px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer' }}>Masquer</button>
              </div>
            )}

            {isSubscribed ? (
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>🏢 Informations de votre entreprise</h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>Ces informations seront utilisées dans l’identité de SKYS ERP Solution et vos documents commerciaux.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <input type="text" placeholder="Nom de l’entreprise" value={storeInfo.nomMagasin} onChange={e => setStoreInfo({ ...storeInfo, nomMagasin: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="Adresse" value={storeInfo.adresse} onChange={e => setStoreInfo({ ...storeInfo, adresse: e.target.value })} style={{ padding: '8px' }} />
                <input type="tel" placeholder="Téléphone" value={storeInfo.telephone} onChange={e => setStoreInfo({ ...storeInfo, telephone: e.target.value })} style={{ padding: '8px' }} />
                <input type="email" placeholder="Email professionnel" value={storeInfo.email} onChange={e => setStoreInfo({ ...storeInfo, email: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="RCCM / Identifiant fiscal" value={storeInfo.rccm} onChange={e => setStoreInfo({ ...storeInfo, rccm: e.target.value })} style={{ padding: '8px' }} />
                <input type="text" placeholder="Slogan" value={storeInfo.motto} onChange={e => setStoreInfo({ ...storeInfo, motto: e.target.value })} style={{ padding: '8px' }} />
              </div>
            </div>
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
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>👥 Gestion des Comptes & Attribution des Rôles</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>En tant qu'administrateur, créez ou modifiez les comptes. Un code initial sécurisé est généré automatiquement à la création.</p>
              <form onSubmit={handleUserSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <input type="text" placeholder="Nom de l'utilisateur" value={userForm.nom} onChange={e => setUserForm({ ...userForm, nom: e.target.value })} required style={{ padding: '8px' }} />
                <input type="email" placeholder="Email / Identifiant" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required style={{ padding: '8px' }} />
                <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} style={{ padding: '8px' }}>
                  <option value="Administrateur">Administrateur (Accès Total)</option>
                  <option value="Caissier">Caissier (Caisse & Ventes)</option>
                  <option value="Magasinier">Magasinier (Stocks & Mouvements)</option>
                </select>
                <input type="text" placeholder={editingUserId ? 'Nouveau mot de passe' : 'Code généré automatiquement'} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={Boolean(editingUserId)} disabled={!editingUserId} style={{ padding: '8px', backgroundColor: editingUserId ? '#fff' : '#f1f5f9' }} />
                <div style={{ display: 'flex', gap: '10px', gridColumn: '1 / -1' }}>
                  <button type="submit" style={{ backgroundColor: editingUserId ? '#eab308' : '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{editingUserId ? t.save : "Créer le compte"}</button>
                  {editingUserId && <button type="button" onClick={() => { setEditingUserId(null); setUserForm({ nom: '', email: '', role: 'Caissier', password: '' }); }} style={{ backgroundColor: '#94a3b8', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>{t.cancel}</button>}
                </div>
              </form>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '10px' }}>Nom</th>
                    <th style={{ padding: '10px' }}>Email / Login</th>
                    <th style={{ padding: '10px' }}>Rôle Attribué</th>
                    <th style={{ padding: '10px' }}>État du code</th>
                    <th style={{ padding: '10px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{u.nom}</td>
                      <td style={{ padding: '10px' }}>{u.email}</td>
                      <td style={{ padding: '10px', color: '#0284c7', fontWeight: 'bold' }}>{u.role}</td>
                      <td style={{ padding: '10px', color: u.forcePasswordChange ? '#eab308' : '#16a34a', fontWeight: 'bold' }}>{u.forcePasswordChange ? 'Code initial à remplacer' : 'Code personnalisé'}</td>
                      <td style={{ padding: '10px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEditUser(u)} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>{t.edit}</button>
                        <button onClick={() => handleDeleteUser(u.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>{t.delete}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <button
                  type="button"
                  onClick={() => setOpenSubMenus(current => ({ ...current, apparence: !(current.apparence ?? true) }))}
                  aria-expanded={openSubMenus.apparence ?? true}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, color: '#0284c7', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', textAlign: 'left' }}
                >
                  <span>🎨 Apparence & En-têtes</span>
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
                </div>}
              </div>
            </div>

          {/* AJOUT : Paramètres Généraux, Multi-dépôts & Droits des Utilisateurs */}
    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h3 style={{ color: '#0284c7', marginTop: 0 }}>🌍 Paramètres Généraux & Multi-dépôts</h3>
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

      <h4 style={{ color: '#0f172a', marginBottom: '10px' }}>👥 Droits des Utilisateurs & Rôles</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead>
          <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
            <th style={{ padding: '8px' }}>Nom</th>
            <th style={{ padding: '8px' }}>Rôle / Accès</th>
            <th style={{ padding: '8px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {usersList.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>{u.nom}</td>
              <td style={{ padding: '8px', color: '#0284c7' }}>{u.role}</td>
              <td style={{ padding: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Retirer l'utilisateur « ${u.nom} » de la liste ?`)) {
                      setUsersList(usersList.filter(item => item.id !== u.id));
                    }
                  }}
                  style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                >
                  🗑️ Retirer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
              <h3 style={{ color: '#0284c7', marginTop: 0 }}>
                📘 Guide complet d'utilisation de SKYS ERP Solution
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
            charges: (400000 + totalDepensesReelles) * periodMultiplier,
            beneficeNet,
            role: currentUserRole
          }}
          nonLu={stockBasNonLues}
        />
    </div>
  );
}

export default App;