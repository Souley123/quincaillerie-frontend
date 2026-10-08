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
  'Version PC et version mobile ?',
  'Comment fonctionne la synchronisation ?',
  'Quels sont les modules avancés ?',
  'Guide complet d\'utilisation',
  'Comment choisir le moyen de paiement ?',
  'Comment inventorier ?',
  'Comment fonctionne l\'abonnement ?'
];

/* Suggestions proposées en priorité selon le rôle connecté :
   chacun voit d'abord les questions qui le concernent. */
const SUGGESTIONS_PAR_ROLE = {
  Administrateur: [
    'Guide de mon rôle',
    'Guide administrateur',
    'Quel est mon stock ?',
    'Quels articles sont en stock bas ?',
    'Quels sont les indicateurs financiers ?',
    'Comment gérer les utilisateurs ?'
  ],
  Caissier: [
    'Guide de mon rôle',
    'Guide caissier',
    'Comment faire une vente ?',
    'Comment choisir le moyen de paiement ?',
    'Comment créer un devis ?',
    'Que puis-je faire ?'
  ],
  Magasinier: [
    'Guide de mon rôle',
    'Guide magasinier',
    'Comment inventorier ?',
    'Comment ajouter un article ?',
    'Quels articles sont en stock bas ?',
    'Que puis-je faire ?'
  ]
};

