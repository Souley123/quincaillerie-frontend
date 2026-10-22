import { chromium } from "playwright";
const entreprise={companyId:"qa0000000000000000000001",slug:"demo",abonnementActif:true};
const util={id:"1",nom:"QA",email:"demo@skys-erp.com",role:"Administrateur",emailVerifie:true};
const b=await chromium.launch({channel:"chrome"});
const p=await(await b.newContext({viewport:{width:1280,height:900},locale:"fr-FR"})).newPage();
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
console.log(JSON.stringify(await p.evaluate(()=>{
  const ss=document.styleSheets[0];
  const cibles=new Set();
  for(const r of ss.cssRules){ if(r.selectorText) cibles.add(r.selectorText); if(r.constructor.name==='CSSMediaRule'){for(const x of r.cssRules){ if(x.selectorText) cibles.add(x.selectorText);} } }
  const tout=[...cibles].join(' | ');
  return {
    span: /\.app-main[^{]*\bspan/.test(tout),
    any: /\.ad-track|\.ad-copy|\.ad-banner|\.ad-viewport/.test(tout) ? [...cibles].filter(s=>/ad-/.test(s)) : [],
    appMainSpanRegles: [...cibles].filter(s=>/\.app-main/.test(s) && /span/.test(s))
  };
})));
await b.close();
