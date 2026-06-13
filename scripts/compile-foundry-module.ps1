<#
.SYNOPSIS
  Compiles the exported Foundry module's source JSON into ClassicLevel compendium
  packs using the Foundry CLI (@foundryvtt/foundryvtt-cli), and optionally installs
  the module into a Foundry data directory.

.EXAMPLE
  pwsh scripts/compile-foundry-module.ps1
  pwsh scripts/compile-foundry-module.ps1 -DataPath "C:\Users\eduar\AppData\Local\FoundryVTT\Data"
#>
param(
    [string]$ModuleDir = "dist/foundry-module",
    [string]$ModuleId  = "dnd-manager-srd",
    [string]$DataPath  = ""   # if set, the compiled module is copied to <DataPath>\modules\<ModuleId>
)

$ErrorActionPreference = "Stop"

# Resolve the fvtt CLI (npm global bin is not always on PATH on Windows).
$fvtt = (Get-Command fvtt -ErrorAction SilentlyContinue).Source
if (-not $fvtt) { $fvtt = Join-Path $env:APPDATA "npm\fvtt.cmd" }
if (-not (Test-Path $fvtt)) { throw "fvtt CLI not found. Install with: npm install -g @foundryvtt/foundryvtt-cli" }
Write-Host "Using fvtt: $fvtt"

$root = Resolve-Path $ModuleDir
$sourceRoot = Join-Path $root "packs/_source"
if (-not (Test-Path $sourceRoot)) { throw "No source packs at $sourceRoot - run: go run ./cmd/foundry-export" }

$packs = Get-ChildItem -Path $sourceRoot -Directory
foreach ($pack in $packs) {
    $name = $pack.Name
    $src  = $pack.FullName
    $jsonCount = (Get-ChildItem -Path $src -Filter *.json -File -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($jsonCount -eq 0) {
        Write-Host "skip   $name (no source documents)" -ForegroundColor DarkGray
        continue
    }
    # fvtt v3 appends the compendium name to --out, so point --out at the parent
    # "packs" dir; it produces packs/<name> (matching module.json path).
    $packsDir = Join-Path $root "packs"
    $out = Join-Path $packsDir $name
    if (Test-Path $out) { Remove-Item -Recurse -Force $out }

    Write-Host "pack   $name ($jsonCount docs) -> packs/$name" -ForegroundColor Cyan
    & $fvtt package pack -n $name --id $ModuleId --type Module --in $src --out $packsDir
    if ($LASTEXITCODE -ne 0) { throw "fvtt failed packing '$name' (exit $LASTEXITCODE)" }
}

Write-Host "`nCompiled packs:" -ForegroundColor Green
Get-ChildItem -Path (Join-Path $root "packs") -Directory | Where-Object { $_.Name -ne "_source" } |
    ForEach-Object { Write-Host ("  - " + $_.Name) }

if ($DataPath -ne "") {
    $dest = Join-Path $DataPath "modules/$ModuleId"
    Write-Host "`nInstalling module to $dest" -ForegroundColor Green
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Path (Join-Path $root "module.json") -Destination $dest
    Copy-Item -Path (Join-Path $root "packs") -Destination $dest -Recurse
    Write-Host "Installed. Enable the module in your Foundry world." -ForegroundColor Green
} else {
    Write-Host "`nNot installed (no -DataPath). Copy '$ModuleDir' into your Foundry Data/modules/ and enable it." -ForegroundColor Yellow
}
