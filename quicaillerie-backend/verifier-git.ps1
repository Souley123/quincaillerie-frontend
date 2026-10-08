# Vérifie que le dépôt Git est sain avant déploiement.
# Usage : powershell -ExecutionPolicy Bypass -File .\quicaillerie-backend\verifier-git.ps1

# Le script vit dans quicaillerie-backend/ ; la racine du depot est son parent.
$racine = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $racine ".git"))) {
  # Repli : on remonte jusqu'a trouver un .git (max 3 niveaux).
  $candidat = $racine
  for ($i = 0; $i -lt 3; $i++) {
    if (Test-Path (Join-Path $candidat ".git")) { $racine = $candidat; break }
    $candidat = Split-Path -Parent $candidat
  }
}
Set-Location $racine

$ok = $true

Write-Host ""
Write-Host "=== Verification Git : $racine ===" -ForegroundColor Cyan
Write-Host ""

# 1. Le frontend est-il un gitlink (submodule fantome) ?
Write-Host "[1] Frontend versionne normalement ?" -ForegroundColor Yellow
$modeFrontend = (git ls-files -s "quincaillerie-frontend" 2>&1 | Out-String).Trim()

if ($modeFrontend -match "^160000") {
  Write-Host "    ANORMAL : quincaillerie-frontend est un submodule (mode 160000)." -ForegroundColor Red
  Write-Host "    Le dossier apparaitra VIDE sur GitHub." -ForegroundColor Red
  Write-Host "    Correction : voir CORRECTION-DEPLOIEMENT.md (Probleme A)." -ForegroundColor Yellow
  $ok = $false
} elseif ($modeFrontend -match "^040000") {
  Write-Host "    OK : dossier versionne normalement." -ForegroundColor Green
} else {
  Write-Host "    INCONNU : $modeFrontend" -ForegroundColor Red
  $ok = $false
}

# 2. Les fichiers cles du backend sont-ils suivis ?
Write-Host ""
Write-Host "[2] Fichiers critiques suivis par Git" -ForegroundColor Yellow

$critiques = @(
  "quicaillerie-backend/server.js",
  "quicaillerie-backend/middleware/pareFeu.js",
  "quicaillerie-backend/services/tunnels.js",
  "quicaillerie-backend/controllers/paiementController.js",
  "quicaillerie-backend/models/Transaction.js",
  "render.yaml"
)

foreach ($fichier in $critiques) {
  $suivi = git ls-files --error-unmatch $fichier 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "    OK      $fichier" -ForegroundColor Green
  } else {
    Write-Host "    MANQUE  $fichier" -ForegroundColor Red
    $script:ok = $false
  }
}

# 3. Le frontend a-t-il des fichiers suivis en nombre suffisant ?
Write-Host ""
Write-Host "[3] Fichiers frontend suivis" -ForegroundColor Yellow
$nb = (git ls-files "quincaillerie-frontend" 2>&1 | Measure-Object).Count

if ($nb -le 1) {
  Write-Host "    ANORMAL : seulement $nb fichier suivi. Le frontend n'est PAS versionne." -ForegroundColor Red
  Write-Host "    Attendu : plusieurs centaines de fichiers." -ForegroundColor Yellow
  $ok = $false
} else {
  Write-Host "    OK : $nb fichiers suivis." -ForegroundColor Green
}

# 4. Ecart avec le depot distant
Write-Host ""
Write-Host "[4] Ecart avec origin/main" -ForegroundColor Yellow
$ecart = (git rev-list --left-right --count origin/main...HEAD 2>&1 | Out-String).Trim()
Write-Host "    (retard, avance) = $ecart"

if ($ecart -match "^(\d+)\s+(\d+)") {
  if ($Matches[2] -ne "0") {
    Write-Host "    ATTENTION : $($Matches[2]) commit(s) local(aux) non pousse(s)." -ForegroundColor Yellow
    Write-Host "    Lancez : git push origin main" -ForegroundColor Yellow
  } else {
    Write-Host "    OK : tout est pousse." -ForegroundColor Green
  }
}

# 5. Modifications non commitees
Write-Host ""
Write-Host "[5] Modifications non commitees" -ForegroundColor Yellow
$modifs = git status --short 2>&1 | Where-Object { $_ -match "^\s*[MADRC]" -and $_ -notmatch "node_modules" }
if ($modifs) {
  Write-Host "    ATTENTION : fichiers modifies non commites :" -ForegroundColor Yellow
  $modifs | Select-Object -First 10 | ForEach-Object { Write-Host "      $_" }
} else {
  Write-Host "    OK : rien en attente." -ForegroundColor Green
}

Write-Host ""
if ($ok) {
  Write-Host "GIT SAIN : le depot peut etre deploye." -ForegroundColor Green
} else {
  Write-Host "PROBLEMES DETECTES : voir CORRECTION-DEPLOIEMENT.md." -ForegroundColor Red
}
Write-Host ""
