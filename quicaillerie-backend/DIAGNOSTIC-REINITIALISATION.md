# Réinitialisation de mot de passe — diagnostic définitif

## Symptôme rapporté
« Le lien/e-mail de réinitialisation ne parvient pas au destinataire : ça passe
en interne, ça ne passe pas en externe. »

## Ce qui a été testé (preuves)

| Test | Commande | Résultat |
| --- | --- | --- |
| Configuration SMTP | `node scripts/diagnostic-smtp.mjs` | ✅ identifiants acceptés par Gmail |
| Envoi réel vers une adresse EXTERNE | `node scripts/diagnostic-smtp.mjs ksouleymanesoro60@gmail.com` | ✅ **accepté par Gmail** |
| Backend **local** `/health` | `Invoke-WebRequest http://localhost:5001/health` | ✅ `200` |
| Backend **local** `/api/auth/mot-de-passe/oublie` | idem en POST | ✅ `200` (e-mail envoyé) |
| Backend **Render** `/health` | `Invoke-WebRequest https://gestion-de-stock-ae8a.onrender.com/health` | ❌ **`404`** |
| Backend **Render** `/api/auth/mot-de-passe/oublie` | POST | ❌ **`404`** |

## Cause racine (certaine)

Le SMTP et le code applicatif fonctionnent. Le problème n'est NI le SMTP, NI le
code, NI « l'interne vs l'externe » au sens réseau.

> **Le service Render `gestion-de-stock-ae8a` exécute une ANCIENNE version du
> code, antérieure au commit `458a967` qui a ajouté la route
> `/api/auth/mot-de-passe/oublie` et `/health`.**

Preuve : en production, `/health` (présent dans le code depuis `458a967`) renvoie
`404`, et la réponse de `/` ne contient pas les champs `version`/`statut`/
`horodatage` que le code actuel renvoie. Le service déployé est donc en retard.

C'est pourquoi :
- **en local** (« interne ») → tout fonctionne, la route existe ;
- **en production** (« externe ») → `404`, le frontend affiche
  « Service de réinitialisation indisponible ».

### Pourquoi le déploiement n'a pas suivi
- Le service a été **créé manuellement** dans Render avec un nom différent
  (`gestion-de-stock-ae8a`) de celui du blueprint (`skys-erp-solution-api`).
- Un second `render.yaml` (dans `quincaillerie-frontend/`) portait ce nom
  divergent → source de confusion. **Il a été supprimé.**

## Correctifs appliqués dans le code (déjà poussés sur `main`)

1. **Frontend** (`src/services/api.js` + `src/App.js`) : le formulaire
   « Mot de passe oublié » envoie désormais le **slug** (entreprise). L'e-mail
   n'étant unique que PAR entreprise, l'absence de slug pouvait viser le mauvais
   compte et empêcher le lien d'atteindre le bon destinataire.
2. **`render.yaml` (racine)** : `buildCommand: npm install --omit=dev` (tolérant
   aux écarts de lockfile) au lieu de `npm ci` strict, qui pouvait faire échouer
   le build et laisser le service sur une ancienne version.
3. **Suppression** du `render.yaml` trompeur dans `quincaillerie-frontend/`.

## ⚠️ Action requise (hors code) — à faire UNE fois

Le redéploiement Render ne peut pas être déclenché depuis ce dépôt (pas de token
API Render configuré). Il faut le faire dans le **dashboard Render** :

1. Ouvrir le service **`gestion-de-stock-ae8a`**.
2. **Settings** → vérifier :
   - Repository : `Souley123/quincaillerie-frontend`
   - Branch : `main`
   - Root Directory : `quicaillerie-backend`
   - Build Command : `npm install`
   - Start Command : `npm start`
   - **Auto-Deploy : `Yes` (On Commit)** ← indispensable pour que ça ne se
     reproduise jamais.
3. **Manual Deploy → Deploy latest commit** (déclenche le déploiement maintenant).
4. Attendre la fin du build (2–5 min).

## Vérification finale

### Contrôle global (backend à jour + réinitialisation + CORS)

```powershell
# Depuis quicaillerie-backend
node scripts/verifier-prod.mjs
```

| Sortie | Signification |
| --- | --- |
| `VERDICT : backend A JOUR…` (code `0`) | tout est bon en production. |
| `>>> Le backend public est OBSOLETE` (code `1`) | routes récentes absentes : **redéployer**. |
| `>>> Backend injoignable` (code `2`) | réseau ou service Render éteint. |

### Contrôle ciblé de la réinitialisation

```powershell
node scripts/diagnostic-oublie.mjs ksouleymanesoro60@gmail.com maquincaillerie
```

Attendu après redéploiement :

```
GET .../health
HTTP 200 — {"statut":"ok","base":"connectee",...}
POST .../api/auth/mot-de-passe/oublie
HTTP 200 — {"message":"Si ce compte existe, un lien de réinitialisation lui sera envoyé."}
OK : le backend a accepte la demande.
```

Tant que `/health` renvoie `404`, le backend n'est **pas** à jour et aucun
correctif de code ne changera le résultat : il faut redéployer.

## Surveillance automatique (pour que ça ne revienne jamais)

Un workflow GitHub exécute `scripts/verifier-prod.mjs` automatiquement :

- **après chaque push sur `main`** (juste après un déploiement),
- **toutes les 6 heures** (veille),
- **à la demande** (onglet Actions → « Surveiller le backend en production » →
  *Run workflow*).

Fichier : `.github/workflows/surveiller-backend.yml`.

> Si ce job devient **rouge**, le backend déployé est obsolète : redéployer sur
> Render (section « Action requise » ci-dessus). C'est exactement le symptôme
> « ça marche en interne mais pas en externe ».
