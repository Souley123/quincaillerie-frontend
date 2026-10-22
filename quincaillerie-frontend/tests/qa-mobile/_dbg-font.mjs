import { chromium } from "playwright";
const U={nom:"QA",email:"demo@skys-erp.com",role:"Administrateur"};
const E={nom:"Quincaillerie QA",slug:"demo",abonnementActif:true,companyId:"qa0000000000000000000001"};
const b=await chromium.launch({channel:"chrome"});
const p=await(await b.newContext({viewport:{width:1366,height:900},locale:"fr-FR"})).newPage();
await p.addInitScript(([u,e])=>{localStorage.setItem("skys_erp_jeton","j");localStorage.setItem("skys_erp_entreprise",JSON.stringify({utilisateur:u,entreprise:e}))},[U,E]);
await p.route("**/api/auth/moi",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({utilisateur:U,entreprise:E})}));
await p.route(/\/api\/(?!auth\/moi)/,r=>r.fulfill({status:200,contentType:"application/json",body:"[]"}));
await p.goto("http://localhost:3000/",{waitUntil:"domcontentloaded"});
await p.waitForTimeout(5000);
console.log(JSON.stringify(await p.evaluate(()=>{
  const shell=document.querySelector(".app-shell");
  const cs=getComputedStyle(shell);
  return { shellFontSize: cs.fontSize, shellFontSizeInline: shell.style.fontSize, htmlFont: getComputedStyle(document.documentElement).fontSize, pInShell: Math.round(parseFloat(getComputedStyle(document.querySelector(".app-main p")).fontSize)) };
}),null,2));
await b.close();
