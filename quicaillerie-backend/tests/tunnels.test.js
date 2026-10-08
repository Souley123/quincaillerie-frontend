/**
 * Test du service de tunnels nationaux / internationaux.
 * Aucune base de données requise : logique pure.
 */
const assert = require('assert');
const {
  TUNNELS,
  choisirTunnel,
  calculerReprise,
  decrireTunnel
} = require('../services/tunnels');

let ok = 0;
let ko = 0;

const verifier = (nom, condition) => {
  if (condition) {
    console.log(`  OK   ${nom}`);
    ok++;
  } else {
    console.log(`  ECHEC ${nom}`);
    ko++;
  }
};

/* ---------- 1. Choix du tunnel ---------- */

verifier(
  'pays CI → tunnel national',
  choisirTunnel({ headers: { 'cf-ipcountry': 'CI' } }).nom === 'national'
);

verifier(
  'pays SN → tunnel national',
  choisirTunnel({ headers: { 'x-country': 'SN' } }).nom === 'national'
);

verifier(
  'pays FR → tunnel international',
  choisirTunnel({ headers: { 'cf-ipcountry': 'FR' } }).nom === 'international'
);

verifier(
  'réseau 3G → tunnel national',
  choisirTunnel({ headers: { 'x-network-type': '3g' } }).nom === 'national'
);

verifier(
  'en-tête X-Tunnel prioritaire',
  choisirTunnel({ headers: { 'x-tunnel': 'direct', 'cf-ipcountry': 'CI' } }).nom === 'direct'
);

verifier(
  'aucune indication → tunnel international',
  choisirTunnel({ headers: {} }).nom === 'international'
);

/* ---------- 2. Politique de reprise ---------- */

const national = TUNNELS.national;
const international = TUNNELS.international;

verifier(
  'le tunnel national est plus tolérant que l\'international',
  national.tentativesMax > international.tentativesMax
);

verifier(
  'le tunnel national attend moins longtemps au départ',
  national.delaiInitialMs < international.delaiInitialMs
);

verifier(
  'le tunnel national tolère de plus longues coupures',
  national.toleranceCoupureMs > international.toleranceCoupureMs
);

verifier(
  'reprise hors ligne : aucune tentative consommée',
  calculerReprise('national', 1, false).consommeTentative === false
);

verifier(
  'reprise : abandon après le maximum de tentatives',
  calculerReprise('international', 4, true).abandonner === true
);

verifier(
  'reprise : délai croissant (backoff exponentiel)',
  calculerReprise('national', 3, true).attendre >= calculerReprise('national', 1, true).attendre
);

verifier(
  'reprise : délai borné par le maximum du tunnel',
  calculerReprise('national', 4, true).attendre <= national.delaiMaxMs * 1.25
);

/* ---------- 3. Descripteur public ---------- */

const description = decrireTunnel({ headers: { 'cf-ipcountry': 'CI' } });
verifier('le descripteur expose le nom du tunnel', description.tunnel === 'national');
verifier('le descripteur expose la politique de reprise', Boolean(description.reprise));
verifier('le descripteur ne contient aucun secret', !JSON.stringify(description).includes('SECRET'));

console.log(`\n${ok} test(s) réussi(s), ${ko} échec(s)`);
process.exit(ko === 0 ? 0 : 1);