const suggestionsPourRole = role =>
  SUGGESTIONS_PAR_ROLE[role] || SUGGESTIONS;

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
    motsCles: [/moyen de paiement/, /mode de paiement/, /mode de reglement/, /regler une vente/, /comment payer/],
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
    motsCles: [/imprim/, /pdf/, /export.*pdf/, /exporter.*pdf/, /convertir.*pdf/],
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
    id: 'deux-comptes-paiement',
    motsCles: [/mes paiements/, /recevoir les paiements/, /compte de paiement/, /reference de paiement/, /ou va l argent/, /paiement du commercant/, /paiement de l abonnement/, /clé kkiapay/, /cle kkiapay/, /mobile money de l entreprise/],
    reponse: [
      '💰 Vos paiements et ceux de la plateforme : deux comptes DIFFÉRENTS.',
      '',
      '1. Paiement de VOS VENTES → va sur VOTRE compte.',
      '• Renseignez vos propres références dans Configuration → « Moyens de paiement du commerçant » :',
      '  Mobile Money (Orange, MTN, Moov, Wave), compte bancaire (IBAN) et/ou votre clé Kkiapay.',
      '• Ces références sont propres à votre entreprise : aucun autre compte ne les voit.',
      '• Si aucune clé Kkiapay n\'est renseignée, le paiement en ligne est refusé et vous devez encaisser en espèces.',
      '',
      '2. Votre ABONNEMENT → va sur le compte de l\'ÉDITEUR (développeur).',
      '• L\'abonnement que vous payez pour utiliser SKYS ERP Solution est encaissé par l\'éditeur sur un compte séparé.',
      '• Vous ne voyez ni ne modifiez ce compte : il est réservé à la plateforme.',
      '',
      '🔐 En résumé : vos ventes vous appartiennent, l\'abonnement rémunère la plateforme. Les deux ne sont jamais mélangés.'
    ].join('\n')
  },
  {
    id: 'creer-article',
    motsCles: [/creer un article/, /comment ajouter/, /comment creer/, /nouvel article/, /nouvelle fiche/],
    reponse: '🛠️ Pour créer un article : ouvrez Catalogue, remplissez référence, désignation, fournisseur, famille, prix d\'achat, prix de vente et stocks, puis cliquez sur Ajouter.'
  },

  /* ---------- VERSIONS & MODULES (guide utilisateur) ---------- */
  {
    id: 'versions-modules-pc',
    motsCles: [/version pc/, /version ordinateur/, /interface web/, /application web/, /version bureau/, /acces navigateur/],
    reponse: [
      '🖥️ Étape 1 — Version PC',
      '• Interface web : accessible via navigateur, pratique pour les administrateurs et responsables.',
      '• Gestion multi-modules : Catalogue, Mouvements, Inventaire, Alertes, Rapports, Administration.'
    ].join('\n')
  },
  {
    id: 'versions-modules-mobile',
    motsCles: [/version mobile/, /application mobile/, /android/, /ios/, /smartphone/, /telephone/],
    reponse: [
      '📱 Étape 2 — Version Mobile',
      '• Application mobile : Android/iOS, adaptée aux magasiniers et vendeurs.',
      '• Scanner QR/barres : pour enregistrer entrées/sorties rapidement.',
      '• Inventaire en temps réel : possibilité de compter directement depuis le smartphone.'
    ].join('\n')
  },
  {
    id: 'versions-modules-synchronisation',
    motsCles: [/synchronisation/, /sync/, /pc et telephone/, /web et mobile/, /temps reel.*serveur/],
    reponse: [
      '🔄 Étape 3 — Synchronisation PC ↔ Téléphone',
      '• Base de données centralisée : tous les appareils se connectent au même serveur.',
      '• Cloud et API : synchronisation automatique entre web et mobile.',
      '• Avantage : cohérence des données, pas de doublons, accès partout.'
    ].join('\n')
  },
  {
    id: 'versions-modules-avances',
    motsCles: [/modules avances/, /facturation et caisse/, /crm/, /e commerce/, /ecommerce/, /boutique en ligne/],
    reponse: [
      '🚀 Étape 4 — Modules avancés',
      '• Facturation et caisse : relier ventes et stock.',
      '• CRM clients : suivi des clients et fidélisation.',
      '• E-commerce intégré : connecter stock à une boutique en ligne.'
    ].join('\n')
  },

  /* ---------- GUIDE COMPLET D'UTILISATION ---------- */
  {
    id: 'guide-acces-navigation',
    motsCles: [/guide complet/, /guide d utilisation/, /manuel d utilisation/, /guide utilisateur/, /acces et navigation/, /comment me connecter/, /premiere connexion/, /code temporaire/, /se deconnecter/, /navigation du menu/],
    reponse: [
      '📘 1. Accès et navigation',
      '• Connectez-vous avec votre email et votre code d\'accès.',
      '• Un nouveau compte reçoit un code temporaire à remplacer lors de la première connexion.',
      '• Le menu affiche uniquement les modules autorisés pour votre rôle.',
      '• Déconnectez-vous toujours après avoir terminé votre session.'
    ].join('\n')
  },
  {
    id: 'guide-tableau-de-bord',
    motsCles: [/tableau de bord/, /dashboard/, /benefice net/, /repartition du stock/, /famille de stock/],
    reponse: [
      '📘 2. Tableau de bord',
      '• Consultez le chiffre d\'affaires, les dépenses et le bénéfice net.',
      '• Analysez la répartition du stock par famille.',
      '• Utilisez les alertes de stock pour lancer un réapprovisionnement.'
    ].join('\n')
  },
  {
    id: 'guide-catalogue-stock',
    motsCles: [/catalogue et stock/, /fiche article/, /seuils/, /depot actif/, /recherche rapide/],
    reponse: [
      '📘 3. Catalogue et stock',
      '• Créez une fiche avec référence, désignation, fournisseur, prix et seuils.',
      '• Modifiez ou supprimez un article depuis le tableau du catalogue.',
      '• Utilisez Recherche rapide pour retrouver une référence ou un fournisseur.',
      '• Le dépôt actif est réglable dans Configuration.'
    ].join('\n')
  },
  {
    id: 'guide-caisse-transactions',
    motsCles: [/caisse et transactions/, /scanner la reference/, /ajouter au panier/, /mode de paiement.*valider/, /imprimer le recu/],
    reponse: [
      '📘 4. Caisse et transactions',
      '• Recherchez un article ou scannez sa référence avec le bouton caméra.',
      '• Ajoutez les articles au panier, vérifiez les quantités puis encaissez.',
      '• Choisissez le mode de paiement avant de valider la transaction.',
      '• Imprimez le reçu ou la facture depuis les actions de caisse.'
    ].join('\n')
  },
  {
    id: 'guide-mouvements-inventaire-achats',
    motsCles: [/inventaire/, /mouvements.*inventaire/, /motifs de mouvement/, /comptage physique/, /ecarts/, /receptionner/],
    reponse: [
      '📘 5. Mouvements, inventaire et achats',
      '• Enregistrez les entrées, sorties et motifs de mouvement.',
      '• Saisissez le comptage physique pour calculer les écarts.',
      '• Dans Stock Multi-dépôts, consultez et ajustez les quantités par site.',
      '• Activez le réapprovisionnement automatique au seuil minimum.',
      '• Dans Achats, créez une commande puis cliquez sur Réceptionner pour mettre le stock à jour.'
    ].join('\n')
  },
  {
    id: 'guide-clients-devis-transport',
    motsCles: [/clients.*devis/, /coordonnees clients/, /localisation des clients/, /planifier.*livraison/],
    reponse: [
      '📘 6. Clients, devis et transport',
      '• Enregistrez les coordonnées et la localisation des clients.',
      '• Créez un devis proforma, puis faites évoluer son statut.',
      '• Planifiez les livraisons avec responsable, véhicule, destination et frais.'
    ].join('\n')
  },
  {
    id: 'guide-paiements-justificatifs',
    motsCles: [/paiements et justificatifs/, /mobile money.*operateur/, /televerser/, /justificatifs et pieces/, /generer le qr/, /photos et pdf/],
    reponse: [
      '📘 7. Paiements et justificatifs',
      '• Sélectionnez Espèces, Carte, MTN, Orange, Moov ou Wave.',
      '• Pour Mobile Money, choisissez l\'opérateur puis générez le lien et le QR code.',
      '• Téléversez les photos et PDF dans Justificatifs & Pièces.',
      '• Ouvrez ou supprimez chaque fichier avec confirmation.'
    ].join('\n')
  },
  {
    id: 'guide-rapports-configuration',
    motsCles: [/rapports et configuration/, /comptabilite automatique/, /exporter csv/, /periode mensuelle/, /trimestrielle ou annuelle/],
    reponse: [
      '📘 8. Rapports et configuration',
      '• Comptabilité automatique regroupe recettes, dépenses, achats et résultat net.',
      '• Choisissez une période mensuelle, trimestrielle ou annuelle.',
      '• Utilisez Exporter CSV pour transmettre les indicateurs à la comptabilité.',
      '• Configurez la langue, la devise, le dépôt, les notifications et l\'affichage.'
    ].join('\n')
  },
  {
    id: 'guide-roles-securite',
    motsCles: [/roles et securite/, /role du caissier/, /role du magasinier/, /regle.*mot de passe/, /activite suspecte/, /verrouillage du compte/],
    reponse: [
      '📘 9. Rôles et sécurité',
      '• L\'Administrateur gère les comptes, les paramètres et les incidents.',
      '• Le Caissier travaille sur les ventes, clients, devis et paiements.',
      '• Le Magasinier gère le catalogue, les mouvements, l\'inventaire et les achats.',
      '• Les mots de passe doivent contenir 8 caractères, une majuscule, une minuscule et un chiffre.',
      '• Les activités suspectes sont journalisées et peuvent entraîner le verrouillage du compte.'
    ].join('\n')
  },
  {
    id: 'guide-en-cas-de-probleme',
    motsCles: [/en cas de probleme/, /ca ne marche pas/, /compte verrouille/, /permission camera/, /depot actif.*probleme/, /alerte email.*configuration/],
    reponse: [
      '📘 En cas de problème',
      'Vérifiez d\'abord votre rôle, le dépôt actif, la connexion Internet et les permissions de caméra.',
      'Pour un compte verrouillé, seul un administrateur peut le déverrouiller.',
      'Les alertes email et WhatsApp nécessitent une configuration du backend.'
    ].join('\n')
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
    motsCles: [/permission/, /permissions/, /droit d acces/, /acces aux modules/, /configurer la tva/, /gerer les comptes/, /governance/, /gouvernance/],
    reponse: [
      '🔒 Gouvernance et sécurité des accès :',
      '• L\'administrateur gère les permissions d\'accès aux modules sensibles de l\'ERP : Validation des finances, configuration de la TVA, gestion des abonnements globaux et création des comptes utilisateurs.',
      '• Les rôles sont compartimentés : le profil utilisateur standard est strictement limité aux opérations quotidiennes (caisse, ventes, saisie de stock de base, transport), ce qui verrouille de fait les accès aux modules administratifs et financiers.'
    ].join('\n')
  },
  {
    id: 'admin-modele-commercialisation',
    adminSeulement: true,
    motsCles: [/saas/, /on premise/, /commercialisation/, /hebergement/, /sous domaine/, /skyserp com/, /modele economique/],
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
    motsCles: [/licence/, /cgv/, /conditions generales/, /code source/, /support technique/, /developpement sur mesure/, /contrat de licence/],
    reponse: [
      '⚖️ Aspects commerciaux et légaux :',
      '• Licence & CGV : concession d\'un simple droit d\'utilisation (SaaS ou licence d\'exploitation), vente du code source exclue, sauf accord de rachat global.',
      '• Support technique : corrections de bugs incluses ; formations spécifiques et développements sur mesure sont facturés en supplément.',
      '• Paiement : passerelles adaptées à l\'encaissement automatisé des abonnements (Mobile Money, virements bancaires, cartes bancaires).'
    ].join('\n')
  },
  {
    id: 'admin-securite-comptes',
    adminSeulement: true,
    motsCles: [/verrouiller un compte/, /deverrouiller/, /journal des incidents/, /activite suspecte/, /tentative de connexion/, /securite des comptes/],
    reponse: [
      '🛡️ Sécurité et gestion des comptes (administrateur) :',
      '• Le module Sécurité & Incidents journalise les tentatives de connexion échouées et les activités suspectes.',
      '• Seul un administrateur peut verrouiller ou déverrouiller un compte utilisateur.',
      '• La création, la modification et la suppression des comptes sont réservées à l\'administrateur.'
    ].join('\n')
  },
  {
    id: 'admin-donnees-financieres',
    adminSeulement: true,
    motsCles: [/marge beneficiaire/, /resultat net/, /valider les finances/, /validation des finances/, /comptabilite generale/, /grand livre/],
    reponse: [
      '💰 Données financières sensibles (administrateur) :',
      '• Les indicateurs détaillés (bénéfice net, marges, résultat) sont accessibles uniquement à l\'administrateur.',
      '• La validation des finances et la configuration de la TVA sont des opérations réservées.',
      '• La comptabilité automatique regroupe recettes, dépenses, achats et résultat net par période.'
    ].join('\n')
  },

  /* =========================================================
     GUIDE COMPLET PAR RÔLE
     ---------------------------------------------------------
     Chaque rôle dispose d'un guide dédié décrivant EXACTEMENT
     les modules et actions qu'il est autorisé à utiliser, ainsi
     que les accès qui lui sont fermés.
     ========================================================= */

  /* ---------- GUIDE ADMINISTRATEUR ---------- */
  {
    id: 'guide-role-administrateur',
    adminSeulement: true,
    motsCles: [/guide administrateur/, /guide admin/, /guide de mon role/, /mes droits/, /que puis-je faire/, /guide mon metier/, /role administrateur/, /guide d utilisation complet/],
    reponse: [
      '📘 GUIDE COMPLET — ADMINISTRATEUR',
      'Vous avez accès à TOUS les modules de SKYS ERP Solution, sans restriction.',
      '',
      '1. Tableau de bord : chiffre d\'affaires, dépenses, bénéfice net réel, alertes et répartition du stock.',
      '2. Catalogue & Stock : création/modification/suppression des articles, seuils, dépôt actif.',
      '3. Stock Multi-dépôts : transferts entre dépôts, consultation des quantités par site.',
      '4. Caisse & Transactions : ventes, encaissements, reçus et factures.',
      '5. Mouvements & Inventaire : entrées/sorties, comptage physique, écarts.',
      '6. Réapprovisionnement & Achats : alertes de seuil, bons de commande, réception fournisseur.',
      '7. Dépenses & Charges : création, modification et suppression (module réservé à l\'administrateur).',
      '8. Devis & Proforma : TVA, remises, conditions, impression PDF.',
      '9. Clients, Crédits & Dettes : fiches clients, encours, règlements.',
      '10. Transport & Logistique : livraisons, véhicules, frais et abonnements.',
      '11. Paiements & Justificatifs : modes de règlement, Mobile Money, QR, pièces jointes.',
      '12. Comptabilité & Rapports : recettes, dépenses, résultat net, export CSV par période.',
      '13. Trésorerie & Épargne : suivi de caisse et réserves.',
      '14. Abonnements : formules, paliers, caméra espion et options avancées.',
      '15. Sécurité & Incidents : journal des tentatives échouées, captures caméra, blocage/déverrouillage des comptes, autorisation du module Dépenses.',
      '16. Configuration & Utilisateurs : paramètres généraux, TVA, devise, dépôt, création et désactivation des comptes (Administrateur, Caissier, Magasinier).',
      '',
      '🔐 En tant qu\'administrateur, vous êtes le SEUL à pouvoir gérer les finances, les comptes et la sécurité.'
    ].join('\n')
  },

  /* ---------- MODULES MÉTIER ---------- */
  {
    id: 'vente-gaz',
    motsCles: [/gaz/, /bouteille/, /butane/, /recharge/, /consigne/, /detendeur/, /livraison gaz/],
    reponse: [
      '🔥 Vente de Gaz :',
      '• Sélectionnez le format de bouteille (6, 9, 12, 15 ou 38 kg).',
      '• Choisissez la prestation : recharge, vente bouteille neuve, consigne (caution), reprise bouteille vide, livraison ou kit détendeur.',
      '• Saisissez la quantité et le prix unitaire ; le total se calcule automatiquement.',
      '• Cochez « Consigne bouteille » si le client laisse une caution (montant proposé automatiquement selon le format).',
      '• Renseignez le client, le moyen de paiement, le livreur et la destination pour la livraison.',
      '• Cliquez sur « Valider la vente » puis « 🖨️ Reçu » pour imprimer un reçu professionnel.'
    ].join('\n')
  },

  /* ---------- GUIDE CAISSIER ---------- */
  {
    id: 'guide-role-caissier',
    roles: ['Caissier'],
    motsCles: [/guide caissier/, /guide de mon role/, /mes droits/, /que puis-je faire/, /guide mon metier/, /role caissier/, /guide d utilisation complet/],
    reponse: [
      '📘 GUIDE COMPLET — CAISSIER',
      'Votre rôle couvre la vente et la relation client. Voici vos modules autorisés :',
      '',
      '1. Caisse & Transactions : recherchez un article, scannez sa référence, ajoutez au panier, encaissez.',
      '2. Vente de Gaz : bouteilles, recharge, consigne et livraison, avec reçu professionnel.',
      '3. Recherche : retrouvez rapidement une référence ou un client.',
      '4. Devis & Proforma : créez un devis, gérez la TVA, les remises et les conditions.',
      '5. Clients & Contacts : coordonnées, région, ville, district.',
      '6. Crédits & Dettes : suivez les encours et les règlements des clients.',
      '7. Paiements : Espèces, Carte, Virement, Mobile Money (MTN, Orange, Moov, Wave), Crédit.',
      '8. Notes : vos notes personnelles.',
      '',
      '🔒 ACCÈS FERMÉS À VOTRE RÔLE :',
      '• Dépenses & Charges : réservé à l\'administrateur (une tentative est filmée et signalée).',
      '• Finances détaillées (bénéfice net, marges) : réservées à l\'administrateur.',
      '• Catalogue, Mouvements, Inventaire, Achats : réservés au Magasinier.',
      '• Comptabilité, Trésorerie, Abonnements, Sécurité, Configuration : réservés à l\'administrateur.',
      '',
      '💡 Vous pouvez demander : « comment faire une vente ? », « comment choisir le moyen de paiement ? », « comment créer un devis ? ».'
    ].join('\n')
  },

  /* ---------- GUIDE MAGASINIER ---------- */
  {
    id: 'guide-role-magasinier',
    roles: ['Magasinier'],
    motsCles: [/guide magasinier/, /guide de mon role/, /mes droits/, /que puis-je faire/, /guide mon metier/, /role magasinier/, /guide d utilisation complet/],
    reponse: [
      '📘 GUIDE COMPLET — MAGASINIER',
      'Votre rôle couvre le stock et les approvisionnements. Voici vos modules autorisés :',
      '',
      '1. Catalogue & Stock : créez et modifiez les fiches articles, gérez les seuils.',
      '2. Stock Multi-dépôts : consultez et transférez les quantités entre dépôts.',
      '3. Recherche : retrouvez une référence ou un fournisseur.',
      '4. Mouvements : enregistrez les entrées, sorties et motifs.',
      '5. Réapprovisionnement : lancez les commandes dès qu\'un seuil est atteint.',
      '6. Achats & Fournisseurs : créez une commande puis cliquez sur Réceptionner pour mettre le stock à jour.',
      '7. Inventaire Physique : saisissez le comptage, l\'écart est calculé automatiquement.',
      '8. Notes : vos notes personnelles.',
      '',
      '🔒 ACCÈS FERMÉS À VOTRE RÔLE :',
      '• Dépenses & Charges : réservé à l\'administrateur (une tentative est filmée et signalée).',
      '• Finances détaillées (bénéfice net, marges) : réservées à l\'administrateur.',
      '• Caisse, Devis, Clients, Crédits, Paiements : réservés au Caissier.',
      '• Comptabilité, Trésorerie, Abonnements, Sécurité, Configuration : réservés à l\'administrateur.',
      '',
      '💡 Vous pouvez demander : « comment inventorier ? », « comment ajouter un article ? », « comment réceptionner une commande ? ».'
    ].join('\n')
  }
];

