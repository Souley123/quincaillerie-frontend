# Vérifie l'état du backend public : santé + CORS (web et natif mobile).
# Usage : powershell -ExecutionPolicy Bypass -File .\verifier-deploiement.ps1

$api = "https://gestion-de-stock-ae8a.onrender.com"
$ok = $true

Write-Host ""
Write-Host "=== Backend public : $api ===" -ForegroundColor Cyan
Write-Host ""

# 1. Santé
Write-Host "[1] Sante de l'API (GET /)" -ForegroundColor Yellow
try {
  $reponse = curl.exe -sS --max-time 90 "$api/"
  Write-Host "    $reponse"
  if ($reponse -match "SKYS ERP") { Write-Host "    OK" -ForegroundColor Green }
  else { Write-Host "    Reponse inattendue" -ForegroundColor Red; $ok = $false }
} catch {
  Write-Host "    Echec : $_" -ForegroundColor Red
  $ok = $false
}

# 2. CORS : test de plusieurs origines
Write-Host ""
Write-Host "[2] CORS (prevol OPTIONS /api/auth/login)" -ForegroundColor Yellow

function Test-Origine($origine, $attendu) {
  $code = curl.exe -sS -o NUL -w "%{http_code}" --max-time 60 -X OPTIONS "$api/api/auth/login" `
    -H "Origin: $origine" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
  $couleur = if ("$code" -eq "$attendu") { "Green" } else { "Red" }
  Write-Host ("    {0,-40} -> {1} (attendu {2})" -f $origine, $code, $attendu) -ForegroundColor $couleur
  if ("$code" -ne "$attendu") { $script:ok = $false }
}

Test-Origine "https://souley123.github.io" "204"   # frontend web
Test-Origine "https://localhost"          "204"   # Android / iOS (https)
Test-Origine "capacitor://localhost"      "204"   # iOS (scheme capacitor)
Test-Origine "https://evil.example.com"   "403"   # doit etre REFUSEE

Write-Host ""
if ($ok) {
  Write-Host "TOUT EST OK : le backend public est a jour." -ForegroundColor Green
} else {
  Write-Host "ATTENTION : le backend public n'est PAS a jour (ou CORS non configure)." -ForegroundColor Red
  Write-Host "Voir CHECKLIST-DEPLOIEMENT.md (dashboard Render)." -ForegroundColor Yellow
}
Write-Host ""