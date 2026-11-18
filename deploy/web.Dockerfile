# Builds the React app and serves it with Caddy (see deploy/Caddyfile, mounted at runtime).
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_URL=""
ARG VITE_DEMO_LOGIN="1"
ARG VITE_TG_BOT_URL=""
ENV VITE_API_URL=$VITE_API_URL VITE_DEMO_LOGIN=$VITE_DEMO_LOGIN VITE_TG_BOT_URL=$VITE_TG_BOT_URL
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /src/dist /srv