const ACCES_ADMIN_DENIED = [
  '🔒 Cette information est réservée à l\'administrateur.',
  'En tant qu\'utilisateur standard, vous pouvez consulter le guide des modules dans « Aide & Guide », ou demander une précision à un administrateur.'
].join('\n');

/* Règle de sécurité : le contenu admin n'est jamais divulgué à un utilisateur standard.
   - `adminSeulement: true`  : réservé à l'Administrateur (rétrocompatibilité).
   - `roles: ['Caissier']`   : réservé aux rôles listés (guide par métier). */
const baseAutorisee = (role, { inclureRestreints = false } = {}) =>
  BASE_CONNAISSANCES.filter(entry => {
    if (entry.adminSeulement) return role === 'Administrateur';
    if (Array.isArray(entry.roles)) return entry.roles.includes(role);
    if (inclureRestreints) return true;
    return true;
  });

const estAdministrateur = role => role === 'Administrateur';

/* Renvoie l'entrée qui a refusé l'accès (contenu réservé non accessible au
   rôle courant), afin d'orienter l'utilisateur sans rien divulguer. */
const entreeRefusee = (question, role) =>
  BASE_CONNAISSANCES.find(entry => {
    const restrictif = entry.adminSeulement || Array.isArray(entry.roles);
    if (!restrictif) return false;
    const autorise =
      (entry.adminSeulement && role === 'Administrateur') ||
      (Array.isArray(entry.roles) && entry.roles.includes(role));
    return !autorise && entry.motsCles.some(motif => motif.test(question));
  });

