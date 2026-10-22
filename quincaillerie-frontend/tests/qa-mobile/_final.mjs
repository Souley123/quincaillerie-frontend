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
const x=()=>p.evaluate(()=>{const t=document.querySelector(".ad-track");return Math.round(parseFloat(getComputedStyle(t).transform.split(",")[4]));});
const serie=[]; for(let i=0;i<5;i++){serie.push(await x()); await p.waitForTimeout(2000);}
console.log("positions toutes les 2 s:", serie.join(" -> "), "| vitesse ~", Math.round((serie[4]-serie[0])/8), "px/s");
const r=await p.locator(".ad-banner").boundingBox();
await p.screenshot({path:"tests/qa-mobile/final-bandeau.png", clip:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}});
// motif via les reglages
await p.evaluate(()=>{const s=document.querySelector("#categorie-principale"); s.value="parametresGeneraux"; s.dispatchEvent(new Event("change",{bubbles:true}));});
await p.waitForTimeout(1200);
const sel=p.locator("select").filter({has:p.locator('option[value="rayures"]')}).first();
for(const m of ["rayures","quadrillage"]){
  await sel.selectOption(m); await p.waitForTimeout(350);
  const a=await p.locator(".ad-banner").first().boundingBox();
  await p.screenshot({path:`tests/qa-mobile/final-${m}.png`, clip:{x:Math.round(a.x),y:Math.round(a.y),width:Math.round(a.width),height:Math.round(a.height)}});
  console.log("apercu", m, await p.evaluate(()=>document.querySelector(".ad-banner").className));
}
await b.close();
