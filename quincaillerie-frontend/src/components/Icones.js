/**
 * BIBLIOTHÈQUE D'ICÔNES PROFESSIONNELLES
 * ------------------------------------------------------------
 * Point unique de vérité pour les icônes de l'application.
 * Chaque icône est un SVG vectoriel (lucide-react) : net à toutes
 * les tailles, personnalisable (couleur, épaisseur) et accessible
 * (aria-hidden par défaut, car décoratif).
 *
 * Remplacer un emoji revient à utiliser <Icone nom="..."/> au lieu
 * du caractère Unicode. Les composants nommés (TableauDeBord, Stock…)
 * permettent aussi un import direct : import { Icone } from './Icones'.
 */
import {
  LayoutDashboard, Wrench, Warehouse, Banknote, Flame, Search, Calendar,
  Bell, Receipt, TrendingDown, FileText, Package, Truck, User, Folder,
  CreditCard, Tag, Calculator, BarChart3, Shield, Lock, LockKeyhole,
  Settings, NotebookPen, Smartphone, HelpCircle, Menu, X, CheckCircle2,
  AlertTriangle, ShieldAlert, PackageX, TrendingUp, PieChart, MapPin,
  ClipboardList, ShoppingCart, Printer, Car, Archive, KeyRound,
  Radio, Battery, Wifi, Lightbulb, Compass, Magnet, Ruler, Activity,
  FolderTree, Megaphone, Users, Palette, Accessibility, Volume2, Trash2,
  BookOpen, Eye, EyeOff, Camera, Database, Globe, Mail, Phone, MessageCircle,
  Star, Award, Target, Layers, Filter, Monitor, Home, MoreVertical,
  FileCheck, Receipt as ReceiptIcon, Coins, Wallet, Boxes, UserPlus,
  UserCheck, ChevronRight, ChevronDown, ArrowRight, ArrowLeft, Info, Loader2,
  Zap, RefreshCw
} from 'lucide-react';

/**
 * Table de correspondance : nom sémantique → composant d'icône.
 * Centraliser ici garantit la cohérence visuelle sur tout le site.
 */
const ICONES = {
  // Navigation principale (menu latéral)
  tableauDeBord: LayoutDashboard,
  stock: Wrench,
  multiDepots: Warehouse,
  caisse: Banknote,
  gaz: Flame,
  recherche: Search,
  mouvements: Calendar,
  reappro: Bell,
  achats: Receipt,
  depenses: TrendingDown,
  devis: FileText,
  inventaire: Package,
  transport: Truck,
  clients: User,
  credits: Banknote,
  dossiers: Folder,
  paiements: CreditCard,
  abonnements: Tag,
  comptabilite: Calculator,
  rapports: BarChart3,
  securite: Shield,
  tresorerie: LockKeyhole,
  parametres: Settings,
  notes: NotebookPen,
  versions: Smartphone,
  aide: HelpCircle,

  // Interface générale
  fermer: X,
  menu: Menu,
  calendrier: Calendar,
  eclair: Zap,
  rafraichir: RefreshCw,
  succes: CheckCircle2,
  avertissement: AlertTriangle,
  alerteSecurite: ShieldAlert,
  rupture: PackageX,
  tendanceHausse: TrendingUp,
  tendanceBaisse: TrendingDown,
  graphiqueCirculaire: PieChart,
  position: MapPin,
  liste: ClipboardList,
  commander: ShoppingCart,
  imprimer: Printer,
  vehicule: Car,
  document: FileText,
  archive: Archive,
  cle: KeyRound,
  verrou: Lock,
  capteurs: Radio,
  batterie: Battery,
  reseau: Wifi,
  luminosite: Lightbulb,
  orientation: Compass,
  mouvement: Activity,
  magnetometre: Magnet,
  proximite: Ruler,
  navigationTerritoire: FolderTree,
  annonce: Megaphone,
  utilisateurs: Users,
  apparence: Palette,
  accessibilite: Accessibility,
  lecture: Volume2,
  retirer: Trash2,
  guide: BookOpen,
  oeil: Eye,
  oeilMasque: EyeOff,
  camera: Camera,
  base: Database,
  monde: Globe,
  email: Mail,
  telephone: Phone,
  message: MessageCircle,
  etoile: Star,
  recompense: Award,
  objectif: Target,
  calques: Layers,
  filtre: Filter,
  ecran: Monitor,
  accueil: Home,
  plus: MoreVertical,
  fichierValide: FileCheck,
  recu: ReceiptIcon,
  pieces: Coins,
  portefeuille: Wallet,
  boites: Boxes,
  ajouterUtilisateur: UserPlus,
  utilisateurValide: UserCheck,
  suivant: ChevronRight,
  bas: ChevronDown,
  flecheDroite: ArrowRight,
  flecheGauche: ArrowLeft,
  info: Info,
  chargement: Loader2
};

/**
 * Composant d'icône générique.
 * @param {string} nom     clé sémantique (voir ICONES)
 * @param {number} taille  taille en pixels (défaut 16)
 * @param {number} epaisseur épaisseur du trait (défaut 2)
 * @param {string} couleur couleur du trait (défaut : hérite du texte)
 */
