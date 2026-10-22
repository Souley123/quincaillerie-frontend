// Confirme la cause : le pont Capacitor/Node présent dans la page fait croire à
// un environnement natif, donc reloadOnPrerender() recharge la page sans fin.
export default async function run(page) {
  const etat = await page.evaluate(async () => {
    const mod = await import('/node_modules/@capacitor/core/dist/index.js').catch(e => ({ erreur: String(e) }));
    const core = typeof mod === 'object' && mod.Capacitor ? mod : null;
    return {
      charge: Boolean(core),
      estNatif: core ? core.Capacitor.isNativePlatform() : null,
      plateforme: core ? core.Capacitor.getPlatform() : null,
      reloadExiste: core ? typeof core.Capacitor.Plugins?.App?.reloadOnPrerender : 'n/a'
    };
  });

  // Compte les chargements de page pendant 5 secondes.
  await page.evaluate(() => {
    sessionStorage.setItem('compteur', String(Number(sessionStorage.getItem('compteur') || 0) + 1));
  });
  await page.waitForTimeout(5000);
  const compteur = await page.evaluate(() => sessionStorage.getItem('compteur'));

  const navigation = await page.evaluate(() => performance.getEntriesByType('navigation').map(n => n.type));
  return { etat, compteur, navigation };
}
