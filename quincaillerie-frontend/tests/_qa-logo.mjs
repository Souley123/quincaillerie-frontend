/**
 * Aperçu du logo SKYS dans trois contextes réels (fond clair, carte blanche,
 * en-tête sombre), pour vérifier qu'il reste NET et correctement
 * dimensionné — pas trop large, pas flou.
 *
 * Usage : node tests/_qa-logo.mjs [urlFront]
 */
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const LOGO = `${BASE}/logo-skys.svg`;

const navigateur = await chromium.launch({ channel: 'chrome' });
const page = await navigateur.newPage({ viewport: { width: 900, height: 520 }, deviceScaleFactor: 3 });

const html = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;font-family:Segoe UI,sans-serif">
  <div style="background:#f1f5f9;padding:24px">
    <p style="margin:0 0 8px;font-size:12px;color:#475569">Carte de connexion — hauteur 54 px</p>
    <div style="background:#fff;border-radius:14px;padding:18px;display:inline-block">
      <img src="${LOGO}" alt="SKYS ERP" style="height:54px;display:block">
    </div>
  </div>
  <div style="background:#f1f5f9;padding:24px">
    <p style="margin:0 0 8px;font-size:12px;color:#475569">Même logo à 27 px (mobile) — doit rester lisible</p>
    <div style="background:#fff;border-radius:14px;padding:14px;display:inline-block">
      <img src="${LOGO}" alt="SKYS ERP" style="height:27px;display:block">
    </div>
  </div>
  <div style="background:#0b1f33;padding:24px">
    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8">Panneau sombre — hauteur 46 px</p>
    <img src="${LOGO}" alt="SKYS ERP" style="height:46px;display:block;background:#fff;padding:6px;border-radius:8px">
  </div>
</body></html>`;

await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: 'tests/qa-mobile/logo-rendu.png', fullPage: true });
console.log('Capture : tests/qa-mobile/logo-rendu.png');

const dimension = await page.evaluate(async src => {
  const img = new Image();
  img.src = src;
  await img.decode();
  return { largeur: img.naturalWidth, hauteur: img.naturalHeight, type: img.currentSrc.split('.').pop() };
}, LOGO);
console.log('Fichier chargé :', JSON.stringify(dimension));

await navigateur.close();
