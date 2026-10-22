/* Vérifie que le menu latéral reste FIXE au défilement de la page (ordinateur).
   Mesures : position CSS calculée, coordonnées avant/après défilement, marges
   et largeur du contenu principal par rapport à la sidebar. */
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173/quincaillerie-frontend/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  /* S'il y a un écran de connexion, on s'arrête là : le test porte sur l'ERP. */
  const sidebarExiste = await page.locator('.app-sidebar').count();
  if (!sidebarExiste) return { erreur: 'Aucune sidebar (.app-sidebar) : session non ouverte.' };

  const avant = await page.evaluate(() => {
    const s = document.querySelector('.app-sidebar');
    const m = document.querySelector('.app-main');
    const rs = s.getBoundingClientRect();
    const rm = m.getBoundingClientRect();
    const cs = getComputedStyle(s);
    return {
      position: cs.position,
      top: cs.top,
      left: cs.left,
      height: cs.height,
      zIndex: cs.zIndex,
      sidebarRect: { x: rs.x, y: rs.y, l: rs.width, h: rs.height },
      mainRect: { x: rm.x, l: rm.width },
      mainMarginLeft: getComputedStyle(m).marginLeft
    };
  });

  /* On fait défiler franchement (2 000 px) pour éprouver l'ancrage. */
  await page.evaluate(() => {
    const cible = document.querySelector('.app-main') || window;
    if (cible === window) window.scrollTo(0, 2000);
    else cible.scrollTop = 2000;
  });
  await page.waitForTimeout(400);

  const apres = await page.evaluate(() => {
    const s = document.querySelector('.app-sidebar');
    const r = s.getBoundingClientRect();
    return { x: r.x, y: r.y, l: r.width, h: r.height, defilement: document.querySelector('.app-main')?.scrollTop ?? window.scrollY };
  });

  return {
    avant,
    apres,
    /* Le menu est FIXE si sa position à l'écran n'a pas bougé. */
    resteFixe: avant.sidebarRect.x === apres.x && avant.sidebarRect.y === apres.y,
    contenuDecale: Math.abs(avant.mainRect.x - avant.sidebarRect.l) < 2
  };
}
