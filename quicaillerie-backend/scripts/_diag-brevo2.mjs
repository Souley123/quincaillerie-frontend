import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url) });

const r = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    'api-key': process.env.BREVO_API_KEY
  },
  body: JSON.stringify({
    sender: { email: 'supportskys@gmail.com', name: 'SKYS ERP Solution' },
    to: [{ email: 'supportskys@gmail.com' }],
    subject: 'Test diagnostic',
    textContent: 'Test'
  })
});
console.log('HTTP', r.status);
console.log(await r.text());

const s = await fetch('https://api.brevo.com/v3/senders', { headers: { 'api-key': process.env.BREVO_API_KEY } });
console.log('\nSENDERS HTTP', s.status);
console.log((await s.text()).slice(0, 400));
