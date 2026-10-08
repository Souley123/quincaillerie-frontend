// Test du moteur du chatbot : on extrait la base + les fonctions du fichier
// source, puis on interroge par rôle pour vérifier les restrictions.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Chemin robuste : base sur la position du fichier de test, pas sur le cwd
// (le test doit tourner depuis n'importe quel dossier).
const racine = path.dirname(fileURLToPath(import.meta.url));
const cheminSource = path.join(
  racine,
  'quincaillerie-frontend',
  'src',
  'components',
  'ChatbotAssistant.js'
);

if (!fs.existsSync(cheminSource)) {
  console.error('Source introuvable : ' + cheminSource);
  process.exit(1);
}

const src = fs.readFileSync(cheminSource, 'utf8');

// On ne garde que la partie données + logique pure (pas le composant React).
const debut = src.indexOf('const normaliser');
const fin = src.indexOf('function ChatbotAssistant');
if (debut === -1 || fin === -1 || fin <= debut) {
  console.error(
    'Extraction impossible : les bornes "const normaliser" / "function ChatbotAssistant" sont introuvables.'
  );
  process.exit(1);
}
let code = src.slice(debut, fin);

// Le JSX/React n'est pas là : on peut évaluer directement.
const module = { exports: {} };
const fn = new Function('module', 'exports', code + '\nmodule.exports={rechercherBase, ACCES_ADMIN_DENIED, ACCES_FINANCES_DENIED, estAdministrateur, BASE_CONNAISSANCES, SUGGESTIONS, detecterSalutation, detecterMerci, suggestionsPourRole};');
fn(module, module.exports);
const { rechercherBase, ACCES_ADMIN_DENIED, ACCES_FINANCES_DENIED, SUGGESTIONS, BASE_CONNAISSANCES, detecterSalutation, detecterMerci, suggestionsPourRole } = module.exports;

const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const standard = [
  'Version PC',
  'Version mobile Android',
  'Comment fonctionne la synchronisation',
  'Quels sont les modules avancés',
  'Guide complet utilisation',
  'Accès et navigation',
  'Tableau de bord',
  'Catalogue et stock',
  'Caisse et transactions',
  'Mouvements inventaire achats',
  'Clients devis transport',
  'Paiements et justificatifs',
  'Rapports et configuration',
  'Rôles et sécurité',
  'En cas de problème',
];

const admin = [
  'permissions et droits accès',
  'modèle de commercialisation SaaS',
  'isolation des données multi tenant',
  'onboarding nouvel acheteur',
  'licence et CGV',
  'verrouiller un compte',
  'marge bénéficiaire',
];

const resultats = { standard: [], admin: [], fuites: [] };

for (const q of standard) {
  const r = rechercherBase(norm(q), 'Caissier');
  resultats.standard.push({ q, ok: !!r, refus: r === ACCES_ADMIN_DENIED, apercu: r ? r.split('\n')[0] : null });
}

/* Un message de refus commence par le cadenas 🔒 : c'est une orientation,
   pas une divulgation. On distingue les deux pour ne pas compter un refus
   legitime comme une fuite. */
const estRefus = reponse => typeof reponse === 'string' && reponse.startsWith('🔒');

for (const q of admin) {
  const adminRep = rechercherBase(norm(q), 'Administrateur');
  const stdRep = rechercherBase(norm(q), 'Caissier');
  resultats.admin.push({
    q,
    adminOk: !!adminRep,
    adminApercu: adminRep ? adminRep.split('\n')[0] : null,
    bloquePourStandard: estRefus(stdRep),
    fuite: !!stdRep && !estRefus(stdRep),
  });
  if (stdRep && !estRefus(stdRep)) resultats.fuites.push({ q, reponse: stdRep });
}

// Compter les entrées admin
resultats.nbEntrees = BASE_CONNAISSANCES.length;
resultats.nbAdmin = BASE_CONNAISSANCES.filter(e => e.adminSeulement).length;
resultats.suggestions = SUGGESTIONS;

/* ------------------------------------------------------------------
   Tests de robustesse : détection de salutation / remerciement et
   priorité des mots-clés (motifs géneriques ne doivent plus capturer
   une question qui relève d'une autre entrée).
   ------------------------------------------------------------------ */
const robustesse = [];
const verifier = (nom, condition, detail) => {
  robustesse.push({ nom, ok: !!condition, detail });
};

// Salutation : doit etre vraie uniquement sur un message de salutation.
verifier('salutation seule « bonjour »', detecterSalutation(norm('bonjour')) === true);
verifier('salutation « salut ! »', detecterSalutation(norm('salut')) === true);
verifier(
  'salutation + question NON captivee',
  detecterSalutation(norm('bonjour quel est mon stock')) === false
);

