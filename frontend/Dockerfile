# Frontend — React/Vite, servi en statique par nginx.
#
# Important : Vite fige les variables VITE_* dans le bundle au moment du `npm run build`, pas à
# l'exécution du conteneur. VITE_API_URL doit donc être fourni en --build-arg au moment du
# `docker build`, jamais comme variable d'environnement du service dans docker-compose (qui
# n'aurait alors aucun effet — le JS est déjà compilé).
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
