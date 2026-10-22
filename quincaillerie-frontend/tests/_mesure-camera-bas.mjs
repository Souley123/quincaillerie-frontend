import { chromium } from 'playwright';

const entreprise = {
  companyId: 'M', slug: 'm', raisonSociale: 'T', devise: 'FCFA', tauxTva: 18,
  palier: 'Essai', abonnementActif: true,
  abonnementEcheance: new Date(Date.now() + 5 * 864e5).toISOString()
};
const utilisateur = { id: '1', nom: 'T', email: 't@t.t', role: 'Administrateur', emailVerifie: true };

const b = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
});
const c = await b.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, permissions: ['camera'], locale: 'fr-FR' });
const p = await c.newPage();

await p.route('**/api/**', r => r.request().url().includes('/api/auth/moi')
  ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ utilisateur, entreprise }) })
  : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

await p.addInitScript(([u, e]) => {
  localStorage.setItem('skys_erp_jeton', 'j');
  localStorage.setItem('skys_erp_entreprise', JSON.stringify({ utilisateur: u, entreprise: e }));
  localStorage.setItem('skys_erp_trial_expire', String(Date.now() + 5 * 864e5));
  localStorage.setItem('skys_erp_subscribed', 'true');
}, [utilisateur, entreprise]);

await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.locator('.app-menu-toggle').click().catch(() => { });
await p.waitForTimeout(400);
await p.locator('#categorie-principale').selectOption('transaction').catch(() => { });
await p.waitForTimeout(1200);
await p.locator('.caisse-module .pos-btn-camera').click().catch(() => { });
await p.waitForTimeout(2500);

const res = await p.evaluate(() => {
  const bb = e => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { haut: Math.round(r.y), bas: Math.round(r.bottom), h: Math.round(r.height) };
  };
  const cam = document.querySelector('#skys-reader-video');
  // Bloc caméra = parent direct du conteneur video
  const blocCam = cam?.parentElement;
  const boutons = [...document.querySelectorAll('#skys-reader-video, #skys-reader-video ~ * button')]
    .map(el => el.tagName === 'BUTTON' ? el : null).filter(Boolean)
    .map(x => ({ texte: x.textContent.trim(), ...bb(x) }));
  const tousBoutonsCam = [...document.querySelectorAll('button')]
    .filter(x => /camera|Caméra|Réinitialiser|Demarrer|Démarrer/i.test(x.textContent))
    .map(x => ({ texte: x.textContent.trim(), ...bb(x) }));
  const flottants = [...document.querySelectorAll('button[aria-label*="accessibilit"], button[aria-label*="assistant"]')]
    .map(x => ({ aria: x.getAttribute('aria-label'), ...bb(x) }));

  return {
    conteneurVideo: bb(cam),
    blocCamera: bb(blocCam),
    page: { hauteurContenu: document.body.scrollHeight, fenetre: window.innerHeight },
    boutonsCamera: tousBoutonsCam,
    boutonsFlottants: flottants
  };
});

console.log(JSON.stringify(res, null, 2));
await b.close();
