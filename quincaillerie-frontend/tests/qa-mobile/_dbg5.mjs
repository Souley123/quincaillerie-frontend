import { chromium } from "playwright";
const entreprise={companyId:"qa0000000000000000000001",slug:"demo",raisonSociale:"SKYS ERP Solution",devise:"FCFA",tauxTva:18,palier:"Essai",abonnementActif:true,abonnementEcheance:new Date(Date.now()+30*864e5).toISOString()};
const util={id:"1",nom:"QA",email:"demo@skys-erp.com",role:"Administrateur",emailVerifie:true};
const b=await chromium.launch({channel:"chrome"});
const p=await(await b.newContext({viewport:{width:1366,height:900},locale:"fr-FR"})).newPage();
await p.route("**/api/**", r => r.request().url().includes("/api/auth/moi")
  ? r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({utilisateur:util,entreprise})})
  : r.fulfill({status:200,contentType:"application/json",body:"[]"}));
await p.addInitScript(([u,e])=>{
  localStorage.setItem("skys_erp_jeton","j");
  localStorage.setItem("skys_erp_entreprise",JSON.stringify({utilisateur:u,entreprise:e}));
  localStorage.setItem("skys_erp_trial_expire",String(Date.now()+30*864e5));
  localStorage.setItem("skys_erp_subscribed","true");
  localStorage.setItem("erp_publicite",JSON.stringify({actif:true,titre:"Bienvenue sur SKYS ERP Solution",message:"Gerez votre stock, votre caisse et vos livraisons depuis un seul poste.",couleur:"#0f172a",couleurTexte:"#ffffff",lien:""}));
},[util,entreprise]);
await p.goto("http://localhost:3000",{waitUntil:"networkidle"});
await p.waitForTimeout(2000);
await p.locator("#categorie-principale").selectOption("dashboard").catch(()=>{});
await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const ban=document.querySelector(".ad-banner");
  const pick=sel=>{const e=document.querySelector(sel);if(!e)return null;const c=getComputedStyle(e);const r=e.getBoundingClientRect();return {ws:c.whiteSpace,disp:c.display,fs:c.fontSize,w:Math.round(r.width),h:Math.round(r.height),fw:c.flexWrap,overflow:c.overflowX};};
  const copie=ban.querySelector(".ad-copy");
  return {banner:pick(".ad-banner") , viewport:pick(".ad-viewport"), track:pick(".ad-track"), copy:pick(".ad-copy"),
    texteBrut: copie?.textContent.trim().slice(0,80), stylesBanniere: (()=>{const c=getComputedStyle(document.querySelector(".ad-banner"));return {bg:c.backgroundColor, bgImg:c.backgroundImage.slice(0,160), color:c.color};})(),
    spansDansCopie: [...copie.children].map(s=>({tag:s.tagName,ws:getComputedStyle(s).whiteSpace,h:Math.round(s.getBoundingClientRect().height)}))};
}),null,2));
await b.close();


