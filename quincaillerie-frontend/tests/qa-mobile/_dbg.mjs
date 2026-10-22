import { chromium } from "playwright";
const U={nom:"QA",email:"demo@skys-erp.com",role:"Administrateur"};
const E={nom:"Quincaillerie QA",slug:"demo",abonnementActif:true,companyId:"qa0000000000000000000001"};
const b=await chromium.launch({channel:"chrome"});
const p=await(await b.newContext({viewport:{width:1832,height:900},locale:"fr-FR"})).newPage();
await p.addInitScript(([u,e])=>{localStorage.setItem("skys_erp_jeton","j");localStorage.setItem("skys_erp_entreprise",JSON.stringify({utilisateur:u,entreprise:e}))},[U,E]);
await p.route("**/api/auth/moi",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({utilisateur:U,entreprise:E})}));
await p.route(/\/api\/products(\?|$)/,r=>r.fulfill({status:200,contentType:"application/json",body:"[]"}));
await p.route(/\/api\/(?!products(\?|$)|auth\/moi)/,r=>r.fulfill({status:200,contentType:"application/json",body:"[]"}));
await p.goto("http://localhost:3000/",{waitUntil:"domcontentloaded"});
await p.waitForTimeout(4000);
await p.locator("#categorie-principale").selectOption("transaction").catch(()=>{});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const g=document.querySelector(".caisse-grille");
  const sg=getComputedStyle(g);
  return {
    display:sg.display, colonnes:sg.gridTemplateColumns, direction:sg.gridAutoFlow,
    enfants:[...g.children].map(x=>({cls:x.className, display:getComputedStyle(x).display, w:Math.round(x.getBoundingClientRect().width)}))
  };
}),null,2));
await b.close();
