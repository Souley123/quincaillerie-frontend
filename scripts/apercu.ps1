# Génération des aperçus de rendu du logo SKYS ERP Solution
#
# Compose deux images de contrôle visuel à partir des variantes PNG déjà
# détourées (fond transparent) produites par `generer-logo.ps1` :
#   - apercu-blanc.png  : logo sur fond blanc (page de connexion, documents)
#   - apercu-sombre.png : logo sur fond #0f172a (barre latérale sombre)
#
# Le JPEG source a un fond noir opaque : il n'est PAS utilisable directement
# pour un aperçu sur fond clair. Lancez d'abord `generer-logo.ps1` si les
# variantes ci-dessous sont absentes.
#
# Prérequis : Windows avec .NET Framework (compilateur csc.exe intégré).
#
# Utilisation (depuis quincaillerie-frontend/) :
#   powershell -File scripts/apercu.ps1

$racine = Split-Path -Parent $PSScriptRoot
Set-Location $racine

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
  $csc = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path $csc)) {
  Write-Error "Compilateur C# (csc.exe) introuvable. Installez le .NET Framework."
  exit 1
}

$clair = "src\Assets\logo-fond-transparent.png"
$sombre = "src\Assets\logo-fond-sombre.png"
if (-not (Test-Path $clair) -or -not (Test-Path $sombre)) {
  Write-Error "Variantes de logo absentes. Lancez d'abord scripts\generer-logo.ps1."
  exit 1
}

Write-Host "Compilation du générateur d'aperçus..."
& $csc /nologo /out:"scripts\apercu.exe" /reference:System.Drawing.dll "scripts\apercu.cs"
if (-not (Test-Path "scripts\apercu.exe")) {
  Write-Error "Échec de la compilation."
  exit 1
}

Write-Host "Génération des aperçus..."
& ".\scripts\apercu.exe" $clair $sombre

Remove-Item "scripts\apercu.exe" -ErrorAction SilentlyContinue
Write-Host "Terminé. Aperçus : apercu-blanc.png et apercu-sombre.png."
