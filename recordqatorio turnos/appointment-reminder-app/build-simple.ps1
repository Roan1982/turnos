# Script simple para construccion de Docker

Write-Host "=== CONSTRUCCION DOCKER ===" -ForegroundColor Green

# Verificar ubicacion
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: No se encuentra docker-compose.yml" -ForegroundColor Red
    Write-Host "Ejecuta este script desde la carpeta appointment-reminder-app" -ForegroundColor Yellow
    exit 1
}

# Paso 1: Limpiar
Write-Host "Paso 1: Limpiando recursos anteriores..." -ForegroundColor Yellow
docker-compose down -v
docker system prune -f

# Paso 2: MongoDB
Write-Host "Paso 2: Iniciando MongoDB..." -ForegroundColor Blue
docker-compose up -d mongo
Write-Host "Esperando 15 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# Paso 3: Backend
Write-Host "Paso 3: Construyendo Backend..." -ForegroundColor Blue
docker-compose build backend --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Fallo la construccion del backend" -ForegroundColor Red
    exit 1
}

# Paso 4: Frontend
Write-Host "Paso 4: Construyendo Frontend..." -ForegroundColor Blue
docker-compose build frontend --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Fallo la construccion del frontend" -ForegroundColor Red
    exit 1
}

# Paso 5: Iniciar todo
Write-Host "Paso 5: Iniciando todos los servicios..." -ForegroundColor Green
docker-compose up -d

# Resultado
Write-Host "=== COMPLETADO ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "MongoDB: localhost:27017" -ForegroundColor Cyan
Write-Host "" 
Write-Host "Para ver logs: docker-compose logs -f" -ForegroundColor White
Write-Host "Para parar: docker-compose down" -ForegroundColor White