// Remerciement : vrai sur un court remerciement, faux dans une vraie question.
verifier('remerciement court « merci »', detecterMerci(norm('merci')) === true);
verifier(
  'question contenant « merci » NON captivee',
  detecterMerci(norm('comment ajouter une mention merci dans le devis')) === false
);

// Priorite : « exporter l'inventaire » doit viser l'inventaire, pas le PDF.
const repExportInventaire = rechercherBase(norm('comment exporter mon inventaire'), 'Caissier');
verifier(
  'export inventaire -> entree inventaire/mouvements',
  !!repExportInventaire && /inventaire/i.test(repExportInventaire)
);

// Le fallback de repondre() doit couvrir le verbe « inventorier » (suggestion
// « Comment inventorier ? »), pas seulement le nom commun « inventaire ».
verifier(
  'fallback repondre couvre « inventorier »',
  /inventori\|inventaire\|compter\|ecart/.test(src)
);

// La suggestion « Comment inventorier ? » est bien proposee a l'utilisateur.
verifier(
  'suggestion « comment inventorier » presente',
  SUGGESTIONS.some(s => /inventori/i.test(s))
);

/* ------------------------------------------------------------------
   Guides par rôle : chaque rôle obtient SON guide, et ne voit jamais
   le guide d'un autre rôle.
   ------------------------------------------------------------------ */
const guideAdmin = rechercherBase(norm('guide de mon role'), 'Administrateur');
const guideCaissier = rechercherBase(norm('guide de mon role'), 'Caissier');
const guideMagasinier = rechercherBase(norm('guide de mon role'), 'Magasinier');

verifier('guide Administrateur accessible', !!guideAdmin && /GUIDE COMPLET — ADMINISTRATEUR/.test(guideAdmin));
verifier('guide Caissier accessible', !!guideCaissier && /GUIDE COMPLET — CAISSIER/.test(guideCaissier));
verifier('guide Magasinier accessible', !!guideMagasinier && /GUIDE COMPLET — MAGASINIER/.test(guideMagasinier));

verifier('un Caissier ne recoit PAS le guide admin', !/GUIDE COMPLET — ADMINISTRATEUR/.test(guideCaissier || ''));
verifier('un Magasinier ne recoit PAS le guide caissier', !/GUIDE COMPLET — CAISSIER/.test(guideMagasinier || ''));
verifier('un Caissier ne voit pas les depenses (acces ferme)', /Dépenses/.test(guideCaissier || '') && /ACCÈS FERMÉS/.test(guideCaissier || ''));

// Les suggestions sont adaptees au role.
verifier('suggestions Caissier adaptees', suggestionsPourRole('Caissier').some(s => /caissier/i.test(s)));
verifier('suggestions Magasinier adaptees', suggestionsPourRole('Magasinier').some(s => /magasinier/i.test(s)));
verifier('suggestions Administrateur adaptees', suggestionsPourRole('Administrateur').some(s => /rôle|role|administrateur/i.test(s)));

// Le contenu reserve au Caissier reste inaccessible au Magasinier.
const ventePourMagasinier = rechercherBase(norm('guide caissier'), 'Magasinier');
verifier(
  'guichet caissier ferme au Magasinier',
  typeof ventePourMagasinier === 'string' && !/GUIDE COMPLET — CAISSIER/.test(ventePourMagasinier)
);

resultats.robustesse = robustesse;

// Verdict : le test doit SIGNALER un echec (code de sortie non nul) si une
// question standard n'obtient aucune reponse, si une reponse admin manque,
// ou si une fuite a ete detectee.
const reponsesStandardManquantes = resultats.standard.filter(r => !r.ok);
const reponsesAdminManquantes = resultats.admin.filter(r => !r.adminOk);
const robustesseEchouee = robustesse.filter(r => !r.ok);
const verdicts = {
  fuites: resultats.fuites.length,
  standardSansReponse: reponsesStandardManquantes.map(r => r.q),
  adminSansReponse: reponsesAdminManquantes.map(r => r.q),
  robustesseEchouee: robustesseEchouee.map(r => r.nom),
  reussi:
    resultats.fuites.length === 0 &&
    reponsesStandardManquantes.length === 0 &&
    reponsesAdminManquantes.length === 0 &&
    robustesseEchouee.length === 0
};
resultats.verdict = verdicts;

console.log(JSON.stringify(resultats, null, 1));

if (!verdicts.reussi) {
  console.error('\nECHEC du test chatbot : voir le champ "verdict" ci-dessus.');
  process.exit(1);
}
console.log('\nTest chatbot OK : ' + resultats.nbEntrees + ' entrees, ' + resultats.nbAdmin + ' admin, aucune fuite.');
