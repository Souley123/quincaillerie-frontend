/**
 * Diagnostique la configuration SMTP et l'envoi de l'e-mail de reinitialisation
 * de mot de passe. Reproduit exactement la chaine utilisee par
 * services/reinitialisationService.js : meme lecture des variables, meme
 * deduction du mode « secure », meme transport nodemailer.
 *
 * Usage :
 *   node scripts/diagnostic-smtp.mjs                    # verifie la config + le transport
 *   node scripts/diagnostic-smtp.mjs destinataire@x.ci  # envoie en plus un e-mail de test
 *
 * Codes de sortie :
 *   0 = configuration exploitable (et e-mail accepte par le serveur si fourni)
 *   1 = variable d'environnement manquante
 *   2 = identifiants refuses / transport injoignable (erreur SMTP)
 */
import { createRequire } from 'node:module'

/* Les modules sont resolus depuis quicaillerie-backend, meme si le script est
   lance depuis la racine du depot. */
const require = createRequire(import.meta.url)
const nodemailer = require('nodemailer')
const dotenv = require('dotenv')

/* dotenv cherche .env dans le repertoire courant ; on vise explicitement le
   .env de quicaillerie-backend pour que le diagnostic fonctionne depuis
   n'importe quel dossier. */
dotenv.config({ path: new URL('../.env', import.meta.url) })

const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, APP_URL } = process.env
const port = Number(process.env.SMTP_PORT || process.env.PORT_USER || 587)
const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465

const manquants = [
  ['SMTP_HOST', SMTP_HOST],
  ['SMTP_USER', SMTP_USER],
  ['SMTP_PASSWORD', SMTP_PASSWORD]
].filter(([, valeur]) => !valeur).map(([nom]) => nom)

console.log('--- Variables lues (comme le fait reinitialisationService.js) ---')
console.log(`SMTP_HOST      : ${SMTP_HOST || '(absent)'}`)
console.log(`SMTP_PORT      : ${process.env.SMTP_PORT || process.env.PORT_USER || '(absent, defaut 587)'}`)
console.log(`SMTP_SECURE    : ${process.env.SMTP_SECURE || '(absent, deduit du port)'}`)
console.log(`  -> port=${port}, secure=${secure}`)
console.log(`SMTP_USER      : ${SMTP_USER || '(absent)'}`)
console.log(`SMTP_PASSWORD  : ${SMTP_PASSWORD ? `(present, ${SMTP_PASSWORD.length} caracteres)` : '(absent)'}`)
console.log(`SMTP_FROM      : ${SMTP_FROM || '(absent, repli sur SMTP_USER)'}`)
console.log(`APP_URL        : ${APP_URL || '(absent)'}`)
console.log('')

/* Erreur classique : un mot de passe d'application Gmail est affiche par
   groupes de 4 caracteres separes par des espaces. Colle tel quel, il est
   refuse (535). On le signale sans jamais l'imprimer. */
if (SMTP_PASSWORD && /\s/.test(SMTP_PASSWORD)) {
  console.log('ATTENTION : SMTP_PASSWORD contient des espaces. Un mot de passe')
  console.log('d application Gmail doit etre colle SANS espaces (16 caracteres).')
  console.log('')
}

if (manquants.length) {
  console.error(`Configuration incomplete : ${manquants.join(', ')} manquant(s).`)
  console.error('Renseigner ces variables dans Render -> Environment puis redeployer.')
  process.exit(1)
}

/* La meme coherence de port que le code applicatif, verifiee explicitement. */
if (port === 465 && !secure) {
  console.error('Incoherence : port 465 avec secure=false. Mettre SMTP_SECURE=true.')
  process.exit(1)
}
if (port !== 465 && secure) {
  console.error('Incoherence : secure=true sur un port qui n est pas 465. STARTTLS attend secure=false.')
  process.exit(1)
}

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure,
  auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 12000
})

const destinataire = process.argv[2]
try {
  console.log(`Connexion a ${SMTP_HOST}:${port} (secure=${secure})...`)
  await transport.verify()
  console.log('OK : le serveur SMTP accepte les identifiants.')
} catch (err) {
  console.error('ECHEC de la connexion SMTP :', err.code || '', err.message)
  if (err.response) console.error('Reponse du serveur :', err.response)
  console.error('')
  console.error('Pistes selon le code d erreur :')
  console.error('  EAUTH / 535 : identifiants refuses. Le mot de passe d application')
  console.error('                appartient-il bien au compte SMTP_USER ?')
  console.error('  ETIMEDOUT   : port filtre. Sur Render, essayer 465 + SMTP_SECURE=true.')
  console.error('  ESOCKET     : blocage sortant du port. Idem, basculer sur 465.')
  process.exit(2)
}

if (!destinataire) {
  console.log('')
  console.log('Aucun destinataire fourni : envoi de test non effectue.')
  console.log('Pour tester un envoi reel : node scripts/diagnostic-smtp.mjs mon@email.ci')
  process.exit(0)
}

try {
  const info = await transport.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: destinataire,
    subject: '[ERP] Diagnostic SMTP — envoi de test',
    text: 'Ce message confirme que la chaine SMTP utilisee par la reinitialisation de mot de passe fonctionne.'
  })
  console.log('')
  console.log(`E-mail accepte par le serveur. Identifiant : ${info.messageId}`)
  console.log(`Destinataire : ${destinataire}`)
  console.log('Verifier EGALEMENT le dossier SPAM / courrier indesirable.')
  process.exit(0)
} catch (err) {
  console.error('ECHEC de l envoi :', err.code || '', err.message)
  if (err.response) console.error('Reponse du serveur :', err.response)
  process.exit(2)
}
