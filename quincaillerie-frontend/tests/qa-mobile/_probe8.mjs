import { chromium } from "playwright";
const entreprise={companyId:"qa0000000000000000000001",slug:"demo",abonnementActif:true};
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
},[util,entreprise]);
await p.goto("http://localhost:3000",{waitUntil:"networkidle"});
await p.waitForTimeout(2000);
await p.evaluate(()=>{const s=document.querySelector("#categorie-principale"); s.value="dashboard"; s.dispatchEvent(new Event("change",{bubbles:true}));});
await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const ban=document.querySelector(".ad-banner"); const t=ban.querySelector(".ad-track"); const c=ban.querySelector(".ad-copy");
  const cs=e=>{const s=getComputedStyle(e);return {display:s.display, ws:s.whiteSpace, fs:s.fontSize, lh:s.lineHeight, h:Math.round(e.getBoundingClientRect().height), w:Math.round(e.getBoundingClientRect().width), overflowWrap:s.overflowWrap, wordBreak:s.wordBreak};};
  const h=[]; let e=c; while(e && e!==document.body){h.push(e.tagName+"."+String(e.className).slice(0,20)+" "+JSON.stringify({ws:getComputedStyle(e).whiteSpace,fs:getComputedStyle(e).fontSize,disp:getComputedStyle(e).display})); e=e.parentElement;}
  return {ban:cs(ban), track:cs(t), copy:cs(c), chaine:h};
})));
await b.close();
