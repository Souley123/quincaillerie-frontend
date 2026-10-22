import { chromium } from "playwright";
const entreprise={companyId:"qa0000000000000000000001",slug:"demo",abonnementActif:true};
const util={id:"1",nom:"QA",email:"demo@skys-erp.com",role:"Administrateur",emailVerifie:true};
const b=await chromium.launch({channel:"chrome"});
const p=await(await b.newContext({viewport:{width:1280,height:900},locale:"fr-FR"})).newPage();
p.on("pageerror", e=>console.log("PAGEERROR", e.message.slice(0,150)));
await p.route("**/api/**", r => r.request().url().includes("/api/auth/moi")
  ? r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({utilisateur:util,entreprise})})
  : r.fulfill({status:200,contentType:"application/json",body:"[]"}));
await p.addInitScript(([u,e])=>{
  localStorage.setItem("skys_erp_jeton","j");
  localStorage.setItem("skys_erp_entreprise",JSON.stringify({utilisateur:u,entreprise:e}));
  localStorage.setItem("skys_erp_trial_expire",String(Date.now()+30*864e5));
  localStorage.setItem("skys_erp_subscribed","true");
},[util,entreprise]);
await p.goto("http://localhost:3000",{waitUntil:"networkidle"});
await p.waitForTimeout(2000);
await p.evaluate(()=>{const s=document.querySelector("#categorie-principale"); s.value="dashboard"; s.dispatchEvent(new Event("change",{bubbles:true}));});
await p.waitForTimeout(2000);
console.log("styles:", JSON.stringify(await p.evaluate(()=>{
  const reseau=[...document.styleSheets].map(ss=>{let n=0;try{n=ss.cssRules.length}catch(e){n=-1}return {href:ss.href, regles:n};});
  return {sheets:reseau, totalRegles:[...document.styleSheets].reduce((a,ss)=>{try{return a+ss.cssRules.length}catch{return a}},0)};
})));
// Lit la règle du transform pour ::before réellement appliquée
console.log("rules motif:", JSON.stringify(await p.evaluate(()=>{
  const out=[];
  const st=document.querySelector('.ad-banner').style.cssText;
  return {inline: st.slice(0,200), childStyles:[...document.querySelectorAll('.ad-banner *')].map(e=>e.tagName+':'+(e.getAttribute('style')||'').slice(0,80))};
})));
await b.close();
