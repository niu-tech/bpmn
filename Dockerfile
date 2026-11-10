# syntax=docker/dockerfile:1
#
# bpmn é só front-end estático (modelador + viewer/simulação rodam no navegador; não há backend).
# O TLS é terminado no nginx do host (proxy_pass -> 127.0.0.1:BPMN_PORT); o container fala HTTP puro na 80.
# Passo a passo na VPS: deploy/README.md

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY webpack.config.js ./
COPY src ./src
# webpack.config.js fixa mode=development (é o que o dev server usa); aqui o CLI sobrescreve p/ bundle minificado
RUN npm run build -- --mode production

FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
# O webpack só emite bundles + fontes. As páginas e os diagramas, em dev, vêm do devServer.static
# (src/ e diagrams/ servidos na raiz) — o build não os copia, então a imagem precisa copiar.
COPY src/index.html src/viewer.html /usr/share/nginx/html/
COPY diagrams/ /usr/share/nginx/html/
