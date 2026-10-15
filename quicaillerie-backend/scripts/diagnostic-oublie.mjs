/**
 * Test bout-en-bout de la demande de reinitialisation de mot de passe.
 * Reproduit EXACTEMENT l'appel du frontend (avec le slug) et verifie d'abord
 * que le backend DEPLOYE est a jour (route /health presente).
 *
 * Interet : distingue nettement les deux causes possibles d'echec —
 *   - 404 sur /api/auth/mot-de-passe/oublie  -> backend OBSOLETE (redeployer)
 *   - 200                                    -> backend a jour, e-mail envoye
 *
 * Usage :
 *   node scripts/diagnostic-oublie.mjs mon@email.ci [slug]
 *   API_URL=http://localhost:5001 node scripts/diagnostic-oublie.mjs mon@email.ci [slug]
 */
const API = (process.env.API_URL || 'https://gestion-de-stock-ae8a.onrender.com').replace(/\/$/, '')
const ORIGINE = process.env.ORIGINE || 'https://souley123.github.io'

const [email, slug] = process.argv.slice(2)
if (!email) {
  console.error('Usage : node scripts/diagnostic-oublie.mjs mon@email.ci [slug]')
  process.exit(2)
}

/* --- 1. Le backend deploye est-il a jour ? ------------------------------- */
console.log(`GET ${API}/health`)
let backendAJour = false
try {
  const sante = await fetch(`${API}/health`, { headers: { Origin: ORIGINE } })
  const corps = await sante.text()
  console.log(`HTTP ${sante.status} — ${corps.slice(0, 200)}`)
  backendAJour = sante.ok
} catch (err) {
  console.error(`ECHEC RESEAU sur /health : ${err.message}`)
}

if (!backendAJour) {
  console.error('')
  console.error('>>> Le backend deploye ne repond pas a /health.')
  console.error('>>> Cause probable : il tourne une ANCIENNE version du code')
  console.error('>>> (le commit qui ajoute la route de reinitialisation n a pas ete deploye).')
  console.error('>>> Action : redeployer le dernier commit sur Render, puis relancer ce test.')
  process.exit(2)
}

/* --- 2. La demande de reinitialisation aboutit-elle ? -------------------- */
console.log('')
const corps = slug ? { email, slug } : { email }
console.log(`POST ${API}/api/auth/mot-de-passe/oublie`)
console.log(`Corps envoye : ${JSON.stringify(corps)}`)
console.log('')

const debut = Date.now()
try {
  const reponse = await fetch(`${API}/api/auth/mot-de-passe/oublie`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGINE },
    body: JSON.stringify(corps)
  })
  const duree = ((Date.now() - debut) / 1000).toFixed(1)
  const texte = await reponse.text()
  console.log(`HTTP ${reponse.status} en ${duree}s`)
  console.log('Corps :', texte.slice(0, 500))
  if (reponse.status === 404) {
    console.error('')
    console.error('>>> 404 : la route est absente du backend deploye (backend obsolete).')
    process.exit(2)
  }
  if (!reponse.ok) {
    console.error('')
    console.error('>>> Echec cote serveur : voir le corps ci-dessus.')
    process.exit(1)
  }
  console.log('')
  console.log('OK : le backend a accepte la demande. Verifier la boite mail')
  console.log('(ET le dossier SPAM / courrier indesirable) du destinataire.')
} catch (err) {
  console.error(`ECHEC RESEAU : ${err.name} — ${err.message}`)
  if (err.cause) console.error('Cause :', err.cause)
  process.exit(1)
}
