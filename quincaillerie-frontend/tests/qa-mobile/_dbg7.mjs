import { chromium } from "playwright";
const entreprise={companyId:"qa0000000000000000000001",slug:"demo",raisonSociale:"SKYS ERP Solution",devise:"FCFA",tauxTva:18,palier:"Essai",abonnementActif:true,abonnementEcheance:new Date(Date.now()+30*864e5).toISOString()};
const util={id:"1",nom:"QA",email:"demo@skys-erp.com",role:"Administrateur",emailVerifie:true};
const b=await chromium.launch({channel:"chrome"});
const p=await(await b.newContext({viewport:{width:1200,height:900},locale:"fr-FR"})).newPage();
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
await p.locator("#categorie-principale").selectOption("parametres").catch(()=>{});
await p.waitForTimeout(1800);
const info=await p.evaluate(()=>{
  const sel=[...document.querySelectorAll("select")].find(s=>[...s.options].some(o=>o.value==="rayures"));
  return {present:!!sel, options: sel?[...sel.options].map(o=>o.value):[]};
});
console.log(JSON.stringify(info));
if(info.present){
  for(const m of ["rayures","quadrillage"]){
    await p.selectOption("select:has(option[value=rayures])", m);
    await p.waitForTimeout(400);
    await p.locator("#categorie-principale").selectOption("dashboard");
    await p.waitForTimeout(1200);
    console.log(m, JSON.stringify(await p.evaluate(()=>{const ban=document.querySelector(".ad-banner");const be=getComputedStyle(ban,"::before");
      return {classe:ban.className, img:be.backgroundImage.slice(0,55), op:be.opacity};})));
    await p.screenshot({path:`tests/qa-mobile/motif-${m}.png`, clip:{x:260,y:0,width:940,height:110}});
    await p.locator("#categorie-principale").selectOption("parametres");
    await p.waitForTimeout(900);
  }
}
await b.close();
