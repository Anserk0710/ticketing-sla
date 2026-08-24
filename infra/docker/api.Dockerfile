FROM node:22-alpine AS build
WORKDIR /app

# Salin seluruh monorepo agar npm dapat menyelesaikan workspace lokal.
COPY . .
RUN npm run preflight \
    && npm install --workspaces --include-workspace-root --no-audit --no-fund
RUN npm run db:generate \
    && npm run build -w @ticketing/contracts \
    && npm run build -w @ticketing/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache su-exec

# Copy files with node user ownership
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --chown=node:node --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node --from=build /app/packages/contracts ./packages/contracts
COPY --chown=node:node infra/docker/api-entrypoint.sh ./infra/docker/api-entrypoint.sh

# Prepare uploads directory and entrypoint permissions
RUN mkdir -p apps/api/uploads \
    && chown -R node:node /app/apps/api/uploads \
    && chmod +x ./infra/docker/api-entrypoint.sh

WORKDIR /app/apps/api
EXPOSE 3000

ENTRYPOINT ["/app/infra/docker/api-entrypoint.sh"]