/* Message de refus adapté au rôle : un Caissier / Magasinier reçoit une
   orientation vers son propre guide métier, sans aucune donnée sensible. */
const refuserPourRole = role => {
  if (role === 'Caissier') {
    return [
      '🔒 Cette information est réservée à un autre rôle (administrateur ou magasinier).',
      'En tant que Caissier, demandez « guide caissier » pour voir tout ce que vous pouvez faire :',
      'caisse, ventes, clients, devis, paiements et crédits.'
    ].join('\n');
  }
  if (role === 'Magasinier') {
    return [
      '🔒 Cette information est réservée à un autre rôle (administrateur ou caissier).',
      'En tant que Magasinier, demandez « guide magasinier » pour voir tout ce que vous pouvez faire :',
      'catalogue, mouvements, inventaire, multi-dépôts, achats et réapprovisionnement.'
    ].join('\n');
  }
  return ACCES_ADMIN_DENIED;
};

/* Informations financières sensibles : bénéfice net, marges et résultat.
   Réservées à l'administrateur ; les autres rôles reçoivent un message d'orientation. */
const ACCES_FINANCES_DENIED = [
  '🔒 Les indicateurs financiers détaillés (bénéfice net, marges, résultat) sont réservés à l\'administrateur.',
  'Vous pouvez consulter le chiffre d\'affaires et les dépenses de votre activité dans le module Rapports & Indicateurs KPI.'
].join('\n');

