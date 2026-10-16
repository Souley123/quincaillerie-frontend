/**
 * Vérifie que le backend PUBLIC est à jour et que la réinitialisation de mot de
 * passe fonctionne. Conçu pour tourner en local ET en CI (GitHub Actions) :
 * sort avec un code non nul si le backend déployé est obsolète.
 *
 * Ce script détecte précisément le problème « ça marche en interne mais pas en
 * externe » : un backend qui tourne une ancienne version (routes récentes
 * absentes → 404) alors que le code local est correct.
 *
 * Usage :
 *   node scripts/verifier-prod.mjs
 *   API_URL=http://localhost:5001 node scripts/verifier-prod.mjs
 *
 * Codes de sortie :
 *   0 = backend à jour ET réinitialisation opérationnelle
 *   1 = backend joignable mais ANCIEN (routes récentes absentes)
 *   2 = backend injoignable (réseau / service éteint)
 */
const API = (process.env.API_URL || 'https://gestion-de-stocks-5lv3.onrender.com').replace(/\/$/, '')
const ORIGINE = process.env.ORIGINE || 'https://souley123.github.io'

/* L'adresse de test : volontairement inexistante pour ne déclencher AUCUN envoi
   réel. La réponse reste 200 avec le message générique (anti-énumération), ce
   qui suffit à prouver que la route existe et répond. */
const EMAIL_TEST = process.env.EMAIL_TEST || 'verification-automatique@exemple-invalide.test'

const resultats = []
const journal = (ok, libelle, detail = '') => {
  resultats.push({ ok, libelle, detail })
  console.log(`${ok ? 'OK  ' : 'KO  '} ${libelle}${detail ? ` — ${detail}` : ''}`)
}

/* --- 1. Le backend répond-il ? ------------------------------------------- */
let racineOk = false
try {
  const reponse = await fetch(`${API}/`, { headers: { Origin: ORIGINE } })
  const corps = await reponse.text()
  racineOk = reponse.ok
  journal(reponse.ok, 'GET /', `HTTP ${reponse.status} — ${corps.slice(0, 120)}`)
} catch (err) {
  journal(false, 'GET /', `injoignable : ${err.message}`)
  console.error('')
  console.error('>>> Backend injoignable. Verifier le reseau ou que le service Render est demarre.')
  process.exit(2)
}

/* --- 2. La route /health existe-t-elle (marqueur de version récente) ? ---- */
try {
  const reponse = await fetch(`${API}/health`, { headers: { Origin: ORIGINE } })
  const corps = await reponse.text()
  journal(reponse.ok, 'GET /health (backend a jour ?)', `HTTP ${reponse.status} — ${corps.slice(0, 120)}`)
} catch (err) {
  journal(false, 'GET /health (backend a jour ?)', err.message)
}

/* --- 3. La route de réinitialisation existe-t-elle ? --------------------- */
try {
  const reponse = await fetch(`${API}/api/auth/mot-de-passe/oublie`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGINE },
    body: JSON.stringify({ email: EMAIL_TEST })
  })
  const corps = await reponse.text()
  journal(reponse.ok, 'POST /api/auth/mot-de-passe/oublie', `HTTP ${reponse.status} — ${corps.slice(0, 120)}`)
} catch (err) {
  journal(false, 'POST /api/auth/mot-de-passe/oublie', err.message)
}

/* --- 4. CORS strict actif ? (evil.example.com doit être refusé) ---------- */
try {
  const reponse = await fetch(`${API}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example.com',
      'Access-Control-Request-Method': 'POST'
    }
  })
  const refuse = reponse.status === 403
  journal(refuse, 'CORS origin inconnue refusee', `HTTP ${reponse.status} (attendu 403)`)
} catch (err) {
  journal(false, 'CORS origin inconnue refusee', err.message)
}

/* --- Verdict ------------------------------------------------------------- */
const echecs = resultats.filter(r => !r.ok)
console.log('')
if (echecs.length === 0) {
  console.log('VERDICT : backend A JOUR, réinitialisation opérationnelle.')
  process.exit(0)
}

const backendObsolete = echecs.some(e => e.libelle.includes('/health'))
console.error(`VERDICT : ${echecs.length} controle(s) en echec.`)
if (backendObsolete) {
  console.error('>>> Le backend public est OBSOLETE (routes recentes absentes).')
  console.error('>>> Action : redéployer le dernier commit sur Render (Manual Deploy).')
  process.exit(1)
}
console.error('>>> Backend joignable mais certains controles echouent (voir ci-dessus).')
process.exit(1)
