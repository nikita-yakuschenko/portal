# Dokploy / production deploy runbook
#
# VPS: 155.212.147.165
#
# Публичная точка входа платформы — один хост:
#   https://b2b.avgst.ru  → portal-web (лендинг, вход, регистрация, кабинеты)
# API снаружи отдельно НЕ публикуем: браузер ходит на b2b.avgst.ru/api/*,
# а Next проксирует на внутренний сервис api:4000.
#
# Сайты партнёров — их собственные домены → site-runtime.

## 1. Подготовка

1. VPS с Dokploy (`155.212.147.165`).
2. **Отдельная БД PostgreSQL в Dokploy** (не в compose приложения) — см. §1a.
3. Секреты в Environment приложения.
4. Сменить: `JWT_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL` (на внешнюю БД).
5. Env для portal-web:
   - `API_BASE_URL=http://api:4000` — внутри Docker
   - `NEXT_PUBLIC_API_URL=https://b2b.avgst.ru`

### 1a. Создать Postgres отдельно (Dokploy → Databases)

| Поле | Значение |
|------|----------|
| Engine | PostgreSQL **16** или **17** |
| Database name | `b2b_portal` |
| User | `b2b` |
| Password | свой сложный |
| Port | `5432` (как выдаст Dokploy) |

После создания скопируй **Internal connection URL** (хост вида сервиса Dokploy) в:

```env
DATABASE_URL=postgresql://b2b:PASSWORD@HOST:5432/b2b_portal
```

Таблицы не создавай руками — миграции накатит `api` при старте.

Локальный `docker compose up -d postgres` (порт `5436`) — только для разработки на машине; к прод-БД он не относится.

## 2. Деплой в Dokploy

Compose: [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml).

1. Deploy → дождаться healthy у `api` (миграции на старте).
2. Домены в Dokploy:
   - **`b2b.avgst.ru` → `portal-web:3000`** (единственный публичный хост кабинета)
   - партнёрские домены → `site-runtime:3000`
3. `api:4000` наружу через отдельный домен **не нужен** (остаётся во внутренней сети compose).

## 3. DNS (A → 155.212.147.165)

### Платформа — только один поддомен

| Хост | Тип | Значение | Куда в Dokploy |
|------|-----|----------|----------------|
| `b2b.avgst.ru` | A | `155.212.147.165` | **portal-web** + TLS |

Отдельные `api.avgst.ru` / `portal.avgst.ru` **не регистрируем**.

Замысел UX:

1. Открыл `https://b2b.avgst.ru` — стартовая страница (о заводе / дилерстве).
2. «Войти» / «Регистрация» — там же.
3. Партнёр после логина → `/partner` (свой кабинет).
4. HQ → `/company`.

### Партнёрские сайты → `site-runtime`

Это **другие** домены (витрины для клиентов), не кабинет:

| Хост на каждом домене | Тип | Значение |
|-----------------------|-----|----------|
| `@` | A | `155.212.147.165` |
| `www` | A | `155.212.147.165` |

- `авангардстрой36.рф`
- `dom-philosophy.ru`
- `domaizi.ru`

В Dokploy каждый → **site-runtime** + TLS.  
В `/partner/site` поле «домен» = FQDN без `https://`.

## 4. Чеклист партнёра (×3)

1. Approve заявки в HQ на `b2b.avgst.ru` → выдать логин/пароль.
2. Партнёр входит на `https://b2b.avgst.ru` → кабинет.
3. `/partner/site` → заполнить → **Опубликовать** + указать свой домен.
4. DNS партнёра → `155.212.147.165`, hostname на site-runtime.
5. Проверка: кабинет на b2b; сайт на партнёрском домене; лид → `/partner/leads`.

## 5. Локально

```powershell
npm run dev:api
npm run dev:portal
# опционально витрина:
npm run dev:site
```

## 6. Rollback

- Откат образа в Dokploy.
- Миграции additive (`partner_sites`).
