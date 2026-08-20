FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:3000/api/v1
ENV VITE_API_URL=$VITE_API_URL

# Copy the complete monorepo before dependency installation so npm can
# resolve local workspace/file dependencies without querying npmjs.org.
COPY . .
RUN npm run preflight \
    && npm install --workspaces --include-workspace-root --no-audit --no-fund
RUN npm run build -w @ticketing/contracts \
    && npm run build -w @ticketing/web

FROM nginx:1.27-alpine

ARG SERVER_IP=192.168.1.111

# Generate a self-signed certificate with proper Key Usage & EKU for TLS
RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/certs \
    && openssl req -x509 -newkey rsa:2048 -days 3650 -nodes \
        -keyout /etc/nginx/certs/server-key.pem \
        -out /etc/nginx/certs/server-cert.pem \
        -subj "/CN=${SERVER_IP}" \
        -addext "subjectAltName=IP:${SERVER_IP},IP:127.0.0.1" \
        -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
        -addext "extendedKeyUsage=serverAuth"

COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80 443