export const Icone = ({ nom, taille = 16, epaisseur = 2, couleur = 'currentColor', style, ...reste }) => {
  const Composant = ICONES[nom];
  if (!Composant) return null;

  return (
    <Composant
      size={taille}
      strokeWidth={epaisseur}
      color={couleur}
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}
      {...reste}
    />
  );
};

/**
 * Icônes de marque des fournisseurs d'identité (SVG inline).
 * Dessinées à la main en vectoriel : aucune dépendance externe, aucune
 * police à charger, et rendu net à toutes les tailles. Chaque marque
 * conserve sa couleur officielle sur un fond rond discret.
 */
const MARQUE_STYLE = { flexShrink: 0, verticalAlign: 'middle' };

export const IconeGoogle = ({ taille = 16 }) => (
  <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false" style={MARQUE_STYLE}>
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
  </svg>
);

export const IconeFacebook = ({ taille = 16 }) => (
  <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false" style={MARQUE_STYLE}>
    <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12Z" />
  </svg>
);

export const IconeWhatsApp = ({ taille = 16 }) => (
  <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false" style={MARQUE_STYLE}>
    <path fill="#25D366" d="M12 0a12 12 0 0 0-10.3 18.1L0 24l6.1-1.6A12 12 0 1 0 12 0Zm0 22a10 10 0 0 1-5.1-1.4l-.4-.2-3.6.9 1-3.5-.2-.4A10 10 0 1 1 12 22Zm5.5-7.5c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2l-1 1.2c-.2.2-.4.3-.6.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.8s1.2 3.3 1.4 3.5c.1.2 2.4 3.6 5.7 5 .8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.8-.7 2.1-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.3Z" />
  </svg>
);

export const IconeLinkedIn = ({ taille = 16 }) => (
  <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false" style={MARQUE_STYLE}>
    {/* Logo LinkedIn officiel : le « in » blanc sur fond bleu #0A66C2.
        (Le dessin précédent était celui de Facebook — un « f » — seule la
        couleur avait été changée, d'où l'icône qui ne concordait pas.) */}
    <rect width="24" height="24" rx="4" fill="#0A66C2" />
    <path fill="#FFFFFF" d="M6.94 8.5H4.06v10.44h2.88V8.5ZM5.5 4.06a1.69 1.69 0 1 0 0 3.38 1.69 1.69 0 0 0 0-3.38ZM20 13.13c0-3.09-1.65-4.53-3.85-4.53-1.78 0-2.57.98-3.02 1.66V8.5h-2.88v10.44h2.88v-5.7c0-1.5.28-2.96 2.14-2.96 1.84 0 1.86 1.72 1.86 3.05v5.61H20v-5.81Z" />
  </svg>
);

export const MARQUES = {
  Google: IconeGoogle,
  Facebook: IconeFacebook,
  WhatsApp: IconeWhatsApp,
  LinkedIn: IconeLinkedIn
};

/* Pastilles de marque « Mobile Money » : formes vectorielles simples
   (goutte, ondes, losange) aux couleurs officielles des opérateurs. */
export const IconeWave = ({ taille = 16 }) => (
  <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false" style={MARQUE_STYLE}>
    <path fill="#1DC8F0" d="M2 15c3-6 6-9 9-9s5 2.5 5 5.5-2 4.5-4 4.5-3-1-3-2.5 1-2 2-2" fillOpacity="0" stroke="#1DC8F0" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="18.5" cy="15.5" r="2" fill="#1DC8F0" />
  </svg>
);

export const IconeOrange = ({ taille = 16 }) => (
  <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false" style={MARQUE_STYLE}>
    <rect x="3" y="3" width="18" height="18" rx="3" fill="#FF7900" />
    <rect x="8" y="8" width="8" height="8" rx="1" fill="#fff" />
  </svg>
);

export const IconeMoov = ({ taille = 16 }) => (
  <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false" style={MARQUE_STYLE}>
    <circle cx="12" cy="12" r="9" fill="#0A7C42" />
    <path d="M7 14c2-4 4-4 5-1s3 3 5-1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IconeMtn = ({ taille = 16 }) => (
  <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false" style={MARQUE_STYLE}>
    <rect x="2" y="6" width="20" height="12" rx="6" fill="#FFCC00" />
    <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#111">MTN</text>
  </svg>
);

/* Table des opérateurs « Mobile Money » pour l'interface de paiement. */
export const MOBILE_MONEY = {
  wave: IconeWave,
  orange: IconeOrange,
  moov: IconeMoov,
  mtn: IconeMtn
};

/**
 * Composant enveloppe pour un opérateur Mobile Money identifié par sa clé.
 * Évite l'accès dynamique « <MOBILE_MONEY.x /> » qui viole la règle
 * react/jsx-pascal-case.
 */
export const PastilleMobileMoney = ({ operateur, taille = 16 }) => {
  const Composant = MOBILE_MONEY[operateur];
  return Composant ? <Composant taille={taille} /> : null;
};

export default ICONES;
