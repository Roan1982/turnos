#!/bin/bash

echo "🐳 Iniciando construcción optimizada de Docker..."

# Verificar que estamos en la carpeta correcta
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: No se encuentra docker-compose.yml"
    echo "📁 Asegúrate de estar en la carpeta appointment-reminder-app"
    exit 1
fi

# Limpiar containers y volúmenes anteriores si es necesario
echo "🧹 Limpiando recursos anteriores..."
docker-compose down -v 2>/dev/null || true
docker system prune -f 2>/dev/null || true

# Iniciar MongoDB primero (no necesita build, usa imagen oficial)
echo "📦 Iniciando MongoDB..."
docker-compose up -d mongo

echo "⏳ Esperando que MongoDB esté listo..."
sleep 15

echo "🔧 Construyendo Backend..."
docker-compose build backend --no-cache

echo "🎨 Construyendo Frontend..."
docker-compose build frontend --no-cache

echo "🚀 Iniciando todos los servicios..."
docker-compose up -d

echo "📊 Estado de los servicios:"
docker-compose ps

echo "📋 Para ver los logs en tiempo real, ejecuta:"
echo "docker-compose logs -f"

echo "✅ ¡Construcción completada!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo "🗄️ MongoDB: localhost:27017"
