# B2B Platform

Платформа для управления дилерской сетью AVGST.

## Контур продукта

- HQ синхронизирует каталог домов и ассеты с Tilda.
- Партнёр регистрируется и получает кабинет.
- Для партнёра создаётся отдельный сайт на общем движке.
- Заявки с сайта собираются в кабинете партнёра и в HQ-аналитике.

## Workspace

- `apps/api` - backend API и доменные сервисы.
- `apps/portal-web` - кабинет HQ и партнёров.
- `apps/site-runtime` - движок сайтов партнёров.
- `packages/domain` - общие типы и правила.
- `docs` - корпоративные стандарты.

## Стандарты

Обязательны для любых изменений в этом репозитории:

- [docs/AES-1.0.md](docs/AES-1.0.md) — инженерный стандарт: архитектура, выбор
  технологий, данные, безопасность, тестирование, эксплуатация.
- [docs/ADS-1.1.md](docs/ADS-1.1.md) — дизайн-стандарт: бренд, токены темы и
  канон Product UI на shadcn/ui.

AES отвечает на вопрос «как построить и эксплуатировать», ADS — «как это
выглядит и говорит».

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

## Интеграции CRM: что уже есть и чего ещё нет

Раздел «Настройки → Интеграции» в кабинете партнёра **хранит подключение, но
пока не передаёт заявки**. Адаптеры в `apps/api/src/modules/crm/adapters.ts`
не делают сетевых вызовов: `sendLead` проверяет, что поля credentials
заполнены, и возвращает успех с синтетическим `externalLeadId`. Поэтому
кабинет прямо говорит партнёру, что автоматическая передача ещё не включена —
интерфейс не должен обещать то, чего нет.

Что нужно сделать, когда дойдут руки до реальной интеграции:

| Шаг | Где |
|---|---|
| Реальный вызов Bitrix24 по входящему вебхуку | `Bitrix24Adapter.sendLead` |
| OAuth и обновление токенов amoCRM | `AmoCrmAdapter` |
| Честные статусы в `lead_deliveries` вместо безусловного `sent` | `portal-service.createLead` |
| Проверка связи с порталом вместо проверки «поля не пустые» | `healthcheck` в адаптерах |

`CrmService` и `LeadService` (`modules/crm`, `modules/leads`) держат данные в
памяти и в рабочем пути не участвуют — заявки идут через `portalService`. Это
остатки раннего прототипа; при реализации адаптеров их следует удалить или
переписать на БД, чтобы не было двух источников правды.

### Секреты подключений

Вебхук Bitrix24 и токены amoCRM наружу не отдаются: `listCrmConnections`
возвращает подключение без `credentials`, вместо них — `secretHint` вида
`…a1b2`, чтобы владелец узнал свой ключ. Заменить протухший ключ можно через
`PUT /api/partner/crm-connections/:id/credentials`, не удаляя подключение.

В базе `credentials` пока лежат открытым текстом — шифрование ключом из
окружения остаётся отдельной задачей.

## Сайт партнёра: черновик и живая версия

Кабинет партнёра (`/partner/site`) правит **черновик**, покупатели видят
**опубликованную версию**. Это два разных столбца в `partner_sites`:

| Столбец | Кто пишет | Кто читает |
|---|---|---|
| `config` | кабинет партнёра, каждое «Сохранить» | форма, предпросмотр `/partner/site/preview` |
| `published_config` | только публикация | `resolveByHost`, публичные ручки, витрина |

Почему так: до этого столбец был один, и любое сохранение в кабинете сразу
меняло живой сайт — кнопка «Опубликовать» ничего не публиковала, а лишь
переключала статус. Черновик с полузаполненными полями уходил покупателям.

Публикация копирует `config` в `published_config` (`updateSite` с
`publish: true`, `publish()`, одобрение HQ). Снятие с публикации меняет только
статус: настройки остаются на месте. Сайты, опубликованные до появления
столбца, отдаются из `config` — иначе они бы обнулились (миграция `0024`
заполняет `published_config` для них при накатке).

