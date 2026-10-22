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
  const rules=[];
  for (const sheet of document.styleSheets){
    let rs; try{rs=sheet.cssRules}catch(e){continue}
    const walk=(list,media)=>{ for(const r of list){ if(r.cssRules){walk(r.cssRules, r.conditionText||media||"");} else if(r.selectorText && /\.app-shell(?![\w-])/.test(r.selectorText) && r.style.fontSize){ rules.push({sel:r.selectorText, fs:r.style.fontSize, media}); } } };
    walk(rs,"");
  }
  return { shellFont: cs.fontSize, varSurShell: cs.getPropertyValue("--app-font-scale"), regles: rules };
}),null,2));
await b.close();
