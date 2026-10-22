/* DIAGNOSTIC : que voit le navigateur quand on ouvre l'application ?
   On relève le HTML réellement rendu, l'état du stockage local et les erreurs
   console/pagination — sans filtre, pour ne rien masquer. */
import { chromium } from "playwright";

const navigateur = await chromium.launch({ channel: "chrome" });
const page = await (await navigateur.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const erreurs = [];
page.on("pageerror", e => erreurs.push(`pageerror: ${e.message}`));
page.on("console", m => { if (m.type() === "error") erreurs.push(`console: ${m.text().slice(0, 300)}`); });
page.on("requestfailed", r => erreurs.push(`requete KO: ${r.url().slice(0, 160)} — ${r.failure()?.errorText}`));

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);

const etat = await page.evaluate(() => ({
  titre: document.title,
  racine: document.getElementById("root")?.children.length ?? -1,
  selecteurs: Boolean(document.querySelector("#categorie-principale")),
  nbInputs: document.querySelectorAll("input").length,
  texte: document.body.innerText.replace(/\s+/g, " ").slice(0, 400),
  jeton: Boolean(localStorage.getItem("skys_erp_jeton")),
  modules: [...document.querySelectorAll("#categorie-principale option")].map(o => o.value).slice(0, 40)
}));
console.log(JSON.stringify(etat, null, 2));
console.log("ERREURS", JSON.stringify(erreurs.slice(0, 10), null, 2));
await page.screenshot({ path: "tests/qa-mobile/diag-tunnel-1366.png" });
await navigateur.close();
