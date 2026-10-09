const assert = require('assert');
const { stockDoitEtreRestitue } = require('../controllers/venteController');

assert.strictEqual(
  stockDoitEtreRestitue({ moyenPaiement: 'Kkiapay', statutPaiement: 'en_attente' }),
  false,
  'une vente Kkiapay en attente ne doit pas restituer le stock à son annulation'
);
assert.strictEqual(
  stockDoitEtreRestitue({ moyenPaiement: 'Kkiapay', statutPaiement: 'payee' }),
  true,
  'une vente payée doit restituer le stock à son annulation'
);

console.log('OK  annulation de vente Kkiapay en attente sans restitution du stock');
