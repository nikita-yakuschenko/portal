# B2B Platform

Платформа для управления дилерской сетью AVGST.

## Контур продукта

- HQ синхронизирует каталог домов и ассеты с Tilda.
- Партнёр регистрируется и получает кабинет.
- Для партнёра создаётся отдельный сайт на общем движке.
- Лиды с сайта уходят в CRM партнёра и сохраняются в HQ-аналитике.

## Workspace

- `apps/api` - backend API и доменные сервисы.
- `apps/portal-web` - кабинет HQ и партнёров.
- `apps/site-runtime` - движок сайтов партнёров.
- `packages/domain` - общие типы и правила.

## Команды

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d postgres
npm run db:migrate -w @b2b/api
npm run typecheck
npm run test
```

## Локальный запуск (порядок)

Два отдельных терминала PowerShell из корня репозитория `D:\portal`.

1. **Сначала API** (порт `4000`):

```powershell
npm run dev:api
```

2. **Потом портал** (порт `3000`):

```powershell
npm run dev:portal
```

Перед первым запуском: Postgres (`docker compose up -d postgres`) и миграции (`npm run db:migrate -w @b2b/api`).

- API: http://localhost:4000  
- Портал: http://localhost:3000  

Опционально сайт-рантайм: `npm run dev:site` (отдельный терминал, после API) — публичная витрина на порту `3001`.

## Production (Dokploy)

См. [DEPLOY.md](./DEPLOY.md): compose [`docker-compose.dokploy.yml`](./docker-compose.dokploy.yml), DNS и чеклист трёх партнёров.

## Tilda sync

Каталог домов синкается через **Tilda Store API**, не через `publickey/secretkey`.

### Official site API keys
Берём в Tilda: `Настройки сайта → API интеграции`.
Кладутся в `.env` как `TILDA_PUBLIC_KEY` / `TILDA_SECRET_KEY`.
Нужны для проверки доступа к сайту; список товаров каталога ими не читается.

### Store API (`storepartuid` / `recid`)
Это параметры раздела магазина на странице каталога.

Как взять:
1. Открыть каталог на сайте, например `https://avgst.ru/catalog/modulnye-doma`
2. DevTools → Network
3. Найти запрос `getproductslist`
4. Скопировать `storepartuid` и `recid` из query string

Сейчас в `.env` лежат значения из рабочего `catalog`-проекта AVGST.
