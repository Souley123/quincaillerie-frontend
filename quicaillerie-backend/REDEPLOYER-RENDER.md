# 🔴 Redéployer le backend sur Render — procédure express

> **Quand utiliser ce document ?**
> Quand le test suivant montre que le backend public est **obsolète** :
>
> ```powershell
> cd quicaillerie-backend
> node scripts/verifier-prod.mjs
> ```
>
> Sortie typique à corriger :
> ```
> KO   GET /health (backend a jour ?) — HTTP 404
> KO   POST /api/auth/mot-de-passe/oublie — HTTP 404
> KO   CORS origin inconnue refusee — HTTP 204 (attendu 403)
> VERDICT : 3 controle(s) en echec.
> >>> Le backend public est OBSOLETE (routes recentes absentes).
> ```
>
> C'est le symptôme « la réinitialisation marche en local / en interne mais pas
> en ligne / en externe ». Le code est bon ; il faut juste **redéployer**.

---

## Étape 1 — Ouvrir le bon service

1. Aller sur <https://dashboard.render.com>.
2. Ouvrir le service **`gestion-de-stock-ae8a`**
   (⚠️ **pas** `skys-erp-solution-api`, qui est l'ancien nom trompeur).

## Étape 2 — Vérifier la configuration (à faire UNE fois)

Service → **Settings** :

| Champ | Valeur attendue |
| --- | --- |
| Repository | `Souley123/quincaillerie-frontend` |
| Branch | `main` |
| **Root Directory** | `quicaillerie-backend` |
| Build Command | `npm install --omit=dev` |
| Start Command | `npm start` |
| **Health Check Path** | `/health` |
| **Auto-Deploy** | **`Yes` (On Commit)** |

> Si **Auto-Deploy** n'est pas sur `Yes`, c'est **la cause** du problème :
> chaque nouveau commit poussé sur `main` n'est jamais déployé, et le service
> reste figé sur une vieille version. Le passer à `Yes` corrige la cause racine.

## Étape 3 — Déclencher le déploiement MAINTENANT

Deux options :

- **Bouton** : en haut à droite → **Manual Deploy** → **Deploy latest commit**.
- **Ou** : pousser n'importe quel commit sur `main` (une fois Auto-Deploy activé).

Attendre la fin du build (**2 à 5 min**). L'état doit passer à **Live**.

## Étape 4 — Vérifier

```powershell
cd quicaillerie-backend
node scripts/verifier-prod.mjs
```

Attendu :

```
OK   GET / — HTTP 200
OK   GET /health (backend a jour ?) — HTTP 200
OK   POST /api/auth/mot-de-passe/oublie — HTTP 200
OK   CORS origin inconnue refusee — HTTP 403
VERDICT : backend A JOUR, réinitialisation opérationnelle.
```

## Étape 5 — Test réel de bout en bout (facultatif)

```powershell
node scripts/diagnostic-oublie.mjs mon@email.ci mon-slug
```

Puis vérifier la **boîte de réception ET le dossier SPAM** du destinataire.

---

## Si le problème revient

1. Relancer `node scripts/verifier-prod.mjs`.
2. Si `GET /health` renvoie `404` → **Auto-Deploy a été désactivé** ou le service
   a été recréé. Reprendre à l'**Étape 2**.
3. Le workflow GitHub `.github/workflows/surveiller-backend.yml` signale ce cas
   automatiquement (job rouge) : inutile d'attendre qu'un utilisateur se plaigne.

## Points de vigilance

- Le dossier s'écrit **`quicaillerie-backend`** (un seul `n` après `quica`).
- Ne pas confondre avec **`quincaillerie-frontend`** (deux `n`) = le frontend.
- Après un redéploiement, les variables d'environnement (SMTP, `APP_URL`,
  `CORS_ORIGINS`, `JWT_SECRET`, `MONGODB_URI`) doivent être présentes dans
  **Environment**. Sans elles, l'e-mail de réinitialisation est silencieusement
  ignoré (voir `DIAGNOSTIC-REINITIALISATION.md`).
