# ============================================================
# REVEIL AUTOMATIQUE DU BACKEND RENDER - SKYS ERP Solution
# ------------------------------------------------------------
# Le backend heberge sur Render s'endort apres ~15 min d'inactivite.
# Le premier appel suivant (cold start) met 20 a 50 s a repondre, ce qui
# provoque un echec de connexion cote utilisateur ("le serveur met du
# temps a demarrer").
#
# Ce script appelle la route d'accueil de l'API pour maintenir le service
# eveille. IMPORTANT : il NE bloque PAS la mise en veille de l'ordinateur.
# Le mode recommande est la tache planifiee Windows : le Planificateur
# reveille brievement la machine, lance UN ping, puis la laisse revenir en
# veille. La boucle infinie en premier plan est desormais OPTIONNELLE
# (option -Continu) car elle empeche l'ordinateur de s'eteindre.
#
# UTILISATION
#   Un seul ping (mode par defaut, recommande) :
#       powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1
#
#   Idem, conserve pour compatibilite :
#       powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1 -UneFois
#
#   Boucle continue en premier plan (ATTENTION : empeche la veille du PC) :
#       powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1 -Continu
#
#   Planificateur de taches Windows (toutes les 5 min, en arriere-plan) :
#       powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1 -Install
#
#   Suppression de la tache planifiee :
#       powershell -ExecutionPolicy Bypass -File .\ping-reveil.ps1 -Uninstall
# ============================================================

[CmdletBinding()]
param(
    # URL publique du backend (route d'accueil : renvoie statut "ok").
    [string]$Url = 'https://gestion-de-stocks-5lv3.onrender.com/',

    # Intervalle entre deux pings, en minutes.
    [int]$IntervalleMinutes = 5,

    # Effectue un seul ping puis quitte (utile pour tester).
    [switch]$UneFois,

    # Boucle infinie en premier plan. DECONSEILLE : empeche la veille du PC.
    [switch]$Continu,

    # Installe une tache planifiee Windows qui relance ce script regulierement.
    [switch]$Install,

    # Supprime la tache planifiee Windows.
    [switch]$Uninstall
)

$NomTache = 'SKYS-ERP-Reveil-Backend'

# ------------------------------------------------------------
# Installation / suppression de la tache planifiee
# ------------------------------------------------------------
if ($Install) {
    $script = $MyInvocation.MyCommand.Path
    # -UneFois est ESSENTIEL : sans lui, chaque declenchement lancerait une
    # boucle infinie cachee qui empeche l'ordinateur de se mettre en veille.
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -UneFois"
    $declencheur = New-ScheduledTaskTrigger -Once -At (Get-Date) `
        -RepetitionInterval (New-TimeSpan -Minutes $IntervalleMinutes)
    # -AllowStartIfOnBatteries / -DontStopIfGoingOnBatteries : le ping doit
    # continuer meme sur batterie. Ces options concernent la TACHE, pas la
    # veille du PC : elles ne forcant PAS l'ordinateur a rester allume.
    $parametres = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

    Register-ScheduledTask -TaskName $NomTache -Action $action -Trigger $declencheur `
        -Settings $parametres -Description "Maintient le backend SKYS ERP (Render) eveille." -Force | Out-Null

    Write-Host "Tache planifiee '$NomTache' installee (toutes les $IntervalleMinutes min)." -ForegroundColor Green
    return
}

if ($Uninstall) {
    Unregister-ScheduledTask -TaskName $NomTache -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Tache planifiee '$NomTache' supprimee." -ForegroundColor Green
    return
}

# ------------------------------------------------------------
# Ping (une fois ou en boucle)
# ------------------------------------------------------------
function Invoke-Ping {
    param([string]$Cible)

    $debut = Get-Date
    try {
        # --max-time 90 : on tolere le cold start (jusqu'a ~50 s mesures).
        $code = curl.exe -sS -o NUL -w "%{http_code}" --max-time 90 $Cible 2>$null
        $duree = [math]::Round(((Get-Date) - $debut).TotalSeconds, 1)

        if ($code -eq '200') {
            Write-Host ("[{0}] OK  HTTP {1} en {2}s - backend eveille." -f (Get-Date -Format 'HH:mm:ss'), $code, $duree) -ForegroundColor Green
        }
        else {
            Write-Host ("[{0}] Reponse inattendue : HTTP {1} en {2}s." -f (Get-Date -Format 'HH:mm:ss'), $code, $duree) -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host ("[{0}] Echec du ping : {1}" -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor Red
    }
}

# ------------------------------------------------------------
# Mode continu (boucle infinie) - OPTIONNEL et DECONSEILLE
# ------------------------------------------------------------
# ATTENTION : une boucle infinie en premier plan maintient une activite
# permanente qui EMPECHE Windows de se mettre en veille / d'eteindre
# l'ecran. A n'utiliser que si vous acceptez que le PC reste eveille.
if ($Continu) {
    Write-Host "ATTENTION : mode continu. Ce PC ne pourra pas se mettre en veille. Ctrl+C pour arreter." -ForegroundColor Yellow
    while ($true) {
        Invoke-Ping -Cible $Url
        Start-Sleep -Seconds ($IntervalleMinutes * 60)
    }
}

# ------------------------------------------------------------
# Mode par defaut : UN seul ping puis sortie
# ------------------------------------------------------------
# La repetition est assuree par le Planificateur de taches Windows, qui
# reveille brievement le PC, lance ce script, puis rend la main. Le PC peut
# donc se remettre en veille normalement : il ne s'eteint plus tout seul.
Invoke-Ping -Cible $Url