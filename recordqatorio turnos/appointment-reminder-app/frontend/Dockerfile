FROM node:16-alpine

WORKDIR /app

# Instalar dependencias necesarias para desarrollo
RUN apk add --no-cache python3 make g++

# Configurar npm para manejar timeouts y usar un registry más rápido
RUN npm config set timeout 600000 && \
    npm config set network-timeout 600000 && \
    npm config set registry https://registry.npmjs.org/

# Copiar archivos de configuración
COPY package*.json ./

# Limpiar el cache de npm
RUN npm cache clean --force

# Instalar dependencias con retry y configuraciones optimizadas
RUN npm install --no-package-lock --prefer-offline || \
    npm install --no-package-lock --registry https://registry.npmjs.org/ || \
    npm install --no-package-lock

# Copiar el resto de archivos
COPY . .

# Configurar entorno de desarrollo
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
ENV CI=false
ENV GENERATE_SOURCEMAP=false

EXPOSE 3000

# Iniciar en modo desarrollo
CMD ["npm", "start"]
