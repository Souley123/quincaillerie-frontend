const assert = require('assert');

const service = require('../services/kkiapayService');
let passed = 0;
let failed = 0;

const test = (name, fn) => {
  try {
    fn();
    console.log(`  OK  ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  FAIL ${name}: ${error.message}`);
    failed += 1;
  }
};

test('success state is recognized case-insensitively', () => {
  assert.strictEqual(service.estReussie({ status: 'SUCCESS' }), true);
  assert.strictEqual(service.estReussie({ state: 'paid' }), true);
  assert.strictEqual(service.estReussie({ status: 'PENDING' }), false);
});

test('amount accepts supported fields and rejects missing/invalid amounts', () => {
  assert.strictEqual(service.montantDe({ amount: '5000' }), 5000);
  assert.strictEqual(service.montantDe({ montant: 125 }), 125);
  assert.strictEqual(service.montantDe({ amount: 'bad' }), 0);
  assert.strictEqual(service.montantDe(null), 0);
});

test('same tenant and transaction have a stable replay fingerprint', () => {
  const one = service.empreinteReference('acme', 'tx-123');
  assert.strictEqual(one, service.empreinteReference('ACME', 'tx-123'));
  assert.notStrictEqual(one, service.empreinteReference('OTHER', 'tx-123'));
});

console.log(`\n${passed} test(s) passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
