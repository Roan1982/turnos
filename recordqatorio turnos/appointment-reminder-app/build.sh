#!/bin/bash

echo "🐳 Iniciando construcción optimizada de Docker..."

# Limpiar containers y volúmenes anteriores si es necesario
echo "🧹 Limpiando recursos anteriores..."
docker-compose down -v 2>/dev/null || true
docker system prune -f 2>/dev/null || true

# Construir servicios por separado para mejor control
echo "📦 Construyendo MongoDB..."
docker-compose up -d mongo

echo "⏳ Esperando que MongoDB esté listo..."
sleep 10

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
