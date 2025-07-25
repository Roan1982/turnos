# Sistema de Recordatorio de Turnos con WebSockets

Sistema completo para gestión y envío automático de recordatorios de citas médicas con actualizaciones en tiempo real.

## 🚀 Nuevas Características - Tiempo Real

- **📱 Actualizaciones en Tiempo Real**: Los cambios de estado se reflejan inmediatamente en el frontend
- **🔔 Notificaciones WebSocket**: Alertas instantáneas cuando se envían recordatorios
- **📊 Contadores Dinámicos**: Los contadores de turnos se actualizan automáticamente
- **⚡ Sincronización Automática**: No necesitas refrescar la página para ver cambios

## 📋 Características Principales

### ⏰ Recordatorios Programados
- **Email**: Se envía 72 horas antes del turno
- **WhatsApp**: Se envía 48 horas antes del turno
- **Cron Automático**: Verificación cada 5 minutos

### 🔄 Actualizaciones en Tiempo Real
- Cuando se envía un recordatorio, la tabla se actualiza instantáneamente
- Notificaciones visuales de recordatorios enviados
- Contadores de turnos pendientes/notificados en tiempo real
- Sincronización automática entre múltiples ventanas/usuarios

## 🐳 Instalación con Docker

### 1. Configurar Variables de Entorno

**Backend (.env):**
```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://mongo:27017/appointments
FRONTEND_URL=http://localhost:3000
CHROME_EXECUTABLE_PATH=/usr/bin/chromium
# NOTA: Email ya configurado en emailService.ts
```

**Frontend (.env):**
```env
REACT_APP_API_URL=http://localhost:3001
```

### 2. Ejecutar con Docker Compose
```bash
docker-compose up --build
```

### 3. Acceder a la Aplicación
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **MongoDB**: localhost:27017

## ⚡ Cómo Funciona el Tiempo Real

El sistema usa WebSockets (Socket.IO) para actualizaciones inmediatas:

1. **Envío Individual**: Cuando haces clic en un botón de email/WhatsApp, ves inmediatamente:
   - Notificación de confirmación
   - Cambio de estado del turno
   - Actualización de contadores

2. **Envío Masivo**: Al usar "Enviar Todos Pendientes":
   - Notificaciones por cada recordatorio enviado
   - Actualización en tiempo real de la tabla
   - Resumen final del procesamiento

3. **Múltiples Usuarios**: Si varios usuarios están usando el sistema:
   - Todos ven los cambios inmediatamente
   - No hay conflictos de estado
   - Sincronización automática

## 🔧 Endpoints API Nuevos

- `GET /api/appointments/verify-send-dates` - Verificar consistencia de fechas
- `POST /api/appointments/migrate-send-dates` - Migrar turnos existentes

## 🚀 Para Ejecutar

```bash
# 1. Construir y ejecutar todos los servicios
docker-compose up --build

# 2. Ver logs en tiempo real
docker-compose logs -f

# 3. Parar los servicios
docker-compose down
```

## 📱 Configuración WhatsApp y Email

1. **WhatsApp**: Escanea el QR que aparece en los logs del backend
2. **Email**: ✅ Ya configurado en `src/services/emailService.ts` con avisos@doctorfia.com

¡Ahora con actualizaciones en tiempo real! 🎉
