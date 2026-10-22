import { chromium } from "playwright";
const entreprise={companyId:"qa0000000000000000000001",slug:"demo",abonnementActif:true};
const util={id:"1",nom:"QA",email:"demo@skys-erp.com",role:"Administrateur",emailVerifie:true};
const b=await chromium.launch({channel:"chrome"});
for (const vp of [{width:1280,height:900},{width:1920,height:900}]) {
const p=await(await b.newContext({viewport:vp,locale:"fr-FR"})).newPage();
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
const lire=()=>p.evaluate(()=>{const t=document.querySelector(".ad-track");const st=getComputedStyle(t);const cs=[...document.querySelectorAll(".ad-copy")];
 return {dur:st.animationDuration, t:st.transform, copie1:Math.round(cs[0].getBoundingClientRect().left), copie2L:Math.round(cs[1].getBoundingClientRect().left), finCopie1:Math.round(cs[0].getBoundingClientRect().right), vue:Math.round(document.querySelector(".ad-viewport").getBoundingClientRect().width)};});
const a=await lire(); await p.waitForTimeout(3000); const c=await lire();
console.log(vp.width, JSON.stringify(a), JSON.stringify(c));
// vitesse px/s
const dx=(parseFloat(c.t.match(/-?[\d.]+/)?.[0]||0))-(parseFloat(a.t.match(/-?[\d.]+/)?.[0]||0));
console.log("  vitesse", (dx/3).toFixed(1), "px/s");
await p.context().close();
}
await b.close();
