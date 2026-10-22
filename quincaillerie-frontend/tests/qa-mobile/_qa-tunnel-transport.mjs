/* QA BOUT-EN-BOUT DU TUNNEL DE TRANSPORT
   ------------------------------------------------------------------
   Le tunnel (Départ → Chargement → Livraison → Confirmation) est piloté par
   des règles métier : on les vérifie DANS LA PAGE, pas dans le code source.
   Chaque assertion produit un OK / ÉCHEC, et le script renvoie un code de
   sortie non nul si une seule échoue (utilisable en vérification automatique).

   Ce qui est contrôlé :
     1. le fil des 4 étapes et les étapes bloquées tant que la précédente
        n'est pas valide ;
     2. étape 1 — « Suivant » refuse un départ incomplet, et le message
        d'erreur est affiché (role="alert") ;
     3. étape 1 complète → étape 2 accessible ;
     4. étape 2 — quantité au-dessus du stock : ligne signalée, passage
        bloqué ;
     5. étape 2 valide → étape 3, retour arrière libre (étape 1 re-cliquable) ;
     6. étape 3 — livraison partielle bloquée, livraison complète → étape 4 ;
     7. étape 4 — récapitulatif exact (chauffeur, véhicule, unités, valeur) ;
     8. enregistrement : POST /api/products/:id/stock (SORTIE) puis
        POST /api/transports, avec les quantités agrégées par référence ;
     9. après enregistrement : tunnel remis à l'étape 1 et expédition visible
        dans le tableau.

   Le backend est SIMULÉ (route Playwright) : aucune écriture réelle, aucun
   stockage de données de démonstration modifié. */
import { chromium } from "playwright";

const URL_APP = "http://localhost:3000/";
const LARGEUR = Number(process.env.QA_LARGEUR || 1366);

const util = { id: "qa-user", nom: "QA Tunnel", email: "demo@skys-erp.com", role: "Administrateur", emailVerifie: true };
const entreprise = {
  companyId: "qa0000000000000000000001", slug: "demo", raisonSociale: "Quincaillerie QA",
  devise: "FCFA", tauxTva: 18, palier: "Enterprise", abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 30 * 864e5).toISOString()
};

/* Catalogue : deux articles, 10 unités chacun au dépôt principal. */
const produits = [
  { _id: "qa-prod-1", ref: "QA-1", nom: "Ciment 50 kg", famille: "Maçonnerie", quantiteStock: 10, minStock: 2, prix: 4500, prixVente: 4500, prixAchat: 3800, unite: "sac" },
  { _id: "qa-prod-2", ref: "QA-2", nom: "Fer à béton 12", famille: "Ferraille", quantiteStock: 10, minStock: 2, prix: 3000, prixVente: 3000, prixAchat: 2500, unite: "barre" }
];

