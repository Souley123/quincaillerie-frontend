/**
 * Inspecte les utilisateurs par email : combien de comptes, dans quelles
 * entreprises, actifs ou non, et l'etat de blocage de reinitialisation.
 * Sert a comprendre pourquoi un lien de reinitialisation ne part pas.
 *
 * Usage :
 *   node scripts/inspecter-utilisateurs.mjs                 # resume
 *   node scripts/inspecter-utilisateurs.mjs mon@email.ci    # cible un email
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const dotenv = require('dotenv')
const mongoose = require('mongoose')
dotenv.config({ path: new URL('../.env', import.meta.url) })

const cible = (process.argv[2] || '').toLowerCase().trim()

await mongoose.connect(process.env.MONGODB_URI)

const COLL = mongoose.connection.collection('utilisateurs')
const filtre = cible ? { email: cible } : {}
const docs = await COLL.find(filtre)
  .project({
    email: 1, companyId: 1, actif: 1, role: 1,
    bloqueReinitialisation: 1, reinitialisations: 1,
    emailVerifie: 1, bloque: 1, bloqueJusqua: 1
  })
  .toArray()

console.log(`Comptes trouves : ${docs.length}${cible ? ` pour ${cible}` : ''}`)
for (const d of docs) {
  console.log(
    `- ${d.email} | entreprise=${d.companyId} | actif=${d.actif} | role=${d.role} | ` +
    `emailVerifie=${d.emailVerifie} | bloqueReinit=${d.bloqueReinitialisation} | ` +
    `reinit=${d.reinitialisations} | bloque=${d.bloque}`
  )
}

if (!cible) {
  const doublons = await COLL.aggregate([
    { $group: { _id: '$email', n: { $sum: 1 }, entreprises: { $addToSet: '$companyId' } } },
    { $match: { n: { $gt: 1 } } }
  ]).toArray()
  console.log('')
  console.log(`Emails presents dans PLUSIEURS entreprises : ${doublons.length}`)
  for (const d of doublons) console.log(`- ${d._id} -> ${d.entreprises.join(', ')}`)
}

/* Entreprises et leur slug, pour relier companyId <-> slug. */
const ent = mongoose.connection.collection('entreprises')
const entreprises = await ent.find({}).project({ companyId: 1, slug: 1, actif: 1 }).toArray()
console.log('')
console.log('Entreprises (companyId -> slug) :')
for (const e of entreprises) console.log(`- ${e.companyId} -> ${e.slug} (actif=${e.actif})`)

await mongoose.disconnect()
