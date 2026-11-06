# Starts Mesa de Ceniza for the local network (openspec/specs/lan-deployment.md).
#   powershell -ExecutionPolicy Bypass -File scripts/lan-up.ps1 [-AI] [-Rebuild]
param([switch]$AI, [switch]$Rebuild)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path .env)) {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', ''
    (Get-Content .env.example) -replace '^JWT_SECRET=.*', "JWT_SECRET=$secret" | Set-Content -Encoding utf8 .env
    Write-Host "Creado .env con un JWT_SECRET aleatorio."
}

$composeArgs = @('compose')
if ($AI) { $composeArgs += @('--profile', 'ai') }
$composeArgs += @('up', '-d')
if ($Rebuild) { $composeArgs += '--build' }
& docker @composeArgs
if ($LASTEXITCODE -ne 0) { throw "docker compose falló ($LASTEXITCODE)" }

$port = (Select-String -Path .env -Pattern '^APP_PORT=(\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value }) | Select-Object -First 1
if (-not $port) { $port = 8080 }
Write-Host ""
Write-Host "Mesa de Ceniza está arrancando. Abre desde cualquier dispositivo de tu red:"
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    ForEach-Object { Write-Host ("  http://{0}:{1}" -f $_.IPAddress, $port) }
Write-Host "  http://localhost:$port (este equipo)"
Write-Host ""
Write-Host "La primera cuenta que se registre será administradora."
if ($AI) { Write-Host "Ollama: descarga los modelos con  docker compose exec ollama ollama pull nomic-embed-text  y  ollama pull llama3.2" }
