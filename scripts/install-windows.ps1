param(
  [string]$DbPassword = "123456",
  [string]$Port = "4010",
  [switch]$SkipDbPush,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
Write-Host "Cristal Water Enterprise - Instalação Windows" -ForegroundColor Cyan
Set-Location $PSScriptRoot\..

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js não encontrado. Instala Node.js 20 LTS primeiro." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm não encontrado." }

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

$envText = Get-Content ".env" -Raw
$databaseUrl = "DATABASE_URL=`"postgresql://postgres:$DbPassword@localhost:5432/cristalwater?schema=public`""
if ($envText -match "(?m)^DATABASE_URL=") { $envText = $envText -replace "(?m)^DATABASE_URL=.*$", $databaseUrl } else { $envText += "`r`n$databaseUrl`r`n" }
if ($envText -match "(?m)^PORT=") { $envText = $envText -replace "(?m)^PORT=.*$", "PORT=$Port" } else { $envText += "`r`nPORT=$Port`r`n" }
if ($envText -match "(?m)^ENABLE_BACKGROUND_JOBS=") { $envText = $envText -replace "(?m)^ENABLE_BACKGROUND_JOBS=.*$", "ENABLE_BACKGROUND_JOBS=false" } else { $envText += "`r`nENABLE_BACKGROUND_JOBS=false`r`n" }
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path ".env"), $envText, $utf8NoBom)

# Garantir schema sem BOM
$schemaPath = "prisma\schema.prisma"
$schemaText = Get-Content $schemaPath -Raw
[System.IO.File]::WriteAllText((Resolve-Path $schemaPath), $schemaText, $utf8NoBom)

npm install
npm run prisma:generate
if (-not $SkipDbPush) { npm run prisma:push }
npm run test:functional
if (-not $SkipSeed) { npm run seed }
Write-Host "Instalação concluída. Para arrancar: npm run dev" -ForegroundColor Green
Write-Host "Abrir: http://localhost:$Port" -ForegroundColor Green
