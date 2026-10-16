/**
 * Marque des comptes comme « adresse e-mail verifiee ».
 *
 * Pourquoi ce script existe : tant que `emailVerifie` vaut false, le bandeau
 * « Confirmez votre adresse e-mail pour securiser votre compte. » reste affiche
 * dans le tableau de bord, et le middleware tenant.js refuse l'acces a l'API
 * (403 EMAIL_NON_VERIFIE). Le bouton « Renvoyer l'e-mail » ne peut rien y faire
 * si le SMTP est indisponible : on debloque donc directement le compte.
 *
 * Usage :
 *   node scripts/verifier-comptes.mjs                      # liste seulement
 *   node scripts/verifier-comptes.mjs mon@email.ci         # verifie ce compte
 *   node scripts/verifier-comptes.mjs mon@email.ci autre@x # plusieurs comptes
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const dotenv = require('dotenv')
const mongoose = require('mongoose')
dotenv.config({ path: new URL('../.env', import.meta.url) })

const cibles = process.argv.slice(2).map(e => e.toLowerCase().trim()).filter(Boolean)

await mongoose.connect(process.env.MONGODB_URI)
const COLL = mongoose.connection.collection('utilisateurs')

if (cibles.length === 0) {
  const docs = await COLL.find({})
    .project({ email: 1, companyId: 1, emailVerifie: 1 })
    .toArray()
  console.log('Comptes et etat de verification :')
  for (const d of docs) {
    console.log(`- ${d.email} | entreprise=${d.companyId} | emailVerifie=${d.emailVerifie}`)
  }
  console.log('')
  console.log('Aucun compte cible. Relancer avec un email en argument pour le verifier.')
  await mongoose.disconnect()
  process.exit(0)
}

const resultat = await COLL.updateMany(
  { email: { $in: cibles } },
  { $set: { emailVerifie: true, verificationEmailHash: null, verificationEmailExpire: null } }
)

console.log(`Comptes mis a jour : ${resultat.modifiedCount}/${cibles.length}`)
if (resultat.matchedCount !== cibles.length) {
  console.log(`ATTENTION : ${cibles.length - resultat.matchedCount} email(s) introuvable(s) en base.`)
}

const verifies = await COLL.find({ email: { $in: cibles } })
  .project({ email: 1, companyId: 1, emailVerifie: 1 })
  .toArray()
console.log('')
console.log('Etat final :')
for (const d of verifies) {
  console.log(`- ${d.email} | entreprise=${d.companyId} | emailVerifie=${d.emailVerifie}`)
}
console.log('')
console.log('Le bandeau disparait a la prochaine connexion (apiMoi renvoie emailVerifie: true).')

await mongoose.disconnect()
