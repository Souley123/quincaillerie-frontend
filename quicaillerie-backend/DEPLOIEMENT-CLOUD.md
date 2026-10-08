# Déploiement CLOUD sécurisé — SKYS ERP Solution

> **Réponse courte :** le serveur **est déjà dans le cloud** (Render, HTTPS).
> Il n'est pas sur votre ordinateur. Mais il tourne actuellement sur une
> **ancienne version du code** : le CORS strict et les 12 pare-feux ne sont
> **pas encore actifs en ligne**. Ce document explique comment corriger cela.

---

## 1. Choix de la meilleure option d'hébergement

| Option | Coût | Veille | Sécurité | Verdict |
| --- | --- | --- | --- | --- |
| **Render (plan Starter)** | ~7 $/mois | ❌ aucune | HSTS, TLS, isolation | ✅ **CHOISI** |
| Render (plan Free) | 0 $ | ⏸️ 15 min → 30 s d'attente | Correcte | ⚠️ Démo uniquement |
| Railway | ~5 $/mois | ❌ | Correcte | Alternative valable |
| Vercel / Netlify | Serverless | ❌ | Bonne | ❌ Express + Mongo mal adapté |
| VPS (OVH, Contabo) | ~5 $/mois | ❌ | À tout durcir soi-même | ❌ Trop de maintenance |
| Hébergement local | — | — | Faible | ❌ **À éviter** |

**Pourquoi Render Starter plutôt que Free :** le plan gratuit met le service
en veille après 15 minutes sans trafic. Cela crée trois problèmes réels :

1. **Sécurité** : pendant le réveil, les pare-feux applicatifs ne sont pas
   sollicités (le service ne répond pas), ce qui masque les incidents.
2. **Disponibilité** : un vendeur de gaz en pleine vente subit 30 s d'attente.
3. **Fiabilité** : les webhooks de paiement Kkiapay peuvent expirer pendant
   le réveil → ventes non confirmées.

Le plan Starter (~7 $/mois) supprime la veille et active le TLS géré, le
redémarrage automatique et les health checks.

---

## 2. État vérifié en ligne (14 avril 2026)

| Test | Résultat | Attendu | Statut |
| --- | --- | --- | --- |
| Santé `GET /` | répond | 200 | ✅ |
| CORS origine légitime | 204 | 204 | ✅ |
| CORS origine inconnue `evil.example.com` | **204** | **403** | ❌ **à corriger** |

Tant que `evil.example.com` renvoie `204`, l'API accepte **n'importe quel
site**, donc **les 12 pare-feux ne sont pas actifs**. La cause : le service
`gestion-de-stock-ae8a` n'est pas relié au bon dépôt/branche, ou n'a jamais
été redéployé depuis l'ajout de la sécurité.

---

## 3. Corriger le déploiement (procédure)

### Étape 1 — Relier le service au bon dépôt

Dashboard Render → service → **Settings** :

| Champ | Valeur |
| --- | --- |
| Repository | `Souley123/quincaillerie-frontend` |
| Branch | `main` |
| **Root Directory** | `quicaillerie-backend` |
| Build Command | `npm install --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Auto-Deploy | On Commit |

> ⚠️ Le dossier s'écrit **`quicaillerie-backend`** (un seul `n` après `quica`).

### Étape 2 — Variables d'environnement (secrets)

Render → **Environment** → ajouter :

| Clé | Valeur | Secret |
| --- | --- | --- |
| `NODE_ENV` | `production` | non |
| `MONGODB_URI` | URI MongoDB Atlas | **oui** |
| `JWT_SECRET` | 48 octets aléatoires | **oui** |
| `JWT_DUREE` | `12h` | non |
| `APP_URL` | `https://souley123.github.io/quincaillerie-frontend` | non |
| `CORS_ORIGINS` | `https://souley123.github.io,http://localhost:3000,http://127.0.0.1:3000` | non |
| `KKIAPAY_PUBLIC` | clé publique Kkiapay | non |
| `KKIAPAY_PRIVATE` | clé privée Kkiapay | **oui** |
| `KKIAPAY_SECRET` | clé secrète Kkiapay | **oui** |
| `ADMIN_EMAIL` | email d'alerte | non |
| `SMTP_*` | configuration email | **oui** |

Générer un `JWT_SECRET` solide :

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> 🔐 **Les clés Kkiapay `PRIVATE` et `SECRET` ne doivent JAMAIS apparaître
> dans le frontend.** Seule `KKIAPAY_PUBLIC` peut y figurer : elle ouvre le
> widget. Sans les deux autres, `/api/paiements/verifier` refuse toute
> validation — c'est volontaire.

