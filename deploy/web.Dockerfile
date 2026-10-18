# Build ng React (Vite), tapos Caddy ang magse-serve at magpo-proxy ng /api
FROM node:22-alpine AS build
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
# "/api" ang default para same-origin sa Caddy (walang CORS na aayusin)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /web/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