const paiements = [];   // trafic enregistré
const resultats = [];
const verifier = (nom, condition, detail) => {
  resultats.push({ nom, ok: Boolean(condition), detail });
  console.log(`${condition ? "OK   " : "ÉCHEC"}  ${nom}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
};

const navigateur = await chromium.launch({ channel: "chrome" });
const contexte = await navigateur.newContext({ viewport: { width: LARGEUR, height: 900 }, locale: "fr-FR" });
const page = await contexte.newPage();

await page.addInitScript(([u, e]) => {
  localStorage.setItem("skys_erp_jeton", "jeton-qa-tunnel");
  localStorage.setItem("skys_erp_entreprise", JSON.stringify({ utilisateur: u, entreprise: e }));
  localStorage.setItem("skys_erp_subscribed", "true");
  localStorage.setItem("skys_erp_trial_expire", String(Date.now() + 30 * 864e5));
}, [util, entreprise]);

await page.route("**/api/**", async route => {
  const requete = route.request();
  const url = new URL(requete.url());
  const chemin = url.pathname;
  const methode = requete.method();
  const json = corps => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });

  if (chemin === "/api/auth/moi") return json({ utilisateur: util, entreprise });
  if (chemin === "/api/products" && methode === "GET") return json(produits);
  if (/^\/api\/products\/[^/]+\/stock$/.test(chemin) && methode === "POST") {
    paiements.push({ type: "stock", chemin, corps: JSON.parse(requete.postData() || "{}") });
    return json({ ok: true });
  }
  if (chemin === "/api/transports" && methode === "POST") {
    paiements.push({ type: "transport", chemin, corps: JSON.parse(requete.postData() || "{}") });
    return json({ ok: true, _id: "qa-tr-1" });
  }
  return json([]);   // tout le reste : listes vides (mouvements, clients, etc.)
});

/* Attente courte et silencieuse : l'interface est pilotée par React, une
   action n'est visible qu'au rendu suivant. */
const pause = (ms = 350) => page.waitForTimeout(ms);

await page.goto(URL_APP, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#categorie-principale", { timeout: 60000 });
await page.selectOption("#categorie-principale", "transport");
await page.waitForSelector("form >> text=Nouvelle expédition", { timeout: 20000 });
await pause(800);

/* ---------- Sélecteurs du tunnel ---------- */
const etapeBouton = titre => page.locator('form ol button', { hasText: titre }).first();
const suivant = () => page.locator('form button[type="button"]', { hasText: /^Suivant/ }).first();
const precedent = () => page.locator('form button[type="button"]', { hasText: "Précédent" }).first();
const alerte = () => page.locator('form p[role="alert"]').first();
const champParLabel = texte => page.locator("form label", { hasText: texte }).locator("input, select, textarea").first();
const etapeCourante = async () => {
  const actif = page.locator('form ol button[aria-current="step"]');
  return (await actif.count()) ? (await actif.innerText()).trim() : null;
};

/* 1. Fil des étapes : Confirmation doit être bloquée au départ. */
const confirmationBloquee = await etapeBouton("Confirmation").isDisabled();
verifier("étape 4 bloquée tant que le départ est vide", confirmationBloquee);
verifier("étape 1 active au chargement", (await etapeCourante())?.includes("Départ"), await etapeCourante());

/* 2. Départ incomplet : on n'avance pas, et l'utilisateur est averti. */
await suivant().click();
await pause();
const alerteDepart = (await alerte().count()) ? (await alerte().innerText()).trim() : "";
verifier("« Suivant » refuse un départ incomplet", (await etapeCourante())?.includes("Départ"), await etapeCourante());
verifier("message d'erreur de départ affiché", /Complétez le départ/i.test(alerteDepart), alerteDepart);

/* 3. Départ complet. */
await champParLabel("Nom du chauffeur").fill("Koné");
await champParLabel("Prénoms").fill("Ibrahim");
await champParLabel("Type de véhicule").fill("Camion 10T");
await champParLabel("Immatriculation").fill("ab 1234 ci");   // doit être normalisée en majuscules
await champParLabel("Dépôt de chargement").selectOption("Dépôt Principal");
const immatSaisie = await champParLabel("Immatriculation").inputValue();
verifier("immatriculation mise en majuscules à la saisie", immatSaisie === "AB 1234 CI", immatSaisie);

await suivant().click();
await pause();
verifier("étape 2 accessible une fois le départ valide", (await etapeCourante())?.includes("Chargement"), await etapeCourante());

/* 4. Chargement au-delà du stock : 11 unités pour 10 disponibles. */
const selectArticle = page.locator('form label', { hasText: "Ajouter un article" }).locator("select").first();
await selectArticle.selectOption("QA-1");
await pause();
const quantite1 = page.locator('form input[aria-label="Quantité de Ciment 50 kg"]');
await quantite1.fill("11");
await pause();

const ligneSignalee = await page.evaluate(() => {
  const entree = [...document.querySelectorAll("form tbody tr")]
    .find(tr => tr.querySelector("input[aria-label]"));
  return entree ? { fond: getComputedStyle(entree).backgroundColor, texte: entree.innerText.replace(/\s+/g, " ") } : null;
});
verifier("ligne surchargée signalée en rouge", /244, 242, 242|254, 242, 242|fef2f2/i.test(ligneSignalee?.fond || ""), ligneSignalee);

await suivant().click();
await pause();
verifier("passage bloqué si quantité > stock", (await etapeCourante())?.includes("Chargement"), await etapeCourante());

/* Quantité remise dans le stock, puis deuxième article. */
await quantite1.fill("4");
await pause();
await selectArticle.selectOption("QA-2");
await pause();
const quantite2 = page.locator('form input[aria-label="Quantité de Fer à béton 12"]');
await quantite2.fill("3");
await pause();

const totaux = await page.evaluate(() => {
  const texte = [...document.querySelectorAll("form div")]
    .map(d => d.innerText || "")
    .find(t => /unités? chargée/.test(t) && t.length < 200);
  return (texte || "").replace(/\s+/g, " ").trim();
});
verifier("totaux du chargement (2 réf., 7 unités)", /2 référence.*7 unité/s.test(totaux), totaux);

await suivant().click();
await pause();
verifier("étape 3 accessible", (await etapeCourante())?.includes("Livraison"), await etapeCourante());

/* 5. Retour arrière libre, puis retour à l'étape 3. */
await etapeBouton("Départ").click();
await pause();
verifier("retour à l'étape 1 par le fil", (await etapeCourante())?.includes("Départ"), await etapeCourante());
await etapeBouton("Livraison").click();
await pause();
verifier("retour à l'étape 3", (await etapeCourante())?.includes("Livraison"), await etapeCourante());

/* 6. Livraison : d'abord incomplète, puis complète. */
await champParLabel("Client").fill("Chantier QA");
await suivant().click();
await pause();
const alerteLivraison = (await alerte().count()) ? (await alerte().innerText()).trim() : "";
verifier("livraison sans destination bloquée", (await etapeCourante())?.includes("Livraison"), await etapeCourante());
verifier("message d'erreur de livraison affiché", /livraison/i.test(alerteLivraison), alerteLivraison);

await champParLabel("Destination").fill("Bouaké");
await champParLabel("Frais de transport").fill("25000");
await pause();
await suivant().click();
await pause();
verifier("étape 4 accessible", (await etapeCourante())?.includes("Confirmation"), await etapeCourante());

/* 7. Récapitulatif : valeurs figées et exactes. */
const recap = await page.evaluate(() => document.querySelector("form").innerText.replace(/\s+/g, " "));
verifier("récap. chauffeur", recap.includes("Koné Ibrahim"), recap.slice(0, 0) || undefined);
verifier("récap. véhicule", recap.includes("Camion 10T — AB 1234 CI"));
verifier("récap. destination", recap.includes("Bouaké"));
verifier("récap. frais", recap.includes("25 000 FCFA") || recap.includes("25000 FCFA"));
verifier("récap. valeur chargée (4×4500 + 3×3000 = 27 000)", recap.includes("27 000"), recap.slice(0, 0) || undefined);
verifier("récap. avertissement sortie de stock", /7 unité\(s\).*sorties du stock/i.test(recap));

/* 8. Enregistrement : sortie de stock puis expédition. */
await page.locator('form button[type="submit"]').click();
await page.waitForTimeout(1500);

const sorties = paiements.filter(p => p.type === "stock");
const expedition = paiements.find(p => p.type === "transport");
verifier("une sortie de stock par article", sorties.length === 2, sorties.map(s => s.corps));
verifier(
  "sortie QA-1 : 4 unités en SORTIE sur Dépôt Principal",
  sorties.some(s => s.chemin.endsWith("qa-prod-1/stock") && s.corps.type === "SORTIE" && s.corps.quantite === 4 && s.corps.depot === "Dépôt Principal"),
  sorties.find(s => s.chemin.endsWith("qa-prod-1/stock"))?.corps
);
verifier("sortie QA-2 : 3 unités", sorties.some(s => s.chemin.endsWith("qa-prod-2/stock") && s.corps.quantite === 3));
verifier("expédition transmise au serveur", Boolean(expedition), expedition?.corps);
if (expedition) {
  const d = expedition.corps;
  verifier("expédition : lignes agrégées", Array.isArray(d.lignes) && d.lignes.length === 2, d.lignes);
  verifier("expédition : unitesChargees = 7", d.unitesChargees === 7, d.unitesChargees);
  verifier("expédition : valeurMarchandise = 27 000", d.valeurMarchandise === 27000, d.valeurMarchandise);
  verifier("expédition : frais numériques", d.frais === 25000, d.frais);
  verifier("expédition : immatriculation normalisée", d.immatriculation === "AB 1234 CI", d.immatriculation);
}

/* 9. Après enregistrement : tunnel vidé et expédition listée. */
verifier("tunnel remis à l'étape 1", (await etapeCourante())?.includes("Départ"), await etapeCourante());
const apres = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
verifier("notification d'enregistrement", /Expédition enregistrée\s*:\s*7 unité/.test(apres));

await page.screenshot({ path: `tests/qa-mobile/tunnel-transport-${LARGEUR}.png`, fullPage: false });

await navigateur.close();

const echecs = resultats.filter(r => !r.ok);
console.log(`\n${resultats.length - echecs.length}/${resultats.length} vérifications OK`);
if (echecs.length) {
  console.log("Échecs :", echecs.map(e => e.nom).join(" | "));
  process.exitCode = 1;
}
