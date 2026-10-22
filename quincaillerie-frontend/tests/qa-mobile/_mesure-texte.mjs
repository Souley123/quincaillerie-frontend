import { chromium } from "playwright";
const U={nom:"QA",email:"demo@skys-erp.com",role:"Administrateur"};
const E={nom:"Quincaillerie QA",slug:"demo",abonnementActif:true,companyId:"qa0000000000000000000001"};
const P=Array.from({length:3},(_,i)=>({_id:"qa-"+i,ref:"QA-"+i,nom:"Article QA "+(i+1),famille:"Plomberie",quantiteStock:10,minStock:2,prixVente:1000,prixAchat:800,unite:"piece",stockParDepot:{}}));
const b=await chromium.launch({channel:"chrome"});
const p=await(await b.newContext({viewport:{width:1366,height:900},locale:"fr-FR"})).newPage();
await p.addInitScript(([u,e])=>{localStorage.setItem("skys_erp_jeton","j");localStorage.setItem("skys_erp_entreprise",JSON.stringify({utilisateur:u,entreprise:e}))},[U,E]);
await p.route("**/api/auth/moi",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({utilisateur:U,entreprise:E})}));
await p.route(/\/api\/products(\?|$)/,r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(P)}));
await p.route(/\/api\/(?!products(\?|$)|auth\/moi)/,r=>r.fulfill({status:200,contentType:"application/json",body:"[]"}));
await p.goto("http://localhost:3000/",{waitUntil:"domcontentloaded"});
await p.waitForTimeout(6000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const shell=document.querySelector(".app-shell");
  const px=el=>el?Math.round(parseFloat(getComputedStyle(el).fontSize)):null;
  const w=sel=>{const e=document.querySelector(sel);return e?Math.round(e.getBoundingClientRect().width):null;};
  return {
    zoom: getComputedStyle(shell).zoom,
    varRoot: getComputedStyle(document.documentElement).getPropertyValue("--app-font-scale"),
    textes: {p:px(document.querySelector(".app-main p")), h3:px(document.querySelector(".app-main h3")), label:px(document.querySelector(".app-main label"))},
    largeurs: {sidebar: w(".app-sidebar"), header: w(".app-header"), main: w(".app-main")},
    debordementH: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
}),null,2));
await p.screenshot({path:"tests/qa-mobile/ctrl-texte.png"});
await b.close();
