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
const lire=()=>p.evaluate(()=>{const ban=document.querySelector(".ad-banner");const be=ban?getComputedStyle(ban,"::before"):null;
  return ban?{classe:ban.className,img:be.backgroundImage.slice(0,60),w:Math.round(ban.getBoundingClientRect().width)}:{absent:true};});
for (const m of ["rayures","quadrillage","aucun"]) {
  await p.evaluate(v=>{const s=[...document.querySelectorAll("select")].find(x=>[...x.options].some(o=>o.value==="rayures"));if(s){s.value=v;s.dispatchEvent(new Event("change",{bubbles:true}));}}, m);
  await p.waitForTimeout(500);
  console.log(m, JSON.stringify(await lire()));
  await p.screenshot({path:`tests/qa-mobile/motif-${m}.png`, clip:{x:250,y:0,width:850,height:110}});
}
await b.close();
