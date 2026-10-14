/**
 * Reproduit la topologie proxy de Render et verifie ce que vaut req.ip
 * pour differentes valeurs de « trust proxy ».
 *
 * Render place un proxy devant le conteneur. Selon le plan et le domaine
 * (onrender.com direct, ou Cloudflare devant), la chaine X-Forwarded-For
 * contient 1 ou 2 hops. Le test montre lequel de ces cas fait s'effondrer
 * req.ip sur une valeur PARTAGEE par tous les visiteurs — le bug qui rend
 * le rate limit global au lieu de par utilisateur.
 *
 * Usage : node scripts/verifier-trust-proxy.mjs
 */
import { createRequire } from 'node:module'

/* Express est charge depuis node_modules de quicaillerie-backend, meme si le
   script est lance depuis la racine du depot. */
const require = createRequire(import.meta.url)
const express = require('express')

/**
 * Envoie une requete au serveur local en simulant un proxy.
 * Le fetch sortant passe forcement par la pile reseau locale, donc Express
 * voit 127.0.0.1 comme pair : ce cas reproduit exactement le dernier hop.
 */
const sonder = async (port, chemin, entetes) => {
  const reponse = await fetch(`http://127.0.0.1:${port}${chemin}`, { headers: entetes })
  return (await reponse.text()).trim()
}

/**
 * Monte une app minimale avec la valeur de trust proxy donnee et rend
 * l'IP telle que Express la calcule.
 */
const demarrer = (trustProxy) => new Promise((resolve) => {
  const app = express()
  app.set('trust proxy', trustProxy)
  app.get('/ip', (req, res) => res.send(String(req.ip || req.socket?.remoteAddress || 'inconnu')))
  const serveur = app.listen(0, '127.0.0.1', () => resolve({ serveur, port: serveur.address().port }))
})

/* Les deux topologies a comparer. */
const SCENARIOS = [
  {
    nom: 'Render direct (1 proxy)',
    xff: '203.0.113.7'
  },
  {
    nom: 'Cloudflare + Render (2 proxies)',
    xff: '203.0.113.7, 10.0.0.1'
  }
]

/* Valeurs de trust proxy a l'etude. */
const VALEURS = [1, 2, true]

const lignes = []
for (const scenario of SCENARIOS) {
  for (const valeur of VALEURS) {
    const { serveur, port } = await demarrer(valeur)
    try {
      const ip = await sonder(port, '/ip', { 'X-Forwarded-For': scenario.xff })
      // L'IP du client est la PREMIERE de la liste X-Forwarded-For.
      const attendu = scenario.xff.split(',')[0].trim()
      lignes.push({
        scenario: scenario.nom,
        trustProxy: String(valeur),
        ipObtenue: ip,
        ipAttendue: attendu,
        verdict: ip === attendu ? 'correct' : 'PERDU (IP partagee)'
      })
    } finally {
      serveur.close()
    }
  }
}

console.log('trust proxy  | scenario                        | req.ip obtenue    | verdict')
console.log('-------------|---------------------------------|-------------------|------------------')
for (const l of lignes) {
  console.log(
    `${l.trustProxy.padEnd(12)} | ${l.scenario.padEnd(31)} | ${l.ipObtenue.padEnd(17)} | ${l.verdict}`
  )
}

const perdus = lignes.filter((l) => l.verdict !== 'correct')
console.log('')
if (perdus.length) {
  console.log(`${perdus.length} configuration(s) donnent une IP PARTAGEE :`)
  for (const l of perdus) {
    console.log(`  - trust proxy=${l.trustProxy} avec « ${l.scenario} » -> req.ip = ${l.ipObtenue} (attendu ${l.ipAttendue})`)
  }
  console.log('\nConsequence : tous les visiteurs derriere ce proxy comptent dans le MEME quota.')
} else {
  console.log('Toutes les configurations donnent l IP reelle du client.')
}
