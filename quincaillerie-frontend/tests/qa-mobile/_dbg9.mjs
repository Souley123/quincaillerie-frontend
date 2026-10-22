/* CONTRÔLE DU DÉFILEMENT du bandeau publicitaire + motifs.

   Mesure objective : on relève la position horizontale du texte (transform de
   la piste, ou bord gauche de la première copie) à trois instants. Si elle ne
   bouge pas, le défilement est réellement figé — ce n'est plus une impression.
   Lecture seule, captures dans tests/qa-mobile. */
import { chromium } from "playwright";

const entreprise = { companyId: "qa0000000000000000000001", slug: "demo", raisonSociale: "SKYS ERP Solution", devise: "FCFA", tauxTva: 18, palier: "Essai", abonnementActif: true, abonnementEcheance: new Date(Date.now() + 30 * 864e5).toISOString() };
const util = { id: "1", nom: "QA", email: "demo@skys-erp.com", role: "Administrateur", emailVerifie: true };

const navigateur = await chromium.launch({ channel: "chrome" });
const page = await (await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" })).newPage();

await page.route("**/api/**", r => r.request().url().includes("/api/auth/moi")
  ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ utilisateur: util, entreprise }) })
  : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

await page.addInitScript(([u, e]) => {
  localStorage.setItem("skys_erp_jeton", "j");
  localStorage.setItem("skys_erp_entreprise", JSON.stringify({ utilisateur: u, entreprise: e }));
  localStorage.setItem("skys_erp_trial_expire", String(Date.now() + 30 * 864e5));
  localStorage.setItem("skys_erp_subscribed", "true");
}, [util, entreprise]);

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const s = document.querySelector("#categorie-principale");
  s.value = "dashboard"; s.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(2000);

const etat = () => page.evaluate(() => {
  const ban = document.querySelector(".ad-banner");
  if (!ban) return { absent: true };
  const piste = ban.querySelector(".ad-track");
  const copie = ban.querySelector(".ad-copy");
  const vue = ban.querySelector(".ad-viewport");
  const st = getComputedStyle(piste);
  return {
    anime: st.animationName,
    duree: st.animationDuration,
    etatAnim: st.animationPlayState,
    transform: st.transform,
    teteGauche: Math.round(copie.getBoundingClientRect().left),
    viewport: Math.round(vue.getBoundingClientRect().width),
    reduireMouvement: matchMedia("(prefers-reduced-motion: reduce)").matches
  };
});

console.log("t0", JSON.stringify(await etat()));
await page.waitForTimeout(1500);
console.log("t1", JSON.stringify(await etat()));
await page.waitForTimeout(1500);
console.log("t2", JSON.stringify(await etat()));

const r = await page.locator(".ad-banner").boundingBox();
await page.screenshot({ path: "tests/qa-mobile/defilement.png", clip: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } });

/* APERÇU DES RÉGLAGES : c'est là que l'administrateur choisit son motif.
   Il doit voir immédiatement le résultat (mêmes classes que la bannière). */
await page.evaluate(() => {
  const s = document.querySelector("#categorie-principale");
  s.value = "parametresGeneraux"; s.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(1200);
const sel = page.locator("select").filter({ has: page.locator('option[value="rayures"]') }).first();
for (const m of ["aucun", "rayures", "quadrillage"]) {
  await sel.selectOption(m);
  await page.waitForTimeout(350);
  const a = await page.locator(".ad-banner").first().boundingBox();
  await page.screenshot({ path: `tests/qa-mobile/apercu-${m}.png`, clip: { x: Math.round(a.x), y: Math.round(a.y), width: Math.round(a.width), height: Math.round(a.height) } });
  console.log("apercu", m, JSON.stringify(await page.evaluate(() => ({
    classe: document.querySelector(".ad-banner")?.className,
    image: getComputedStyle(document.querySelector(".ad-banner"), "::before").backgroundImage.slice(0, 60)
  }))));
}

await navigateur.close();
