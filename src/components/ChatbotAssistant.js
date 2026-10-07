import React, { useEffect, useMemo, useRef, useState } from 'react';

/* =========================================================
   CHATBOT ASSISTANT SKYS ERP Solution
   - Moteur de réponses local (aucune API externe requise)
   - Reçoit le contexte métier de l'application (stock,
     ventes, clients, dépenses, commandes) et y répond
     par des règles + recherche par mots-clés.
   ========================================================= */

const normaliser = texte =>
  String(texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatNombre = valeur => Number(valeur || 0).toLocaleString('fr-FR');

const SUGGESTIONS = [
  'Quel est mon stock ?',
  'Quels articles sont en stock bas ?',
  'Comment faire une vente ?',
  'Comment imprimer un devis ?',
  'Comment choisir le moyen de paiement ?',
  'Comment inventorier ?',
  'Comment fonctionne l\'abonnement ?'
];

/* =========================================================
   BASE DE CONNAISSANCES — GUIDE UTILISATEUR & FAQ
   ------------------------------------------------------------
   - ENTREE.ADMIN : contenu réservé à l'administrateur.
     Ces réponses ne sont jamais communiquées à un utilisateur
     standard (Caissier / Magasinier).
   ========================================================= */

const REPONSE_CODE_NON_RECONNU =
  'Code non reconnu. Ajoutez-le au catalogue ou saisissez la référence manuellement.';

const LISTE_PAIEMENTS =
  'Espèces, Carte Bancaire, Virement Bancaire, Mobile Money, Crédit / Paiement différé';

const BASE_CONNAISSANCES = [
  /* ---------- PARTIE 1 : UTILISATEUR STANDARD ---------- */
  {
    id: 'scan-code-inconnu',
    motsCles: [/code non reconnu/, /scan/, /scanner/, /code barre/, /code-barre/, /qr code/, /lecteur/, /inconnu/],
    reponse: [
      '📷 Lecture des codes (QR / code-barre) :',
      '• Le scanner analyse les codes en continu et de façon fluide.',
      '• Si aucun code n\'est détecté ou si l\'image est en cours de balayage, les erreurs techniques (NotFoundException) sont gérées silencieusement en arrière-plan, sans vous perturber.',
      `• Si un code est scanné mais introuvable dans le catalogue, le système s'arrête et affiche l'alerte : « ${REPONSE_CODE_NON_RECONNU} »`,
      '• Vous pouvez alors saisir la référence à la main ou créer l\'article.'
    ].join('\n')
  },
  {
    id: 'moyens-paiement',
    motsCles: [/moyen de paiement/, /mode de paiement/, /regler/, /reglement/, /payer/, /paiement/],
    reponse: [
      '💳 Moyens de paiement :',
      'Dans le Panier Actuel, une liste déroulante classique et professionnelle regroupe tous les modes de règlement :',
      LISTE_PAIEMENTS + '.',
      'Déroulez-la simplement et sélectionnez l\'option souhaitée pour finaliser la vente.'
    ].join('\n')
  },
  {
    id: 'tva-devis',
    motsCles: [/tva/, /taxe/, /ht/, /ttc/, /total ttc/],
    reponse: [
      '📄 Position de la TVA dans un devis ou un proforma :',
      '• Les articles, quantités et prix unitaires sont saisis dans le tableau, sous-total et taxes calculés en temps réel.',
      '• La structure affiche d\'abord le sous-total HT, puis la TVA (ex. 18 %).',
      '• Le Total TTC se situe tout en bas du tableau, juste sous la ligne de TVA.'
    ].join('\n')
  },
  {
    id: 'impression-pdf',
    motsCles: [/imprim/, /pdf/, /exporter/, /export/],
    reponse: [
      '🖨️ Impression / Export PDF :',
      '1. Cliquez sur le bouton « Imprimer / PDF ».',
      '2. Une règle CSS spécifique (@media print) s\'active et masque automatiquement tous les modules superflus, la barre latérale de navigation et l\'en-tête de l\'application.',
      '3. Seul le document épuré est imprimé ou converti en PDF.'
    ].join('\n')
  },
  {
    id: 'champs-obligatoires-stock',
    motsCles: [/champ obligatoire/, /obligatoire/, /requis/, /formulaire de stock/, /saisie libre/],
    reponse: [
      '🛠️ Saisie des articles (quincaillerie de fixation) :',
      '• Tous les champs du formulaire sont obligatoires, à la seule exception du champ Code-barre qui reste facultatif.',
      '• Les listes déroulantes facilitent la recherche, mais les champs acceptent une saisie libre intégrale si l\'article n\'est pas répertorié.'
    ].join('\n')
  },
  {
    id: 'multi-depots',
    motsCles: [/multi depot/, /transfert/, /d un depot/, /depot a consulter/, /vers un autre depot/, /stocker entre/],
    reponse: [
      '🏬 Stock Multi-dépôts :',
      '• Les champs modifiables : Article à transférer, Depuis dépôt, Vers un autre dépôt.',
      '• Champ verrouillé : « Dépôt à consulter » reste fixe et sécurisé pour éviter toute confusion de lecture.',
      '• Un champ additionnel affiche en temps réel la quantité de stock exacte de chaque article disponible dans le dépôt.'
    ].join('\n')
  },
  {
    id: 'transport-champs',
    motsCles: [/nombre de voyage/, /immatriculation/, /vehicule/, /voyage/],
    reponse: [
      '🚚 Transport et Logistique :',
      '• Nombre de voyage : champ numérique de saisie.',
      '• Immatriculation du véhicule : champ interactif et cliquable qui ouvre rapidement les informations ou l\'historique du véhicule.'
    ].join('\n')
  },
  {
    id: 'abonnement',
    motsCles: [/abonnement/, /souscrire/, /forfait/],
    reponse: [
      '🎫 Abonnement :',
      '• Le module Abonnement intègre la liste déroulante complète des modes de règlement : ' + LISTE_PAIEMENTS + '.',
      '• Abonnement Unique Transporteur : forfait dédié aux professionnels du transport, fixé à 5 000 FCFA par mois, qui active leurs droits d\'accès logistiques.',
      '• Marche à suivre : ouvrez le module Abonnement, sélectionnez le forfait unique transporteur, puis réglez en choisissant votre moyen de paiement dans la liste déroulante.'
    ].join('\n')
  },
  {
    id: 'creer-article',
    motsCles: [/creer un article/, /comment ajouter/, /comment creer/, /nouvel article/, /nouvelle fiche/],
    reponse: '🛠️ Pour créer un article : ouvrez Catalogue, remplissez référence, désignation, fournisseur, famille, prix d\'achat, prix de vente et stocks, puis cliquez sur Ajouter.'
  },

  /* ---------- PARTIE 2 : ADMINISTRATEUR UNIQUEMENT ---------- */
  {
    id: 'admin-reappro-auto',
    adminSeulement: true,
    motsCles: [/reapprovisionnement/, /reappro/, /rupture de stock/, /seuil d alerte/, /bon de commande/, /passer commande/],
    reponse: [
      '🔗 Lien automatique Stock ➔ Achats & Fournisseurs :',
      '• Le système surveille en permanence les seuils d\'alerte des articles.',
      '• Dès qu\'un article atteint la rupture de stock, un bouton de commande / réapprovisionnement apparaît.',
      '• Un clic sur ce bouton transmet instantanément les données de l\'article (références et quantités nécessaires) vers le module Achats & Fournisseurs, qui génère et pré-remplit automatiquement le bon de commande.'
    ].join('\n')
  },
  {
    id: 'admin-roles',
    adminSeulement: true,
    motsCles: [/permission/, /role/, /roles/, /droit d acces/, /acces aux modules/, /comptabilite/, /configurer la tva/],
    reponse: [
      '🔒 Gouvernance et sécurité des accès :',
      '• L\'administrateur gère les permissions d\'accès aux modules sensibles de l\'ERP : Validation des finances, configuration de la TVA, gestion des abonnements globaux et création des comptes utilisateurs.',
      '• Les rôles sont compartimentés : le profil utilisateur standard est strictement limité aux opérations quotidiennes (caisse, ventes, saisie de stock de base, transport), ce qui verrouille de fait les accès aux modules administratifs et financiers.'
    ].join('\n')
  },
  {
    id: 'admin-modele-commercialisation',
    adminSeulement: true,
    motsCles: [/saas/, /cloud/, /on premise/, /sur site/, /commercialisation/, /hebergement/, /sous domaine/, /skyserp com/],
    reponse: [
      '🚀 Modèle de commercialisation SKYS ERP Solution :',
      '• Option A — SaaS (Cloud, recommandé) : hébergement sur serveur cloud centralisé, un accès sécurisé par sous-domaine dédié (ex. client1.skyserp.com). Updates centralisés, maintenance facilitée, facturation automatisée (comme le forfait transporteur à 5 000 FCFA/mois).',
      '• Option B — Installation locale (On-Premise) : installation sur le serveur ou l\'ordinateur de la quincaillerie. Verrous d\'abonnement en cas d\'impayé plus complexes, et déploiement manuel des mises à jour correctives.'
    ].join('\n')
  },
  {
    id: 'admin-multi-tenant',
    adminSeulement: true,
    motsCles: [/multi tenant/, /multi tenant/, /company id/, /tenant id/, /isolation des donnees/, /donnees des autres/, /confidentialite entre clients/],
    reponse: [
      '🏢 Isolation des données (Multi-Tenant) :',
      '• Clé d\'identification unique : un identifiant d\'entreprise (company_id / tenant_id) est intégré dans l\'ensemble des collections (Clients, Ventes, Stocks, Factures, Devis…).',
      '• Filtrage automatique : dès la connexion, l\'application applique un filtre strict dans le code source pour ne charger et n\'afficher que les lignes rattachées au company_id de l\'utilisateur.'
    ].join('\n')
  },
  {
    id: 'admin-onboarding',
    adminSeulement: true,
    motsCles: [/onboarding/, /nouvel acheteur/, /nouveau client/, /creer une entreprise/, /raison sociale/, /profil entreprise/],
    reponse: [
      '🚀 Automatisation de l\'Onboarding :',
      '• Création du profil entreprise : raison sociale, devise (ex. FCFA), taux de TVA (ex. 18 %), logo personnalisé pour l\'édition des documents.',
      '• Création du compte Administrateur client : identifiants sécurisés pour le gérant, qui administre ensuite ses propres employés et utilisateurs standard.',
      '• Activation de l\'abonnement : rattachement au module d\'abonnement et activation de la formule choisie.'
    ].join('\n')
  },
  {
    id: 'admin-licence-cgv',
    adminSeulement: true,
    motsCles: [/licence/, /cgv/, /contrat/, /code source/, /support technique/, /formation/, /developpement sur mesure/],
    reponse: [
      '⚖️ Aspects commerciaux et légaux :',
      '• Licence & CGV : concession d\'un simple droit d\'utilisation (SaaS ou licence d\'exploitation), vente du code source exclue, sauf accord de rachat global.',
      '• Support technique : corrections de bugs incluses ; formations spécifiques et développements sur mesure sont facturés en supplément.',
      '• Paiement : passerelles adaptées à l\'encaissement automatisé des abonnements (Mobile Money, virements bancaires, cartes bancaires).'
    ].join('\n')
  }
];

const ACCES_ADMIN_DENIED = [
  '🔒 Cette information est réservée à l\'administrateur.',
  'En tant qu\'utilisateur standard, vous pouvez consulter le guide des modules dans « Aide & Guide », ou demander une précision à un administrateur.'
].join('\n');

/* Règle de sécurité : le contenu admin n'est jamais divulgué à un utilisateur standard. */
const baseAutorisee = role =>
  BASE_CONNAISSANCES.filter(entry => !entry.adminSeulement || role === 'Administrateur');

const rechercherBase = (question, role) => {
  const entrees = baseAutorisee(role);
  for (const entry of entrees) {
    if (entry.motsCles.some(motif => motif.test(question))) return entry.reponse;
  }
  // Un mot-clé réservé à l'admin est détecté chez un utilisateur standard :
  // on ne divulgue rien, on oriente simplement.
  const adminBloque = BASE_CONNAISSANCES.find(
    entry => entry.adminSeulement && entry.motsCles.some(motif => motif.test(question))
  );
  return adminBloque ? ACCES_ADMIN_DENIED : null;
};

const detecterSalutation = texte => {
  const mots = ['bonjour', 'salut', 'hello', 'coucou', 'bonsoir', 'salutations'];
  return mots.some(m => texte.startsWith(m) || texte === m);
};

const detecterMerci = texte => {
  const mots = ['merci', 'thanks', 'thank you', 'remerciement'];
  return mots.some(m => texte.includes(m));
};

function ChatbotAssistant({ contexte = {}, nonLu = 0 }) {
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [enCoursDeSaisie, setEnCoursDeSaisie] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'accueil',
      role: 'bot',
      texte:
        'Bonjour 👋 Je suis l\'assistant SKYS ERP Solution.\nPosez-moi une question sur votre stock, vos ventes, vos clients ou vos finances.'
    }
  ]);

  const listeRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (listeRef.current) {
      listeRef.current.scrollTop = listeRef.current.scrollHeight;
    }
  }, [messages, ouvert]);

  useEffect(() => {
    if (ouvert) inputRef.current?.focus();
  }, [ouvert, enCoursDeSaisie]);

  /* ---------------------------------------------------------
     Réponse construite à partir du contexte métier
     --------------------------------------------------------- */
  const repondre = questionBrute => {
    const question = normaliser(questionBrute);
    if (!question) return 'Je n\'ai pas bien compris votre question. Réessayez avec un autre mot-clé.';

    const produits = contexte.produits || [];
    const clients = contexte.clients || [];
    const commandes = contexte.commandes || [];
    const depenses = contexte.depenses || [];
    const transports = contexte.transports || [];

    const stockTotal = produits.reduce((total, p) => total + (Number(p.quantiteStock) || 0), 0);
    const stockBas = produits.filter(p => Number(p.quantiteStock) <= Number(p.minStock));

    /* --- Guide utilisateur & FAQ (avant les règles génériques) --- */
    const reponseBase = rechercherBase(question, contexte.role);
    if (reponseBase) return reponseBase;

    /* --- Stock bas --- */
    if (/stock bas|rupture|alerte stock|reappro/.test(question)) {
      if (!stockBas.length) {
        return '✅ Aucun article sous le seuil d\'alerte. Votre stock est confortable pour le moment.';
      }
      const lignes = stockBas
        .slice(0, 5)
        .map(p => `• ${p.ref} — ${p.nom} : ${p.quantiteStock} / seuil ${p.minStock}`)
        .join('\n');
      return `⚠️ ${stockBas.length} article(s) sous le seuil :\n${lignes}\n\nOuvrez le module Réapprovisionnement pour générer les commandes fournisseurs.`;
    }

    /* --- Valorisation du stock --- */
    if (/valeur du stock|valorisation|combien.*stock|etat du stock|inventaire global/.test(question)) {
      const valeur = produits.reduce((total, p) => total + (Number(p.prix) * (Number(p.quantiteStock) || 0)), 0);
      return `📦 Votre catalogue compte ${produits.length} article(s), soit ${formatNombre(stockTotal)} unité(s) en stock.\nValeur totale du stock : ${formatNombre(valeur)} FCFA.`;
    }

    /* --- Produits spécifiques --- */
    if (/quel produit|quel article|liste des articles|produits disponibles/.test(question)) {
      if (!produits.length) return 'Votre catalogue est vide. Ajoutez un premier article dans le module Catalogue.';
      const lignes = produits
        .slice(0, 5)
        .map(p => `• ${p.ref} — ${p.nom} (${p.quantiteStock} u.)`)
        .join('\n');
      return `Voici les articles du catalogue :\n${lignes}`;
    }

    /* --- Recherche d'un article par nom / référence --- */
    if (question.length > 3) {
      const trouve = produits.find(p =>
        normaliser(p.ref).includes(question) || normaliser(p.nom).includes(question)
      );
      if (trouve) {
        return `🔎 ${trouve.ref} — ${trouve.nom}\nStock : ${trouve.quantiteStock} unité(s)\nPrix de vente : ${formatNombre(trouve.prix)} FCFA\nFournisseur : ${trouve.fournisseur || 'non renseigné'}`;
      }
    }

    /* --- Ventes / caisse --- */
    if (/vente|facture|caissier|caisse|panier|encaiss/.test(question)) {
      return [
        '🛒 Pour enregistrer une vente :',
        '1. Ouvrez le module Caisse & Transactions.',
        '2. Scannez le code-barres ou sélectionnez l\'article.',
        '3. Ajustez les quantités dans le panier.',
        '4. Choisissez le moyen de paiement puis validez.'
      ].join('\n');
    }

    /* --- Finances --- */
    if (/benefice|beneficiaire|chiffre d affaires|ca |marge|resultat|financ/.test(question)) {
      const benefice = Number(contexte.beneficeNet || 0);
      return [
        '💰 Synthèse financière :',
        `• Chiffre d'affaires : ${formatNombre(contexte.chiffreAffaires)} FCFA`,
        `• Charges : ${formatNombre(contexte.charges)} FCFA`,
        `• Bénéfice net : ${formatNombre(benefice)} FCFA`
      ].join('\n');
    }

    /* --- Dépenses --- */
    if (/depense|charge|facture electricite|loyer/.test(question)) {
      if (!depenses.length) return 'Aucune dépense enregistrée pour le moment.';
      const total = depenses.reduce((s, d) => s + Number(d.montant || 0), 0);
      return `💸 ${depenses.length} dépense(s) enregistrée(s) pour un total de ${formatNombre(total)} FCFA.\nLa plus récente : ${depenses[depenses.length - 1]?.libelle || '—'}.`;
    }

    /* --- Commandes fournisseurs --- */
    if (/commande|fournisseur|achat|reception/.test(question)) {
      const ouvertes = commandes.filter(c => c.statut !== 'Réceptionnée');
      if (!ouvertes.length) return '✅ Aucune commande en attente. Toutes les commandes ont été réceptionnées.';
      const lignes = ouvertes.slice(0, 5).map(c => `• ${c.ref} — ${c.quantite} u. chez ${c.fournisseur || '—'}`).join('\n');
      return `🧾 ${ouvertes.length} commande(s) en attente :\n${lignes}\n\nRéceptionnez-les dans le module Achats & Fournisseurs.`;
    }

    /* --- Clients --- */
    if (/client|debiteur|credit|dette/.test(question)) {
      return `👤 ${clients.length} client(s) enregistré(s). Gérez les coordonnées dans le module Clients & Contacts et les dettes dans Crédits & Dettes.`;
    }

    /* --- Transport --- */
    if (/transport|livraison|expedition|camion|vehicule/.test(question)) {
      const frais = transports.reduce((s, t) => s + Number(t.frais || 0), 0);
      return `🚚 ${transports.length} expédition(s) enregistrée(s), frais cumulés : ${formatNombre(frais)} FCFA.\nLe module Transport & Logistique permet de planifier les livraisons et de consulter les fiches véhicules.`;
    }

    if (/inventaire|compter|ecart/.test(question)) {
      return '📦 Pour inventorier : ouvrez Inventaire Physique, choisissez le mode (auto ou saisie libre), saisissez la quantité comptée et l\'écart est calculé automatiquement.';
    }

    if (/aide|comment ca marche|guide|tuto/.test(question)) {
      return '📘 Le module Aide & Guide contient le manuel complet. Vous pouvez aussi me demander : le stock, les ventes, les bénéfices, les commandes ou les clients.';
    }

    if (/devis|proforma/.test(question)) {
      return '📄 Pour créer un devis : ouvrez Devis & Proforma, renseignez client, quantité, prix unitaire, remise, TVA et conditions, puis cliquez sur Générer.';
    }

    if (/securite|incident|connexion|mot de passe/.test(question)) {
      return '🛡️ Le module Sécurité & Incidents journalise les tentatives de connexion échouées et permet le verrouillage d\'un compte. Les mots de passe doivent contenir 8 caractères, une majuscule, une minuscule et un chiffre.';
    }

    return [
      "Je n'ai pas de réponse précise pour cette question, mais je peux vous aider sur :",
      '• le stock et les articles en alerte',
      '• la caisse et les ventes',
      '• les bénéfices et les dépenses',
      '• les commandes fournisseurs',
      '• les clients et les crédits',
      '• la manière d\'utiliser un module',
      '• la lecture des codes-barres et les moyens de paiement',
      '• l\'impression et l\'export PDF des devis'
    ].join('\n');
  };

  const envoyer = texte => {
    const message = String(texte || '').trim();
    if (!message) return;

    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', texte: message }]);
    setSaisie('');
    setEnCoursDeSaisie(false);

    let reponse;
    const normalisee = normaliser(message);
    if (detecterSalutation(normalisee)) {
      reponse = 'Bonjour 👋 Comment puis-je vous aider aujourd\'hui ? Vous pouvez me demander votre stock, vos ventes ou vos bénéfices.';
    } else if (detecterMerci(normalisee)) {
      reponse = 'Avec plaisir 😊 Besoin d\'autre chose ?';
    } else {
      reponse = repondre(message);
    }

    // Petit délai : donne l'impression d'une saisie en cours
    setTimeout(() => {
      setMessages(prev => [...prev, { id: `b-${Date.now()}`, role: 'bot', texte: reponse }]);
    }, 250);
  };

  const totalNonLu = useMemo(() => (ouvert ? 0 : nonLu), [ouvert, nonLu]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(v => !v)}
        aria-label={ouvert ? 'Fermer l\'assistant' : 'Ouvrir l\'assistant'}
        title="Assistant SKYS ERP Solution"
        style={{
          position: 'fixed',
          right: '18px',
          bottom: '18px',
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: ouvert ? '#dc2626' : '#0284c7',
          color: '#fff',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
          zIndex: 9999
        }}
      >
        {ouvert ? '✕' : '💬'}
        {totalNonLu > 0 && !ouvert && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '20px',
              height: '20px',
              padding: '0 5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#dc2626',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '999px'
            }}
          >
            1
          </span>
        )}
      </button>

      {ouvert && (
        <div
          style={{
            position: 'fixed',
            right: '18px',
            bottom: '82px',
            width: '340px',
            maxWidth: 'calc(100vw - 36px)',
            height: '460px',
            maxHeight: 'calc(100vh - 110px)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 12px 34px rgba(0,0,0,0.24)',
            overflow: 'hidden',
            zIndex: 9998,
            fontFamily: "'Segoe UI', sans-serif"
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              color: '#fff',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '22px' }}>🤖</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: '14px', display: 'block' }}>Assistant SKYS ERP Solution</strong>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>En ligne · réponse instantanée</span>
            </div>
            <button
              type="button"
              onClick={() => setMessages([])}
              title="Effacer la conversation"
              aria-label="Effacer la conversation"
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
            >
              🧹
            </button>
          </div>

          <div ref={listeRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#f8fafc' }}>
            {messages.length === 0 && (
              <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                Conversation effacée. Posez une nouvelle question.
              </p>
            )}

            {messages.map(message => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '9px'
                }}
              >
                <div
                  style={{
                    maxWidth: '84%',
                    padding: '9px 11px',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    backgroundColor: message.role === 'user' ? '#0284c7' : '#fff',
                    color: message.role === 'user' ? '#fff' : '#1e293b',
                    border: message.role === 'user' ? 'none' : '1px solid #e2e8f0'
                  }}
                >
                  {message.texte}
                </div>
              </div>
            ))}

            {enCoursDeSaisie && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '9px 11px',
                    borderRadius: '10px',
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    fontSize: '12.5px',
                    color: '#64748b'
                  }}
                >
                  …
                </div>
              </div>
            )}
          </div>

          {messages.length > 1 && (
            <div style={{ padding: '6px 10px 0', display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0' }}>
              {SUGGESTIONS.slice(0, 3).map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => envoyer(suggestion)}
                  style={{
                    fontSize: '10.5px',
                    padding: '4px 8px',
                    borderRadius: '999px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#fff',
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={e => {
              e.preventDefault();
              envoyer(saisie);
            }}
            style={{ display: 'flex', gap: '6px', padding: '10px', borderTop: '1px solid #e2e8f0' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={saisie}
              onChange={e => setSaisie(e.target.value)}
              placeholder="Posez votre question..."
              aria-label="Votre question à l'assistant"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '9px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px'
              }}
            />
            <button
              type="submit"
              aria-label="Envoyer"
              style={{
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0 13px',
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatbotAssistant;
