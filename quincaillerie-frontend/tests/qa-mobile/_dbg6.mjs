import { chromium } from "playwright";
const entreprise={companyId:"qa0000000000000000000001",slug:"demo",raisonSociale:"SKYS ERP Solution",devise:"FCFA",tauxTva:18,palier:"Essai",abonnementActif:true,abonnementEcheance:new Date(Date.now()+30*864e5).toISOString()};
const util={id:"1",nom:"QA",email:"demo@skys-erp.com",role:"Administrateur",emailVerifie:true};
const b=await chromium.launch({channel:"chrome"});
const p=await(await b.newContext({viewport:{width:1100,height:800},locale:"fr-FR"})).newPage();
await p.route("**/api/**", r => r.request().url().includes("/api/auth/moi")
  ? r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({utilisateur:util,entreprise})})
  : r.fulfill({status:200,contentType:"application/json",body:"[]"}));
await p.addInitScript(([u,e])=>{
  localStorage.setItem("skys_erp_jeton","j");
  localStorage.setItem("skys_erp_entreprise",JSON.stringify({utilisateur:u,entreprise:e}));
  localStorage.setItem("skys_erp_trial_expire",String(Date.now()+30*864e5));
  localStorage.setItem("skys_erp_subscribed","true");
  localStorage.removeItem("erp_publicite");
},[util,entreprise]);
await p.goto("http://localhost:3000",{waitUntil:"networkidle"});
await p.waitForTimeout(1800);
await p.locator("#categorie-principale").selectOption("dashboard").catch(()=>{});
await p.waitForTimeout(1500);
console.log("select motif present:", await p.evaluate(()=>[...document.querySelectorAll("select")].filter(s=>[...s.options].some(o=>o.value==="rayures")).length));
console.log("onglet:", await p.evaluate(()=>document.querySelector(".app-header-title")?.textContent));
console.log("banner:", await p.evaluate(()=>!!document.querySelector(".ad-banner")));
await b.close();
