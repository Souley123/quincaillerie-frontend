# Génération des visuels de marque SKYS ERP Solution
#
# À partir du logo source `src/Assets/logo.png.jpeg`, ce script produit :
#   - src/Assets/logo-fond-transparent.png : logo principal (fond transparent)
#   - src/Assets/logo-fond-sombre.png      : variante éclaircie (barre latérale)
#   - public/logo192.png, public/logo512.png : icônes PWA
#   - public/favicon.ico                   : icône d'onglet
#
# Prérequis : Windows avec .NET Framework (compilateur csc.exe intégré).
#
# Utilisation (depuis quincaillerie-frontend/) :
#   powershell -File scripts/generer-logo.ps1

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

Write-Host "Compilation du générateur..."
& $csc /nologo /out:"scripts\generer-logo.exe" /reference:System.Drawing.dll "scripts\generer-logo.cs"
if (-not (Test-Path "scripts\generer-logo.exe")) {
  Write-Error "Échec de la compilation."
  exit 1
}

Write-Host "Génération des logos..."
& ".\scripts\generer-logo.exe" "src\Assets" "public"

Remove-Item "scripts\generer-logo.exe" -ErrorAction SilentlyContinue
Write-Host "Terminé. Logos régénérés dans src/Assets et public/."
