# KINGPACK — Deploy estándar desde Windows local
# Uso: powershell -File .\scripts\deploy.ps1
# Requiere: alias 'kingpack-vps' configurado en ~/.ssh/config

$ErrorActionPreference = 'Stop'

Write-Host "=== KINGPACK Deploy (local -> VPS) ===" -ForegroundColor Cyan

# 1) Validar repo limpio y rama master
$status = git -C "$PSScriptRoot\.." status --porcelain
if ($status) {
    Write-Host "✗ Hay cambios sin commitear. Commiteá y pusheá antes de deployar." -ForegroundColor Red
    Write-Host $status
    exit 1
}

$branch = (git -C "$PSScriptRoot\.." rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'master') {
    Write-Host "✗ Estás en la rama '$branch'. Cambiá a 'master' antes de deployar." -ForegroundColor Red
    exit 1
}

# 2) Push (por las dudas)
Write-Host "[1/3] Pushing master a origin..." -ForegroundColor Cyan
git -C "$PSScriptRoot\.." push origin master

# 3) Ejecutar deploy en el VPS
Write-Host "[2/3] Ejecutando deploy en VPS..." -ForegroundColor Cyan
ssh kingpack-vps "cd /var/www/KINGPACK && bash scripts/deploy.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "✗ Deploy falló." -ForegroundColor Red; exit 1 }

# 4) Smoke test desde local
Write-Host "[3/3] Smoke test público..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri 'http://76.13.112.206/api/health' -TimeoutSec 10
    Write-Host ("Health: status=$($health.status) db=$($health.db)") -ForegroundColor Green
} catch {
    Write-Host "✗ /api/health no responde:" $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "✓ Deploy OK — http://76.13.112.206/articulos" -ForegroundColor Green
