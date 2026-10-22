/**
 * QA caméra — simule un PC SANS caméra frontale (une seule webcam USB).
 *
 * Scénario : `facingMode: user` renvoie une piste NOIRE (le défaut d'origine),
 * tandis qu'une demande ciblant un `deviceId` explicite renvoie l'image de
 * l'appareil. On vérifie que la surveillance s'affiche réellement (pas de
 * cadre noir, pas de faux « ACTIVE »).
 *
 * Usage : node tests/_qa-camera.mjs [url]
 *   - l'app doit être servie (npm run start:frontend) ;
 *   - Playwright doit être installé (npm i -D playwright && npx playwright install chromium).
 */
import { chromium } from 'playwright';

const URL_APP = process.argv[2] || 'http://localhost:3000/';
const LUMINOSITE_MINIMALE = 20; // sur 255 — une image réelle, pas du noir

export default async function run(page) {
  await page.waitForSelector('#zone', { timeout: 20000 });

  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2f7d32';
    ctx.fillRect(0, 0, 640, 480);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#1b5e20';
      ctx.fillRect((i * 37) % 640, (i * 53) % 480, 18, 18);
    }
    const fluxReel = canvas.captureStream(15);

    // Une « caméra » existe, mais elle n'est PAS frontale.
    navigator.mediaDevices.enumerateDevices = async () => [
      { kind: 'videoinput', deviceId: 'usb-1', label: 'HD USB Camera', groupId: 'g1' }
    ];
    navigator.mediaDevices.getUserMedia = async contraintes => {
      const c = contraintes?.video;
      const viseIdentifiant = c && typeof c === 'object' && c.deviceId && (c.deviceId.exact || c.deviceId.ideal);
      // Reproduit le défaut : facingMode "user" -> piste sans image.
      if (c && typeof c === 'object' && c.facingMode && !viseIdentifiant) {
        const noir = document.createElement('canvas');
        noir.width = 640;
        noir.height = 480;
        noir.getContext('2d').fillStyle = '#000';
        noir.getContext('2d').fillRect(0, 0, 640, 480);
        return noir.captureStream(15);
      }
      if (c && c === true) return fluxReel; // amorce des libellés
      return fluxReel;
    };
    // Vérifie aussi le chemin « une piste explicite est demandée ».
    return { prepare: true };
  });

  // L'app ne démarre pas la caméra seule : on ouvre le panneau et on coche.
  const zone = page.locator('#zone');
  const caseACocher = zone.locator('input[type="checkbox"]').first();
  if (await caseACocher.count()) {
    if (!(await caseACocher.isChecked())) await caseACocher.check();
  } else {
    // Déclencheur discret (double-clic sur la zone de contrôle).
    await page.evaluate(() => {
      const bouton = document.querySelector('button[aria-label="Zone de contrôle de la surveillance"]');
      if (bouton) bouton.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    if (await caseACocher.count()) await caseACocher.check();
  }

  await page.waitForTimeout(4500);

  return page.evaluate(() => {
    const video = document.querySelector('#zone video');
    const texte = document.getElementById('zone').innerText;
    let luminosite = null;
    if (video && video.videoWidth) {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 24;
      const x = c.getContext('2d');
      x.drawImage(video, 0, 0, 32, 24);
      const d = x.getImageData(0, 0, 32, 24).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
      luminosite = Math.round(s / (d.length / 4) / 3);
    }
    return {
      luminositeAffichee: luminosite,
      messageErreur: (/Aucune image[^\n]*/.exec(texte) || [])[0] || null,
      texteActif: /Surveillance en direct ACTIVE/.test(texte),
      etatMentionne: (/Surveillance active[^\n]*/.exec(texte) || [])[0] || null
    };
  }).then(etat => ({
    ...etat,
    reussi: etat.luminositeAffichee !== null
      && etat.luminositeAffichee >= LUMINOSITE_MINIMALE
      && !etat.messageErreur
  }));
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const navigateur = await chromium.launch({ args: ['--use-fake-ui-for-media-stream'] });
  const contexte = await navigateur.newContext({
    permissions: ['camera'],
    ignoreHTTPSErrors: true
  });
  const page = await contexte.newPage();
  await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
  const resultat = await run(page);
  console.log(JSON.stringify(resultat, null, 2));
  await navigateur.close();
  process.exit(resultat.reussi ? 0 : 1);
}
