import { chromium } from "playwright";
const U={nom:"QA",email:"demo@skys-erp.com",role:"Administrateur"};
const E={nom:"Quincaillerie QA",slug:"demo",abonnementActif:true,companyId:"qa0000000000000000000001"};
const P=Array.from({length:6},(_,i)=>({_id:"qa-"+i,ref:"QA-"+i,nom:"Article QA "+(i+1),famille:"Plomberie",quantiteStock:10,minStock:2,prixVente:1000,prixAchat:800,unite:"piece",stockParDepot:{}}));
const b=await chromium.launch({channel:"chrome"});
for (const w of [1366,1832]) {
  const p=await(await b.newContext({viewport:{width:w,height:900},locale:"fr-FR"})).newPage();
  await p.addInitScript(([u,e])=>{localStorage.setItem("skys_erp_jeton","j");localStorage.setItem("skys_erp_entreprise",JSON.stringify({utilisateur:u,entreprise:e}))},[U,E]);
  await p.route("**/api/auth/moi",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({utilisateur:U,entreprise:E})}));
  await p.route(/\/api\/products(\?|$)/,r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(P)}));
  await p.route(/\/api\/(?!products(\?|$)|auth\/moi)/,r=>r.fulfill({status:200,contentType:"application/json",body:"[]"}));
  await p.goto("http://localhost:3000/",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(4000);
  await p.locator("#categorie-principale").selectOption("transaction").catch(()=>{});
  await p.waitForTimeout(2500);
  console.log(w, JSON.stringify(await p.evaluate(()=>{
    const bar=document.querySelector(".scan-bar");
    const r=e=>{const b=e.getBoundingClientRect();return {w:Math.round(b.width),h:Math.round(b.height)};};
    return { barre:r(bar), champ:r(bar.querySelector("input")), camera:r(bar.querySelector(".scan-camera")), ajouter:r(bar.querySelector(".scan-ajouter")) };
  })));
  await p.screenshot({path:"tests/qa-mobile/ctrl-caisse-"+w+".png"});
  await p.context().close();
}
await b.close();
