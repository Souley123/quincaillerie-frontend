const assert = require('assert');

process.env.JWT_SECRET = 'test-secret-for-auth-service-unit-tests-32-chars-minimum';
process.env.JWT_DUREE = '12h';

const auth = require('../services/authService');
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

test('new password hashes are versioned with 310k PBKDF2 iterations', () => {
  const hash = auth.hacherMotDePasse('Correct-Horse-12!');
  assert.match(hash, /^pbkdf2\$310000\$/);
  assert.strictEqual(auth.verifierMotDePasse('Correct-Horse-12!', hash), true);
  assert.strictEqual(auth.verifierMotDePasse('wrong-password', hash), false);
  assert.strictEqual(auth.besoinRehachage(hash), false);
});

test('legacy PBKDF2 hashes remain valid and are marked for migration', () => {
  const salt = 'a'.repeat(32);
  const { pbkdf2Sync } = require('crypto');
  const legacy = `${salt}:${pbkdf2Sync('Correct-Horse-12!', salt, 120000, 64, 'sha512').toString('hex')}`;
  assert.strictEqual(auth.verifierMotDePasse('Correct-Horse-12!', legacy), true);
  assert.strictEqual(auth.besoinRehachage(legacy), true);
});

test('password hashing rejects too-short and oversized input', () => {
  assert.throws(() => auth.hacherMotDePasse('short'));
  assert.throws(() => auth.hacherMotDePasse('x'.repeat(257)));
});

test('JWT contains required identity and expires; tampering is rejected', () => {
  const token = auth.signer({ companyId: 'ACME', email: 'user@example.com', role: 'Administrateur', id: 'id-1' });
  const payload = auth.verifier(token);
  assert.strictEqual(payload.companyId, 'ACME');
  assert(Number.isInteger(payload.exp));
  assert.strictEqual(auth.verifier(`${token.slice(0, -1)}x`), null);
});

console.log(`\n${passed} test(s) passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
