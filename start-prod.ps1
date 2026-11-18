# Dashboardni production rejimida ishga tushiradi va uzilsa o'zi qayta yoqadi (pm2 o'rnatilmagan bo'lsa ham ishlaydi).
#   powershell -ExecutionPolicy Bypass -File .\start-prod.ps1            (port 3000)
#   powershell -ExecutionPolicy Bypass -File .\start-prod.ps1 -Port 8080
param([int]$Port = 3000, [switch]$NoBuild)
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force logs | Out-Null
if (-not $NoBuild -or -not (Test-Path ".next\BUILD_ID")) {
  Write-Host "Build qilinmoqda..."
  npm run build
  if ($LASTEXITCODE -ne 0) { Write-Host "Build xato bilan tugadi."; exit 1 }
}
$env:NODE_ENV = "production"
while ($true) {
  Write-Host ("[{0}] Server ishga tushdi: http://localhost:{1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Port)
  node node_modules\next\dist\bin\next start -p $Port *>> logs\server.log
  Write-Host ("[{0}] Server to'xtadi (kod {1}). 5 soniyadan keyin qayta yoqiladi..." -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $LASTEXITCODE)
  Start-Sleep -Seconds 5
}
