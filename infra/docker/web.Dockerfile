FROM node:22-alpine AS build
WORKDIR /app

# Copy the complete monorepo before dependency installation so npm can
# resolve local workspace/file dependencies without querying npmjs.org.
COPY . .
RUN npm run preflight \
    && npm install --workspaces --include-workspace-root --no-audit --no-fund
RUN npm run build -w @ticketing/contracts \
    && npm run build -w @ticketing/web

FROM nginx:1.27-alpine

COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80 443
