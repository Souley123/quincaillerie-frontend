const assert = require('assert');
const { construireLienReinitialisation } = require('../services/reinitialisationService');
const { construireLienReinitialisationPortail } = require('../controllers/clientPortalController');
const { construireLienVerification } = require('../services/verificationEmail');

const APP_URL_ATTENDUE = 'https://souley123.github.io/quincaillerie-frontend';
process.env.APP_URL = APP_URL_ATTENDUE;

const lienErp = construireLienReinitialisation('compte@example.com', 'ab'.repeat(32), 'atelier-ivoire');
assert.strictEqual(lienErp.origin, 'https://souley123.github.io');
assert.strictEqual(lienErp.pathname, '/quincaillerie-frontend/mot-de-passe/reinitialiser');
assert.strictEqual(lienErp.searchParams.get('email'), 'compte@example.com');
assert.strictEqual(lienErp.searchParams.get('jeton'), 'ab'.repeat(32));
assert.strictEqual(lienErp.searchParams.get('slug'), 'atelier-ivoire');

const lienClient = construireLienReinitialisationPortail('atelier-ivoire', 'client@example.com', 'cd'.repeat(32));
assert.strictEqual(lienClient.pathname, '/quincaillerie-frontend/client/mot-de-passe/reinitialiser');
assert.strictEqual(lienClient.searchParams.get('slug'), 'atelier-ivoire');

const lienVerification = new URL(construireLienVerification('ef'.repeat(32), 'nouveau@example.com'));
assert.strictEqual(lienVerification.pathname, '/quincaillerie-frontend');
assert.strictEqual(lienVerification.searchParams.get('verifierEmail'), 'ef'.repeat(32));

process.env.APP_URL = 'http://insecure.example.com';
assert.throws(() => construireLienReinitialisation('user@example.com', 'ab'.repeat(32), 'demo'));
assert.throws(() => construireLienReinitialisationPortail('demo', 'client@example.com', 'cd'.repeat(32)));
assert.throws(() => construireLienVerification('ef'.repeat(32), 'nouveau@example.com'));

console.log('URL de réinitialisation/verification: OK');
