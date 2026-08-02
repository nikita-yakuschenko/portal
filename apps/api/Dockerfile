# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
COPY packages/site-schema/package.json packages/site-schema/
# npm workspaces кладёт зависимости в корневой node_modules
RUN npm ci -w @b2b/api --include-workspace-root=false

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/domain ./packages/domain
COPY packages/site-schema ./packages/site-schema
COPY apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["sh", "-c", "npx tsx src/scripts/migrate.ts && npx tsx src/index.ts"]
