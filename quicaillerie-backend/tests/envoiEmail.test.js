const assert = require('assert');
const serviceEmail = require('../services/envoiEmail');
const { envoyerEmail } = serviceEmail;
const originalFetch = global.fetch;

(async () => {
  try {
    process.env.BREVO_API_KEY = 'test-api-key';
    process.env.SMTP_FROM = 'SKYS ERP <noreply@example.com>';
    global.fetch = async () => new Response(JSON.stringify({ messageId: '<brevo-test-id>' }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
    const brevoOk = await envoyerEmail({ to: 'user@example.com', subject: 'test', text: 'test' });
    assert.strictEqual(brevoOk.envoye, true);
    assert.strictEqual(brevoOk.mode, 'api');
    assert.strictEqual(brevoOk.id, '<brevo-test-id>');
    assert.deepStrictEqual(brevoOk.recipients, ['user@example.com']);
    assert.strictEqual(brevoOk.expediteur, 'noreply@example.com');

    global.fetch = async () => new Response(JSON.stringify({ message: 'unauthorized: private detail', code: 'unauthorized' }), { status: 401 });
    const brevoKo = await envoyerEmail({ to: 'user@example.com', subject: 'test', text: 'test' });
    assert.strictEqual(brevoKo.envoye, false);
    assert.match(brevoKo.erreur, /HTTP 401/);
    assert.doesNotMatch(brevoKo.erreur, /private detail/);

    global.fetch = async () => { throw new Error('socket path exposed'); };
    const brevoReseauKo = await envoyerEmail({ to: 'user@example.com', subject: 'test', text: 'test' });
    assert.strictEqual(brevoReseauKo.envoye, false);
    assert.strictEqual(brevoReseauKo.erreur, 'API Brevo inaccessible.');

    delete process.env.BREVO_API_KEY;
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASSWORD = 'not-a-real-password';
    process.env.RENDER = 'true';
    process.env.RENDER_SERVICE_TYPE = 'web';
    process.env.RENDER_INSTANCE_TYPE = 'free';
    assert.strictEqual(serviceEmail.modeEnvoi(), 'indisponible');
    serviceEmail._definirTransportSmtpPourTests(null);
    let optionsSmtp;
    serviceEmail._definirTransportSmtpPourTests({
      sendMail: async options => {
        optionsSmtp = options;
        return { messageId: 'smtp-test-id', accepted: ['user@example.com'], rejected: [], response: '250 2.0.0 accepted', envelope: { from: 'user@example.com', to: ['user@example.com'] } };
      }
    });

    const smtpBloqueRender = await envoyerEmail({ to: 'user@example.com', subject: 'test', text: 'test' });
    assert.strictEqual(smtpBloqueRender.envoye, false);
    assert.strictEqual(smtpBloqueRender.code, 'SMTP_EGRESS_BLOCKED');
    assert.strictEqual(optionsSmtp, undefined, 'ne doit même pas tenter une connexion SMTP sur Render gratuit');

    process.env.RENDER_INSTANCE_TYPE = 'starter';
    assert.strictEqual(serviceEmail.modeEnvoi(), 'smtp', 'SMTP doit être sélectionné sur un plan Render payant');
    const smtpPayant = await envoyerEmail({ to: 'user@example.com', subject: 'test', text: 'test' });
    assert.strictEqual(smtpPayant.envoye, true);
    assert.strictEqual(optionsSmtp.to, 'user@example.com');

    process.env.RENDER_INSTANCE_TYPE = 'free';
    process.env.BREVO_API_KEY = 'test-api-key';
    global.fetch = async () => new Response(JSON.stringify({ messageId: '<brevo-test-id>' }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
    const smtpOk = await envoyerEmail({ to: 'user@example.com', subject: 'test', text: 'test' });
    delete process.env.BREVO_API_KEY;
    assert.strictEqual(smtpOk.envoye, true);
    assert.strictEqual(smtpOk.mode, 'api');
    assert.strictEqual(smtpOk.id, '<brevo-test-id>');
    assert.deepStrictEqual(smtpOk.recipients, ['user@example.com']);

    process.env.BREVO_API_KEY = '';
    delete process.env.RENDER;
    delete process.env.RENDER_SERVICE_TYPE;
    delete process.env.RENDER_INSTANCE_TYPE;
    serviceEmail._definirTransportSmtpPourTests({
      sendMail: async () => ({ messageId: 'smtp-rejected-id', accepted: [], rejected: ['user@example.com'] })
    });
    const smtpKo = await envoyerEmail({ to: 'user@example.com', subject: 'test', text: 'test' });
    assert.strictEqual(smtpKo.envoye, false);
    assert.match(smtpKo.erreur, /n’a accepté aucun destinataire/);

    console.log('Envoi Brevo/SMTP : OK');
  } finally {
    serviceEmail._definirTransportSmtpPourTests(null);
    global.fetch = originalFetch;
    delete process.env.BREVO_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.RENDER;
    delete process.env.RENDER_SERVICE_TYPE;
    delete process.env.RENDER_INSTANCE_TYPE;
    delete process.env.SMTP_FROM;
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
