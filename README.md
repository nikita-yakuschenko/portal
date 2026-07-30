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
npm run dev:api
npm run typecheck
npm run test
```

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