/* Recherche dans la base par mots-clés.
   On ne prend plus la PREMIERE entrée qui matche (un motif générique comme
   /export/ capturait a tort « exporter l'inventaire ») : on evalue toutes les
   entrées autorisées et on garde celle qui obtient le meilleur score.
   Score = nombre de mots-clés qui matchent + specificite du meilleur motif. */
const rechercherBase = (question, role) => {
  const entrees = baseAutorisee(role);

  let meilleure = null;
  let meilleurScore = 0;

  for (const entry of entrees) {
    const correspondants = entry.motsCles.filter(motif => motif.test(question));
    if (!correspondants.length) continue;

    // Specificite : la longueur du texte du motif le plus long (plus c'est
    // long, plus le motif est precis, donc moins ambigu).
    const specificite = Math.max(
      ...correspondants.map(motif => String(motif.source).length)
    );
    const score = correspondants.length * 10 + specificite;

    if (score > meilleurScore) {
      meilleurScore = score;
      meilleure = entry;
    }
  }

  if (meilleure) return meilleure.reponse;

  // Un mot-clé réservé à un autre rôle est détecté : on ne divulgue rien,
  // on oriente simplement l'utilisateur vers ce qu'il peut consulter.
  const refus = entreeRefusee(question, role);
  return refus ? refuserPourRole(role) : null;
};

