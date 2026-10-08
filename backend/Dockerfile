# --- build: instala todo, genera el cliente Prisma y compila TypeScript ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime: solo dependencias de producción ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/prisma ./prisma
# prisma (CLI) es devDependency: se instala aparte para poder correr `migrate deploy` al arrancar
RUN npm install --no-save prisma@5.22.0 && npx prisma generate
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
# Aplica las migraciones pendientes y arranca la API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
