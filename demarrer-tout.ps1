# ============================================================
# DEMARRAGE COMPLET - SKYS ERP Solution (backend + frontend)
# ------------------------------------------------------------
# Lance en une seule commande :
#   1. le backend local (http://localhost:5001)
#   2. le frontend local (http://localhost:3000)
#
# Pourquoi ce script ?
# En developpement local, le frontend appelle http://localhost:5001.
# Si le backend n'est pas demarre, chaque connexion echoue avec
# « Connexion impossible » (ERR_CONNECTION_REFUSED). Ce script evite
# cet oubli en verifiant/demarrant le backend automatiquement.
#
# UTILISATION (depuis la racine du projet) :
#   powershell -ExecutionPolicy Bypass -File .\demarrer-tout.ps1
#
#   Demarrer uniquement le backend :
#   powershell -ExecutionPolicy Bypass -File .\demarrer-tout.ps1 -BackendSeul
# ============================================================

[CmdletBinding()]
param(
    # Ne demarre que le backend (sans lancer le frontend).
    [switch]$BackendSeul
)

$Racine = $PSScriptRoot
$DossierBackend = Join-Path $Racine 'quicaillerie-backend'
$DossierFrontend = Join-Path $Racine 'quincaillerie-frontend'

# ------------------------------------------------------------
# Verification des dossiers
# ------------------------------------------------------------
foreach ($dossier in @($DossierBackend, $DossierFrontend)) {
    if (-not (Test-Path $dossier)) {
        Write-Host "Dossier introuvable : $dossier" -ForegroundColor Red
        exit 1
    }
}

# ------------------------------------------------------------
# Le backend ecoute-t-il deja sur le port 5001 ?
# ------------------------------------------------------------
function Test-BackendActif {
    $connexion = Get-NetTCPConnection -LocalPort 5001 -State Listen -ErrorAction SilentlyContinue
    return [bool]$connexion
}

# ------------------------------------------------------------
# 1. Backend
# ------------------------------------------------------------
if (Test-BackendActif) {
    Write-Host "[1/2] Backend deja en ecoute sur le port 5001." -ForegroundColor Green
}
else {
    Write-Host "[1/2] Demarrage du backend (port 5001)..." -ForegroundColor Cyan
    Start-Process -FilePath 'node' -ArgumentList 'server.js' `
        -WorkingDirectory $DossierBackend -WindowStyle Minimized

    # Attente de la mise en ecoute (MongoDB Atlas peut prendre quelques secondes).
    $tentatives = 0
    while (-not (Test-BackendActif) -and $tentatives -lt 30) {
        Start-Sleep -Seconds 1
        $tentatives++
    }

    if (Test-BackendActif) {
        Write-Host "      Backend pret sur http://localhost:5001" -ForegroundColor Green
    }
    else {
        Write-Host "      Le backend n'a pas demarre apres 30 s." -ForegroundColor Red
        Write-Host "      Verifiez que 'npm install' a bien ete lance dans quicaillerie-backend," -ForegroundColor Yellow
        Write-Host "      et que la connexion MongoDB Atlas est disponible." -ForegroundColor Yellow
        exit 1
    }
}

if ($BackendSeul) {
    Write-Host "Backend seul demande : arret du script." -ForegroundColor Cyan
    exit 0
}

# ------------------------------------------------------------
# 2. Frontend
# ------------------------------------------------------------
Write-Host "[2/2] Demarrage du frontend (port 3000)..." -ForegroundColor Cyan
Write-Host "      Le navigateur va s'ouvrir sur http://localhost:3000" -ForegroundColor Cyan
Write-Host "      Pour tout arreter : fermez cette fenetre ou faites Ctrl+C." -ForegroundColor DarkGray

Set-Location $DossierFrontend
npm start