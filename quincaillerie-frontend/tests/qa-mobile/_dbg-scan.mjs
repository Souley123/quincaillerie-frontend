import { chromium } from "playwright";
const U={nom:"QA",email:"demo@skys-erp.com",role:"Administrateur"};
const E={nom:"Quincaillerie QA",slug:"demo",abonnementActif:true,companyId:"qa0000000000000000000001"};
const P=Array.from({length:3},(_,i)=>({_id:"qa-"+i,ref:"QA-"+i,nom:"Article QA "+(i+1),famille:"Plomberie",quantiteStock:10,minStock:2,prixVente:1000,prixAchat:800,unite:"piece",stockParDepot:{}}));
const b=await chromium.launch({channel:"chrome"});
for (const w of [1366,1920,768]) {
  const p=await(await b.newContext({viewport:{width:w,height:900},locale:"fr-FR"})).newPage();
  await p.addInitScript(([u,e])=>{localStorage.setItem("skys_erp_jeton","j");localStorage.setItem("skys_erp_entreprise",JSON.stringify({utilisateur:u,entreprise:e}))},[U,E]);
  await p.route("**/api/auth/moi",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({utilisateur:U,entreprise:E})}));
  await p.route(/\/api\/products(\?|$)/,r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(P)}));
  await p.route(/\/api\/(?!products(\?|$)|auth\/moi)/,r=>r.fulfill({status:200,contentType:"application/json",body:"[]"}));
  await p.goto("http://localhost:3000/",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(4500);
  await p.locator("#categorie-principale").selectOption("transaction").catch(async()=>{ await p.locator(".app-menu-toggle").click().catch(()=>{}); await p.waitForTimeout(600); await p.locator(".sidebar a, .app-sidebar a").filter({hasText:/Caisse/}).first().click({timeout:5000}); });
  await p.waitForTimeout(2200);
  console.log(w, JSON.stringify(await p.evaluate(()=>{
    const bar=document.querySelector(".scan-bar");
    if(!bar) return {absent:true};
    const r=bar.getBoundingClientRect();
    return {barre:{w:Math.round(r.width),h:Math.round(r.height),scroll:bar.scrollWidth},
      enfants:[...bar.children].map(el=>{const q=el.getBoundingClientRect();return {tag:el.tagName.toLowerCase(),cls:el.className,ordre:0,x:Math.round(q.left),w:Math.round(q.width),h:Math.round(q.height)};})};
  })));
  await p.context().close();
}
await b.close();