### Étape 3 — Redéployer

Render → **Manual Deploy → Deploy latest commit**, puis attendre l'état **Live**.

### Étape 4 — Vérifier

```powershell
powershell -ExecutionPolicy Bypass -File .\verifier-deploiement.ps1
```

Attendu :

| Origine | Attendu |
| --- | --- |
| `https://souley123.github.io` | `204` |
| `https://localhost` (Android/iOS) | `204` |
| `capacitor://localhost` (iOS) | `204` |
| `https://evil.example.com` | **`403`** |

---

## 4. Les 12 pare-feux (actifs après redéploiement)

| # | Protection | Ce qu'elle bloque |
| --- | --- | --- |
| 1 | En-têtes renforcés | Clickjacking, MIME sniffing, XSS, fuite de référent |
| 2 | Anti-injection | `<script>`, `javascript:`, gestionnaires `onerror=` |
| 3 | Anti-XSS | Payloads HTML dans le corps et l'URL |
| 4 | Anti-NoSQL | Opérateurs Mongo `$where`, `$ne`, `$regex` |
| 5 | Anti-traversée | `../`, octet nul `%00`, fichiers cachés |
| 6 | Anti-usurpation d'origine | Formulaires de phishing postant depuis un autre site |
| 7 | Anti-rejeu | `Idempotency-Key` déjà traitée |
| 8 | Seau à jetons | Rafales de requêtes (par IP et par compte) |
| 9 | Anti-énumération | Délai constant : impossible de deviner si un compte existe |
| 10 | Détection d'outils offensifs | sqlmap, nikto, nmap, metasploit… |
| 11 | Limites de charge | URL > 2 Ko, JSON trop imbriqué |
| 12 | Journal d'audit | Empreintes IP hachées, corrélation `X-Request-Id` |

Ces pare-feux s'ajoutent aux protections déjà en place :

- Mots de passe **PBKDF2-SHA512** (120 000 itérations, sel aléatoire).
- Jetons **JWT HS256** portant le `companyId`.
- **Isolation multi-tenant** : chaque requête filtrée par `companyId`.
- Verrouillage après **5 échecs** (15 min) ; blocage après **3 réinitialisations**.
- **CORS en liste blanche** ; rate-limit 100 req/15 min, 10/15 min sur l'auth.

---

## 5. Sécurité des paiements (vérification serveur)

Le paiement ne peut **jamais** être validé par le navigateur. Le flux est :

1. Le frontend ouvre le widget Kkiapay (clé **publique**).
2. Kkiapay revient avec une **référence de transaction**.
3. Le frontend appelle `POST /api/paiements/verifier`.
4. Le **serveur** interroge Kkiapay avec ses clés secrètes.
5. Contrôles serveur : transaction réussie **ET** montant suffisant **ET**
   référence jamais utilisée.
6. Si tout est conforme, le serveur marque le paiement payé et active la vente
   ou l'abonnement. Sinon, il refuse et journalise la tentative.

Deux comptes totalement séparés :

- **Ventes** → compte du **commerçant** (ses propres références).
- **Abonnements** → compte de l'**éditeur** (développeur).

---

## 6. Contrôles de sécurité réguliers

```powershell
# Santé et état des pare-feux
curl.exe -sS https://VOTRE-API.onrender.com/

# CORS : l'origine inconnue DOIT être refusée
curl.exe -sS -o NUL -w "%{http_code}`n" -X OPTIONS https://VOTRE-API.onrender.com/api/auth/login `
  -H "Origin: https://evil.example.com" `
  -H "Access-Control-Request-Method: POST"

# Injection : la requête DOIT être refusée (400)
curl.exe -sS -X POST https://VOTRE-API.onrender.com/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"<script>alert(1)</script>\",\"motDePasse\":\"x\"}'
```

### Renouvellement des secrets

| Secret | Fréquence | Procédure |
| --- | --- | --- |
| `JWT_SECRET` | Tous les 6 mois | Render → Environment, puis redéployer (déconnecte les sessions). |
| `KKIAPAY_SECRET` | Tous les 6 mois | Dashboard Kkiapay, puis Render. |
| Mot de passe MongoDB | Tous les 6 mois | Atlas → Database Access, puis Render. |
| Liste des IP autorisées Atlas | À chaque changement | Atlas → Network Access (jamais `0.0.0.0/0` en production). |
