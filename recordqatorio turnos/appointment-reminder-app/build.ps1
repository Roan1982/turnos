# PowerShell script para construccion optimizada de Docker

Write-Host "Iniciando construccion optimizada de Docker..." -ForegroundColor Cyan

# Verificar que estamos en la carpeta correcta
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "Error: No se encuentra docker-compose.yml" -ForegroundColor Red
    Write-Host "Asegurate de estar en la carpeta appointment-reminder-app" -ForegroundColor Yellow
    exit 1
}

# Limpiar containers y volumenes anteriores si es necesario
Write-Host "Limpiando recursos anteriores..." -ForegroundColor Yellow
docker-compose down -v 2>$null
docker system prune -f 2>$null

# Iniciar MongoDB primero (no necesita build, usa imagen oficial)
Write-Host "Iniciando MongoDB..." -ForegroundColor Green
docker-compose up -d mongo

Write-Host "Esperando que MongoDB este listo..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "Construyendo Backend..." -ForegroundColor Blue
docker-compose build backend --no-cache

Write-Host "Construyendo Frontend..." -ForegroundColor Magenta
docker-compose build frontend --no-cache

Write-Host "Iniciando todos los servicios..." -ForegroundColor Green
docker-compose up -d

Write-Host "Estado de los servicios:" -ForegroundColor Cyan
docker-compose ps

Write-Host "Para ver los logs en tiempo real, ejecuta:" -ForegroundColor Yellow
Write-Host "docker-compose logs -f" -ForegroundColor White

Write-Host "Construccion completada!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "MongoDB: localhost:27017" -ForegroundColor Cyan