Расхождение черновика и живой версии API считает сам и отдаёт как
`hasUnpublishedChanges` — кабинет по нему показывает «На сайте пока старая
версия».

### Валидация формы

Правила лежат в `apps/portal-web/lib/partner-site-validation.ts` отдельно от
разметки: там же карта «поле → раздел» и «поле → id инпута», по которой форма
уводит пользователя к первой ошибке. Обязательны название, адрес на avgst.ru,
телефон и почта; остальное проверяется, только если заполнено.

Поддомен приводится к слагу общей функцией `slugifySubdomain` из
`@b2b/site-schema` — кабинет показывает ровно тот адрес, который выдаст API.

## Профили соцсетей в мокапе телефона

После заявки посетителю показывается экран телефона с интерфейсом той соцсети,
которую партнёр выбрал в настройках сайта. Данные тянутся по ссылке партнёра —
никаких общих или демонстрационных профилей.

### Архитектура

```
Конфиг сайта партнёра (socialTelegram, socialInstagram, …)
        ↓  parseSocialUrl — https + allowlist хостов
Social Profile API (/api/public/sites/:partnerId/social-profile)
        ↓
Провайдер площадки (Telegram | Instagram)
        ↓
Снимок в Postgres — social_profile_snapshots
        ↓
Экран приложения внутри фотомокапа
```

Модули API — `apps/api/src/modules/social/`:

| Файл | Ответственность |
|---|---|
| `social-urls.ts` | разбор и нормализация ссылок, allowlist площадок |
| `telegram-parser.ts` | чистый парсер HTML, покрыт fixtures |
| `telegram-provider.ts` | поход в `t.me/s/{name}`, при отсутствии ленты — `t.me/{name}` |
| `instagram-provider.ts` | Meta Graph API → Playwright collector → честный `unavailable` |
| `social-profile-service.ts` | кэш, stale-while-revalidate, single-flight, circuit breaker |
| `media-proxy.ts` | прокси картинок с allowlist и лимитами |

Фронтенд — `apps/portal-web/components/partner-site/social-screens/` (экраны
площадок), `hand-phone-mockup.tsx` (фотомокап), `lib/perspective.ts` (гомография).

### Переменные окружения

```
SOCIAL_PROFILE_TTL_MINUTES=20     # срок жизни снимка профиля
SOCIAL_FETCH_TIMEOUT_MS=15000     # таймаут одного outbound-запроса
SOCIAL_MEDIA_MAX_BYTES=8388608    # потолок для картинки через прокси

INSTAGRAM_PROVIDER=auto           # auto | off
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_IG_BUSINESS_ID=              # свой IG Business ID для Business Discovery
INSTAGRAM_COLLECTOR_URL=          # адрес Playwright-коллектора
INSTAGRAM_COLLECTOR_TOKEN=        # внутренний токен коллектора
```

Секреты живут только на сервере: в клиентский бандл, HTML, логи и ответы API
они не попадают.

### Кэш

Снимок хранится один на пару (площадка, username) и переиспользуется всеми
партнёрами, ссылающимися на тот же канал. Свежий снимок отдаётся сразу;
просроченный — тоже сразу, но со статусом `stale` и фоновым обновлением.
Одновременный сбор одного профиля дедуплицируется; после трёх подряд отказов
площадки профиль уходит в паузу на 10 минут.

Неудачное обновление никогда не затирает прежние данные — обновляются только
поля попытки (`last_attempt_at`, `last_attempt_status`, `last_error_class`).

### Диагностика

Каждое получение пишется в лог API событием `social_profile_fetch`: площадка,
username, провайдер, стадия, upstream-статус, длительность, итоговый статус,
число медиа, класс ошибки и request id. Токены, cookies и HTML в лог не идут,
наружу диагностика не отдаётся.

Статусы в ответе различают: `live`, `stale`, `unavailable`, `not_found`,
`login_required`, `rate_limited`, `challenge`. `live` не выставляется, если
реальные данные получить не удалось.

### Ограничения площадок

- **Telegram** — работает без ключей: публичная лента `t.me/s/{name}`. У ботов,
  групп и приватных каналов ленты нет, тогда показываются только имя, описание
  и аватар.
