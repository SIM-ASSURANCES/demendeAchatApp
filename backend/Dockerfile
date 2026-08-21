# Backend — API Node.js/TypeScript/Express/Prisma
#
# Alpine 3.18+ (base de node:20-alpine) ne fournit pas libssl1.1 par défaut, dont les moteurs
# Prisma ont besoin : sans ce paquet, le client échoue au runtime avec une erreur de parsing
# opaque ("Could not parse schema engine response"), pas une erreur explicite sur OpenSSL.
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

RUN mkdir -p uploads

EXPOSE 4000

# Migrations et seed (idempotent — upsert, ne réécrit jamais un compte déjà présent) à chaque
# démarrage, avant de lancer le serveur : nécessaire pour que les déploiements ultérieurs
# appliquent automatiquement les nouvelles migrations sans étape manuelle.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/index.js"]
