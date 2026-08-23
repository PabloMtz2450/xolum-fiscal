$ErrorActionPreference = 'Stop'

Write-Host '== XOLUM Fiscal · entorno local ==' -ForegroundColor Cyan

if (-not (Test-Path '.env.local')) {
    Copy-Item '.env.local.example' '.env.local'
    Write-Host 'Creado .env.local desde plantilla local.' -ForegroundColor Yellow
}

Write-Host 'Levantando PostgreSQL...' -ForegroundColor Cyan
docker compose up -d postgres

Write-Host 'Esperando healthcheck de PostgreSQL...' -ForegroundColor Cyan
for ($i = 0; $i -lt 40; $i++) {
    $status = docker inspect --format='{{.State.Health.Status}}' xolum-fiscal-postgres 2>$null
    if ($status -eq 'healthy') { break }
    Start-Sleep -Seconds 2
}

$status = docker inspect --format='{{.State.Health.Status}}' xolum-fiscal-postgres
if ($status -ne 'healthy') { throw 'PostgreSQL no alcanzó estado healthy.' }

Write-Host 'Instalando dependencias...' -ForegroundColor Cyan
npm install

Write-Host 'Validando seed y RLS...' -ForegroundColor Cyan
npm run local:check

Write-Host ''
Write-Host 'Base local preparada.' -ForegroundColor Green
Write-Host 'Inicia la app con: npm run dev' -ForegroundColor Green
Write-Host 'URL: http://localhost:3000' -ForegroundColor Green
