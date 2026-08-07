# syntax=docker/dockerfile:1
# Playwright-образ уже содержит Chromium и системные библиотеки — собирать
# браузер поверх node:alpine дороже и ломается на каждом обновлении.
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/instagram-collector/package.json apps/instagram-collector/
COPY packages/domain/package.json packages/domain/
RUN npm ci -w @b2b/instagram-collector --include-workspace-root=false --omit=dev

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/domain ./packages/domain
COPY apps/instagram-collector ./apps/instagram-collector
WORKDIR /app/apps/instagram-collector

# Сервис внутренний: наружу не публикуется, ходит только API по общему токену
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4100/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "src/index.ts"]
