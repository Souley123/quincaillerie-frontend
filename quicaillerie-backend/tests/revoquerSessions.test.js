const assert = require('assert');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, '../scripts/revoquer-sessions.mjs'), 'utf8');

assert.match(script, /confirmation !== 'SUPPRIMER-TOUS-SAUF-ADMIN'/);
assert.match(script, /MONGODB_URI/);
assert.match(script, /const utilisateurs = mongoose\.connection\.collection\('utilisateurs'\)/);
assert.match(script, /utilisateurs\.deleteMany\(\{ role: \{ \$ne: 'Administrateur' \} \}\)/);
assert.match(script, /role: 'Administrateur', actif: \{ \$ne: false \}/);
assert.match(script, /\$inc: \{ verrouillageVersion: 1 \}/);
assert.doesNotMatch(script, /\.drop\(/);

console.log('Suppression des non-administrateurs : confirmation explicite, admins conservés et sessions révoquées : OK');
