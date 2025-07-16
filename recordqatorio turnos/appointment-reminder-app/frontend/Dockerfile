FROM node:16-alpine

WORKDIR /app

# Instalar dependencias necesarias para desarrollo
RUN apk add --no-cache python3 make g++

# Copiar archivos de configuración
COPY package*.json ./

# Limpiar el cache de npm y node_modules
RUN rm -rf node_modules package-lock.json

# Instalar ajv explícitamente primero
RUN npm install ajv@8.12.0

# Instalar dependencias con opciones para asegurar compatibilidad
RUN npm install --force

# Verificar que ajv está instalado correctamente
RUN npm list ajv

# Copiar el resto de archivos
COPY . .

# Configurar entorno de desarrollo
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
ENV CI=true

EXPOSE 3000

# Iniciar en modo desarrollo
CMD ["npm", "start"]
