# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/portal-web/package.json apps/portal-web/
COPY packages/domain/package.json packages/domain/
COPY packages/site-schema/package.json packages/site-schema/
RUN npm ci -w @b2b/portal-web --include-workspace-root=false

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/portal-web/node_modules ./apps/portal-web/node_modules
COPY package.json package-lock.json ./
COPY packages/domain ./packages/domain
COPY packages/site-schema ./packages/site-schema
COPY apps/portal-web ./apps/portal-web
ARG NEXT_PUBLIC_APP_ROLE=
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_APP_ROLE=$NEXT_PUBLIC_APP_ROLE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/portal-web
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/portal-web
COPY --from=builder /app/apps/portal-web/.next ./.next
COPY --from=builder /app/apps/portal-web/public ./public
COPY --from=builder /app/apps/portal-web/package.json ./package.json
COPY --from=builder /app/apps/portal-web/next.config.mjs ./next.config.mjs
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/portal-web/node_modules ./node_modules
COPY --from=builder /app/packages /app/packages
EXPOSE 3410
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3410/ || exit 1
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3410"]
