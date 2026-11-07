# syntax=docker/dockerfile:1
# В финальный образ едет только standalone-рантайм, не весь node_modules.
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/portal-web/package.json apps/portal-web/
COPY packages/domain/package.json packages/domain/
COPY packages/site-schema/package.json packages/site-schema/
RUN npm ci -w @b2b/portal-web --include-workspace-root=false

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/domain ./packages/domain
COPY packages/site-schema ./packages/site-schema
COPY apps/portal-web ./apps/portal-web
ARG NEXT_PUBLIC_APP_ROLE=
ARG NEXT_PUBLIC_API_URL=https://b2b.avgst.ru
# Rewrites в next.config запекаются на билде.
ARG API_BASE_URL=http://api:4000
ENV NEXT_PUBLIC_APP_ROLE=$NEXT_PUBLIC_APP_ROLE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV API_BASE_URL=$API_BASE_URL
ENV APP_ROLE=$NEXT_PUBLIC_APP_ROLE
WORKDIR /app/apps/portal-web
RUN npm run build

FROM base AS runner
ARG NEXT_PUBLIC_APP_ROLE=
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV API_BASE_URL=http://api:4000
ENV APP_ROLE=$NEXT_PUBLIC_APP_ROLE
ENV NEXT_PUBLIC_APP_ROLE=$NEXT_PUBLIC_APP_ROLE
ENV PORT=3410
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/apps/portal-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/portal-web/.next/static ./apps/portal-web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/portal-web/public ./apps/portal-web/public
USER nextjs
EXPOSE 3410
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3410/ || exit 1
CMD ["node", "apps/portal-web/server.js"]
