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
const lire=()=>p.evaluate(()=>{
  const ban=document.querySelector(".ad-banner"); if(!ban) return {absent:true};
  const tr=ban.querySelector(".ad-track"), vp=ban.querySelector(".ad-viewport"), cp=ban.querySelector(".ad-copy");
  const m=new DOMMatrixReadOnly(getComputedStyle(tr).transform);
  const cs=getComputedStyle(tr);
  return {tx:Math.round(m.m41),anim:cs.animationName,duree:cs.animationDuration,etat:cs.animationPlayState,
    banH:Math.round(ban.getBoundingClientRect().height),banW:Math.round(ban.getBoundingClientRect().width),
    vpW:Math.round(vp.getBoundingClientRect().width),trackW:Math.round(tr.scrollWidth),
    copieW:Math.round(cp.getBoundingClientRect().width),padL:getComputedStyle(cp).paddingLeft,
    reduce:matchMedia("(prefers-reduced-motion: reduce)").matches};
});
const t0=await lire(); await p.waitForTimeout(3000); const t1=await lire();
console.log(JSON.stringify({t0,t1,deplace:t0.tx!==undefined?Math.abs(t1.tx-t0.tx):null},null,2));
await p.screenshot({path:"tests/qa-mobile/ctrl-bandeau.png",clip:{x:250,y:0,width:1116,height:200}});
await b.close();

