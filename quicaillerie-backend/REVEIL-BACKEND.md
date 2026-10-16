# Réveil automatique du backend Render — SKYS ERP Solution

## Pourquoi ?

Le backend est hébergé sur **Render** en offre gratuite : il **s'endort après
~15 minutes d'inactivité**. Le premier appel suivant déclenche un *cold start*
(réveil du serveur) qui peut prendre **20 à 50 secondes**.

Conséquence côté utilisateur : la requête de connexion dépasse le délai
d'attente et l'interface affiche un message d'échec, alors que la connexion
Internet fonctionne parfaitement.

> Mesure réelle effectuée : première réponse du serveur en **33 s** après
> inactivité. Le délai par défaut du client (20 s) était donc trop court.

## Le script `ping-reveil.ps1`

Il appelle la **route d'accueil** du backend
(`https://gestion-de-stocks-5lv3.onrender.com/`), qui renvoie `{ statut: "ok" }`
avec un vrai code **HTTP 200**. Ce trafic régulier empêche la mise en veille et
rend la connexion instantanée.

> **Mode par défaut = UN SEUL ping.** Lancé sans option, le script envoie un
> unique ping puis se termine : il ne maintient **pas** une boucle en arrière-plan
> et n'empêche donc **pas** la mise en veille de votre PC. La répétition est
> assurée soit par le Planificateur de tâches Windows (voir `-Install`), soit par
> un service externe 24/7. La boucle infinie n'existe plus que via l'option
> explicite `-Continu`.

## Utilisation

Toutes les commandes se lancent depuis le dossier `quicaillerie-backend`.

| Objectif | Commande |
|----------|----------|
| **Un seul ping** (mode par défaut, recommandé) | `powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1` |
| **Un seul ping** (compatibilité) | `powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1 -UneFois` |
| **Boucle continue** en premier plan (⚠️ empêche la veille du PC) | `powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1 -Continu` |
| **Installer la tâche planifiée Windows** (toutes les 5 min, arrière-plan) | `powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1 -Install` |
| **Supprimer la tâche planifiée** | `powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1 -Uninstall` |

### Options disponibles

| Option | Défaut | Rôle |
|--------|--------|------|
| `-Url` | `https://gestion-de-stocks-5lv3.onrender.com/` | URL publique à pinguer |
| `-IntervalleMinutes` | `5` | Intervalle entre deux pings |
| `-UneFois` | — | Un seul ping puis sortie (équivalent au mode par défaut) |
| `-Continu` | — | Boucle infinie en premier plan (⚠️ empêche la veille du PC) |
| `-Install` | — | Installe la tâche planifiée `SKYS-ERP-Reveil-Backend` |
| `-Uninstall` | — | Supprime la tâche planifiée |

### Ce que fait la tâche planifiée

- Nom : **`SKYS-ERP-Reveil-Backend`**
- Se relance **toutes les 5 minutes**, en arrière-plan (`-WindowStyle Hidden`).
- **Chaque déclenchement lance un SEUL ping (`-UneFois`) puis se termine** : la
  machine n'est sollicitée que quelques secondes et peut se remettre en veille
  normalement (elle ne reste plus allumée en permanence).
- Démarre même si l'heure prévue est manquée (`-StartWhenAvailable`).
- Continue sur batterie (`-AllowStartIfOnBatteries`).

> ⚠️ **Ne lancez jamais le script en premier plan sans option** si vous voulez
> que votre ordinateur puisse s'éteindre : le mode par défaut est un ping unique,
> mais l'ancien comportement (boucle infinie) empêchait la mise en veille. La
> boucle reste disponible via l'option explicite `-Continu`.

## Limite importante

La tâche planifiée ne tourne **que lorsque votre PC est allumé**. Si la machine
est éteinte, le backend peut s'endormir à nouveau.

### Solution recommandée pour un maintien 24/7

Utilisez un service de surveillance externe **gratuit** (indépendant de votre
machine) :

- **cron-job.org** — https://cron-job.org
- **UptimeRobot** — https://uptimerobot.com

Configuration :

- **URL à surveiller** : `https://gestion-de-stocks-5lv3.onrender.com/`
- **Intervalle** : toutes les 5 minutes
- **Méthode** : `GET`

C'est la solution la plus fiable : elle maintient le serveur éveillé même quand
votre ordinateur est éteint.

## Note sur l'encodage du fichier

`ping-reveil.ps1` est volontairement écrit **sans caractères accentués**.
PowerShell 5.1 lit les fichiers `.ps1` en ANSI : des accents ou tirets longs
(`—`) en UTF-8 corrompent le parsing du script (« Jeton inattendu »).