# Dokploy / production deploy runbook
#
# VPS: 155.212.147.165
#
# Публичная точка входа платформы — один хост:
#   https://b2b.avgst.ru  → portal (лендинг, вход, регистрация, кабинеты)
# API снаружи отдельно НЕ публикуем: браузер ходит на b2b.avgst.ru/api/*,
# а Next проксирует на внутренний сервис api:4000.
#
# Сайты партнёров — их собственные домены → site-runtime.

## 1. Подготовка

1. VPS с Dokploy (`155.212.147.165`).
2. **Отдельная БД PostgreSQL в Dokploy** (не в compose приложения) — см. §1a.
3. Секреты в Environment приложения (чеклист ниже).
4. Сменить: `JWT_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL` (Internal URL из Databases).

### Обязательные env (Compose app → Environment)

```env
DATABASE_URL=postgresql://USER:PASSWORD@b2b-portal-hblrpr:5432/DBNAME
JWT_SECRET=длинный-случайный-секрет
ADMIN_PASSWORD=свой-сложный-пароль
ADMIN_EMAIL=admin@avgst.local
API_BASE_URL=http://api:4000
NEXT_PUBLIC_API_URL=https://b2b.avgst.ru
```

Опционально (`PARTNER_*` — seed демо-партнёра). Пустые значения в Dokploy игнорируются.

**Не ставь** `API_BASE_URL=http://localhost:4000` — внутри контейнера portal это не api.

### 1a. Создать Postgres отдельно (Dokploy → Databases)

| Поле | Значение |
|------|----------|
| Engine | PostgreSQL **16** или **17** |
| Database name | как удобно (`portal` / `b2b_portal`) |
| User / Password | свои |
| Port | `5432` (как выдаст Dokploy) |

Скопируй **Internal Connection URL** из карточки БД в `DATABASE_URL`.  
Хост вида `b2b-portal-hblrpr` работает **только** если сервисы в `dokploy-network` (уже в `docker-compose.dokploy.yml`).

Таблицы не создавай руками — миграции накатит `api` при старте.

Локальный `docker compose up -d postgres` (порт `5436`) — только для разработки.

## 2. Деплой в Dokploy

Compose: [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml).

Важно: в compose подключена внешняя сеть `dokploy-network` — без неё будет  
`getaddrinfo ENOTFOUND b2b-portal-hblrpr`.

1. Deploy → **Rebuild** образов (не только restart) — иначе portal останется с rewrite на localhost.
2. Дождаться `api` = running/healthy (миграции на старте).
3. Домены:
   - **`b2b.avgst.ru` → `portal:3410`**
   - партнёрские домены → `site-runtime:3410`
4. `api:4000` наружу не публикуем.

### Если api в restart loop

| Лог | Что сделать |
|-----|-------------|
| `ENOTFOUND b2b-portal-…` | Проверь, что compose с `dokploy-network` задеплоен; `DATABASE_URL` = Internal URL из Databases |
| ZodError `PARTNER_*` / `ADMIN_*` | Убери пустые ключи или задай валидные значения |
| portal: `proxy http://localhost:4000` | Rebuild portal с `API_BASE_URL=http://api:4000` (build arg) |

## 3. DNS (A → 155.212.147.165)

### Платформа — только один поддомен

| Хост | Тип | Значение | Куда в Dokploy |
|------|-----|----------|----------------|
| `b2b.avgst.ru` | A | `155.212.147.165` | **portal** + TLS |

Отдельные `api.avgst.ru` / `portal.avgst.ru` **не регистрируем**.

Замысел UX:

1. Открыл `https://b2b.avgst.ru` — стартовая страница.
2. «Войти» / «Регистрация» — там же.
3. Партнёр после логина → `/partner`.
4. HQ → `/company`.

### Партнёрские сайты → `site-runtime`

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

### Создать партнёра напрямую (без заявки)

Нужны только **email** (логин) и **пароль** ≥8. Остальное — заглушки, донастроишь в кабинете.

`DATABASE_URL` — из корневого `.env` или явно (для прода: External/доступный с твоей машины URL Postgres, не `b2b-portal-hblrpr` из внутренней Docker-сети).

```powershell
cd d:\portal
# при необходимости:
# $env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"

npm run create-partner -w @b2b/api -- --email=domaizi@avgst.local --password=Secret123!

# уже есть такой email — только сменить пароль:
npm run create-partner -w @b2b/api -- --email=domaizi@avgst.local --password=NewSecret1! --reset-password
```

Опционально: `--name` `--company` `--region` `--phone`.

## 6. Rollback

- Откат образа в Dokploy.
- Миграции additive (`partner_sites`).
