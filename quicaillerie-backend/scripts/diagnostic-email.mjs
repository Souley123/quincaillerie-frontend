/** Diagnostic protégé du fournisseur email, sans afficher les clés. */
const API = (process.env.API_URL || 'https://gestion-de-stocks-5lv3.onrender.com').replace(/\/$/, '');
const token = process.env.DIAG_TOKEN;
const destinataireTest = process.env.EMAIL_TEST_TO || process.env.DIAG_EMAIL_TEST_TO;
if (!token) {
  console.error('Définir DIAG_TOKEN dans l’environnement local avant d’exécuter ce diagnostic.');
  process.exit(2);
}
try {
  const response = await fetch(`${API}/diagnostic-email`, {
    headers: { accept: 'application/json', 'x-diagnostic-token': token },
    signal: AbortSignal.timeout(15000)
  });
  const report = await response.json();
  console.log(JSON.stringify(report, null, 2));
  if (!response.ok || !report.configuration?.appUrlValide || !report.testCanal?.ok) {
    process.exitCode = 1;
  } else if (destinataireTest) {
    const testResponse = await fetch(`${API}/diagnostic-email/test`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-diagnostic-token': token
      },
      body: JSON.stringify({ to: destinataireTest }),
      signal: AbortSignal.timeout(20000)
    });
    const testReport = await testResponse.json();
    console.log('Résultat de l’envoi réel :');
    console.log(JSON.stringify(testReport, null, 2));
    if (!testResponse.ok || testReport.envoye !== true) process.exitCode = 1;
  }
} catch (error) {
  console.error(`Diagnostic inaccessible : ${error.message}`);
  process.exitCode = 1;
}
