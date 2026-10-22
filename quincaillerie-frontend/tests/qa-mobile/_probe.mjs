import { chromium } from "playwright";
const entreprise={companyId:"qa0000000000000000000001",slug:"demo",abonnementActif:true};
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
},[util,entreprise]);
await p.goto("http://localhost:3000",{waitUntil:"networkidle"});
await p.waitForTimeout(2500); { const a=await p.locator(".app-sidebar").getAttribute("class"); const bb=await p.locator(".app-sidebar").boundingBox(); console.log("sidebar", a, JSON.stringify(bb), JSON.stringify(await p.evaluate(()=>getComputedStyle(document.querySelector(".app-sidebar")).transform))); await p.evaluate(()=>{const s=document.querySelector("#categorie-principale"); s.value="dashboard"; s.dispatchEvent(new Event("change",{bubbles:true}));}); await p.waitForTimeout(1500); }
console.log(await p.evaluate(()=>({
  banniere: !!document.querySelector(".ad-banner"),
  texte: document.body.innerText.slice(0,120),
  sel: [...document.querySelectorAll("select")].map(s=>({id:s.id,cls:s.className,val:s.value,opts:s.options.length}))
})));
await b.close();