- **Instagram** — публичного контракта без токена нет. Business Discovery
  требует Meta-приложение и работает только с Business/Creator-аккаунтами.
  Без credentials и без коллектора экран честно сообщает о недоступности.
  Обход CAPTCHA, ротация fingerprint и прокси-фермы не реализуются.
  **Из российской сети `instagram.com` не открывается вообще** — коллектору
  нужен исходящий прокси (`COLLECTOR_PROXY_URL`), иначе каждый сбор
  заканчивается таймаутом и честным статусом `unavailable`.
- **ВКонтакте, YouTube, Дзен, MAX** — провайдеров нет: показывается оболочка
  приложения с брендом партнёра, без счётчиков и без ленты.

### Мокап

`public/mockups/hand-iphone-front.webp` собран из исходного PSD фронтального
ракурса: окно дисплея вырезано по маске смарт-объекта, поэтому экран лежит
**под** фотографией, а рамка и блики остаются сверху. Ракурс фронтальный —
перспективная матрица и гомография не нужны.

Прежний ракурс с наклоном убран: у его маски были пропорции 2.33 против 2.168
у экрана iPhone, экран растягивался и залезал на рамку.

### Playwright-коллектор Instagram

Отдельный сервис `apps/instagram-collector`: Chromium нельзя держать внутри API
(память, холодный старт, изоляция), поэтому браузер живёт в своём контейнере и
доступен только по внутреннему токену.

```
POST /collect/instagram
Authorization: Bearer <INSTAGRAM_COLLECTOR_TOKEN>
{ "profileUrl": "https://www.instagram.com/username/" }
```

Локально:

```powershell
docker compose up -d instagram-collector
curl http://localhost:4100/health
```

В `.env` при этом должны быть `INSTAGRAM_COLLECTOR_URL` и общий
`INSTAGRAM_COLLECTOR_TOKEN` — API ходит к коллектору только с ним.

Как он работает: изолированный BrowserContext на каждый запрос, мобильный
viewport с согласованными locale/timezone/UA, переход по `domcontentloaded`
(не `networkidle` — Instagram держит соединения открытыми), данные сначала из
JSON-ответов, реально загруженных браузером, и только потом из DOM. Страница
классифицируется явно: login wall, challenge, rate limit, not found, приватный
профиль. Пустого успешного ответа не бывает — если данных нет, возвращается
статус и сохраняется технический скриншот в `COLLECTOR_TRACE_DIR` (чистится по
`COLLECTOR_TRACE_TTL_MINUTES`).

Переменные окружения коллектора:

```
INSTAGRAM_COLLECTOR_TOKEN=      # обязателен, без него сервис не стартует
COLLECTOR_PORT=4100
COLLECTOR_CONCURRENCY=1         # одновременных сборов, максимум 4
COLLECTOR_NAV_TIMEOUT_MS=20000
COLLECTOR_CONTENT_TIMEOUT_MS=8000
COLLECTOR_STORAGE_STATE=        # путь к storageState служебного аккаунта
COLLECTOR_TRACE_DIR=/tmp/collector-traces
COLLECTOR_TRACE_TTL_MINUTES=60
COLLECTOR_PROXY_URL=            # обязателен, если сервер в РФ
COLLECTOR_PROXY_USERNAME=
COLLECTOR_PROXY_PASSWORD=
```

Про `storageState`: по умолчанию коллектор работает анонимно. Файл сессии —
полноценный секрет доступа к аккаунту: в git не хранится, в образ не кладётся,
пользователю не отдаётся, монтируется как secret или защищённый volume.
Автоматизация ввода пароля, OTP и прохождения CAPTCHA не делается.

Обновление Playwright: версия в `apps/instagram-collector/package.json` и тег
базового образа в `Dockerfile` (`mcr.microsoft.com/playwright:vX.Y.Z-noble`)
должны совпадать — иначе Chromium в образе не совпадёт с клиентом.

В production коллектор описан в `docker-compose.dokploy.yml`, наружу не
публикуется (`expose`, без `ports`) и требует `shm_size: 1gb` — с дефолтными
64 МБ Chromium падает.