/* Salutation : uniquement si le message EST une salutation, ou la commence en
   restant court (ex. « bonjour », « salut ! », « bonjour ca va »).
   « bonjour, quel est mon stock ? » doit continuer vers la vraie question. */
const detecterSalutation = texte => {
  const mots = ['bonjour', 'salut', 'hello', 'coucou', 'bonsoir', 'salutations'];
  const nettoye = texte.trim();
  const premier = nettoye.split(' ')[0];
  if (!mots.includes(premier)) return false;
  // Une salutation seule (peut inclure « ca va », « comment allez vous », etc.)
  const reste = nettoye.split(' ').slice(1).filter(Boolean);
  const formules = new Set(['ca', 'va', 'comment', 'allez', 'vous', 'tu', 'vas', 'bien', 'merci']);
  return reste.length <= 4 && reste.every(mot => formules.has(mot));
};

/* Remerciement : uniquement un message court de remerciement, pour ne pas
   intercepter une question contenant le mot « merci » par hasard. */
const detecterMerci = texte => {
  const mots = ['merci', 'thanks', 'thank you', 'remerciement'];
  const motsTexte = texte.trim().split(' ').filter(Boolean);
  if (motsTexte.length > 5) return false;
  return mots.some(m => texte.includes(m));
};

function ChatbotAssistant({ contexte = {}, nonLu = 0 }) {
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [enCoursDeSaisie, setEnCoursDeSaisie] = useState(false);
  const messageAccueil = useMemo(() => {
    const role = contexte.role;
    const lignes = ["Bonjour 👋 Je suis l'assistant SKYS ERP Solution."];
    if (role) {
      lignes.push(`Vous êtes connecté avec le rôle : ${role}.`);
      lignes.push("Demandez « guide de mon rôle » pour voir tout ce que vous pouvez faire.");
    } else {
      lignes.push('Posez-moi une question sur votre stock, vos ventes, vos clients ou vos finances.');
    }
    return lignes.join('\n');
  }, [contexte.role]);
  const [messages, setMessages] = useState([
    {
      id: 'accueil',
      role: 'bot',
      texte: messageAccueil
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

    /* --- Rappel du rôle courant et des droits associés --- */
    const roleCourant = contexte.role || 'utilisateur';
    if (/quel est mon role|qui suis je|mon profil|mon niveau d acces|mes autorisations/.test(question)) {
      const guide = rechercherBase(`guide ${normaliser(roleCourant)}`, roleCourant);
      return [
        `👤 Vous êtes connecté en tant que : ${roleCourant}.`,
        guide ? '' : 'Demandez « guide de mon rôle » pour le détail complet.',
        guide || ''
      ].filter(Boolean).join('\n');
    }

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

    /* --- Finances : indicateurs sensibles réservés à l'administrateur --- */
    if (/benefice|beneficiaire|chiffre d affaires|ca |marge|resultat|financ/.test(question)) {
      if (!estAdministrateur(contexte.role)) return ACCES_FINANCES_DENIED;
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

    if (/inventori|inventaire|compter|ecart/.test(question)) {
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
              {suggestionsPourRole(contexte.role).slice(0, 3).map(suggestion => (
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
