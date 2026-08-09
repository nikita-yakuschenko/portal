---

<!-- Source: README.md -->

# AES — Avangard Engineering Standard

> **Версия:** 1.0  
> **Статус:** базовый корпоративный инженерный стандарт  
> **Дата:** 29 июля 2026 года  
> **Область применения:** программные продукты, внутренние сервисы, интеграции, автоматизация, аналитика, AI, документы, Telegram, 1С, Bitrix24, производственные и клиентские интерфейсы.

---

## 1. Что такое AES

**Avangard Engineering Standard (AES)** — единый стандарт проектирования, разработки, проверки, выпуска и эксплуатации цифровых продуктов.

AES не является фиксированным стеком и не требует добавлять в каждый проект одинаковый набор технологий.

AES определяет:

- как формулировать задачу;
- как выбирать архитектуру;
- как выбирать технологию по назначению;
- какие инженерные свойства обязательны;
- какие компоненты подключаются условно;
- как моделировать бизнес-правила и состояния;
- как строить интеграции;
- как обеспечивать безопасность, качество и производительность;
- как выпускать, наблюдать, восстанавливать и выводить продукт из эксплуатации;
- как давать задания AI-агентам и контролировать создаваемый ими код.

Главный принцип:

> **В проект включается только тот компонент, необходимость которого следует из функциональных или нефункциональных требований. Отсутствие ненужной технологии является правильным архитектурным решением.**

---

## 2. Нормативные слова

В документах AES используются следующие уровни требований:

- **ОБЯЗАТЕЛЬНО** — требование должно выполняться, кроме документированного исключения.
- **СЛЕДУЕТ** — рекомендуемая практика; отклонение должно иметь причину.
- **ДОПУСТИМО** — разрешённый вариант.
- **ЗАПРЕЩЕНО** — практика не допускается.
- **УСЛОВНО** — компонент применяется только при выполнении критериев.

---

## 3. Структура стандарта

| Раздел | Назначение |
|---|---|
| `00-principles` | фундаментальные принципы |
| `10-governance` | классы проектов, паспорта, ADR, готовность |
| `20-architecture` | домены, модули, состояния, интеграции |
| `30-technology` | правила выбора конкретных технологий |
| `40-interface` | UI, UX, дизайн-система, доступность |
| `50-data` | PostgreSQL, миграции, файлы, аналитика |
| `60-quality` | безопасность, тестирование, производительность |
| `70-operations` | CI/CD, Docker, наблюдаемость, backup, incidents |
| `80-specialized` | PDF, Telegram, Bitrix24, 1С, scraping, AI, MCP, 3D |
| `90-templates` | готовые шаблоны инженерных артефактов |

---

## 4. Порядок применения AES

Для нового проекта:

1. Заполнить паспорт проекта.
2. Назначить класс зрелости: Prototype, MVP, Production или Critical.
3. Описать домен, пользователей, источники истины и ключевые сценарии.
4. Выбрать минимально достаточную архитектуру.
5. Пройти матрицу условных технологий.
6. Зафиксировать значимые решения в ADR.
7. Определить Definition of Ready и Definition of Done.
8. Реализовать обязательное инженерное ядро.
9. Подключить только применимые специализированные модули.
10. Перед выпуском пройти release checklist.
11. Для production определить backup, restore, observability и runbook.

---

## 5. Обязательное инженерное ядро

Для каждого production-проекта ОБЯЗАТЕЛЬНЫ:

- Git и понятный README;
- воспроизводимая установка;
- фиксированный runtime;
- lockfile;
- строгая типизация;
- linting и formatting;
- валидация внешнего ввода;
- единая модель ошибок;
- безопасная конфигурация;
- миграции для постоянных данных;
- структурированные логи;
- healthcheck;
- тесты критичных бизнес-правил;
- CI;
- воспроизводимый deployment;
- backup постоянных данных;
- документированный restore;
- контроль зависимостей;
- документированный rollback;
- владелец продукта или сервиса.

---

## 6. Формула AES

> **Задача → доменная модель → ограничения → минимальная архитектура → профильная технология → контроль качества → эксплуатация → измерение → эволюция.**

Современность в AES означает не максимальную новизну, а:

- поддерживаемую технологию;
- зрелую экосистему;
- понятную модель сопровождения;
- разумную стоимость;
- соответствие задаче;
- отсутствие лишней сложности.


---

<!-- Source: 00-principles/engineering-principles.md -->

# Фундаментальные инженерные принципы

## 1. Business first

Разработка начинается с изменения реального процесса, а не с выбора framework.

ОБЯЗАТЕЛЬНО определить:

- проблему;
- пользователя;
- ожидаемый результат;
- границы решения;
- источник истины;
- стоимость ошибки;
- ограничения;
- критерий успеха.

Технология, не связанная с требованием или риском, в проект не включается.

## 2. Минимально достаточная архитектура

Порядок предпочтения:

1. скрипт или автоматизация;
2. небольшой full-stack продукт;
3. модульный монолит;
4. монолит с worker-процессами;
5. выделение специализированного сервиса;
6. распределённая архитектура.

Микросервисы, event bus, Kubernetes, Redis, vector DB и отдельный AI-контур не являются признаком зрелости сами по себе.

## 3. Technology follows purpose

- React/Next.js — web-интерфейсы и web-продукты;
- NestJS — сложный TypeScript backend и независимый API;
- PostgreSQL — транзакционные бизнес-данные;
- Redis — временное быстрое состояние, cache, lock, rate limit и queue backend;
- Python — DS, ML, OCR, CV, научные вычисления, документы и специализированные боты;
- aiogram — Telegram Bot API;
- S3-compatible storage — файлы и artifacts;
- Playwright/Chromium — E2E и HTML-to-PDF;
- Go/Rust — только для системных компонентов с подтверждёнными требованиями.

## 4. YAGNI для инфраструктуры

ЗАПРЕЩЕНО добавлять компонент «возможно пригодится».

Для каждого компонента требуется ответ:

1. Какое требование он закрывает?
2. Почему текущий стек недостаточен?
3. Какова стоимость сопровождения?
4. Как он мониторится, обновляется и восстанавливается?
5. Как его удалить или заменить?

## 5. Простота не отменяет качество

Небольшой внутренний сервис может не нуждаться в Kubernetes, но нуждается в:

- авторизации;
- backup;
- журналировании;
- валидации;
- миграциях;
- восстановлении;
- контроле секретов.

## 6. Доменная логика важнее CRUD

Интерфейс и API не должны механически повторять таблицы БД.

Бизнес-правила должны быть:

- явно сформулированы;
- изолированы от UI;
- тестируемы;
- версионируемы при необходимости;
- воспроизводимы.

## 7. Надёжность на границах

Внешняя система считается:

- медленной;
- ограниченной;
- изменчивой;
- иногда недоступной;
- способной прислать дубликат;
- способной не прислать событие вовсе.

## 8. Измерение до оптимизации

Производительность улучшается после:

1. определения цели;
2. измерения baseline;
3. нахождения bottleneck;
4. изменения;
5. повторного измерения.

## 9. Security by design

Проверка прав, валидация, аудит и управление секретами проектируются одновременно с функционалом.

## 10. Эксплуатация является частью продукта

Функция не готова, если невозможно:

- понять, что произошло;
- найти ошибку;
- восстановить данные;
- повторить операцию;
- откатить релиз;
- определить владельца проблемы.


---

<!-- Source: 10-governance/project-lifecycle.md -->

# Классы проектов и жизненный цикл

## 1. Классы зрелости

### Prototype

Назначение: проверка гипотезы.

Допустимо:

- локальный запуск;
- ручные операции;
- упрощённая архитектура;
- ограниченные тесты.

Даже в Prototype ЗАПРЕЩЕНО:

- хранить секреты в Git;
- публиковать небезопасный endpoint;
- использовать production-данные без защиты;
- выдавать эксперимент за надёжный production.

### MVP

ОБЯЗАТЕЛЬНЫ:

- миграции;
- auth, если есть пользователи;
- backup;
- основные тесты;
- Docker или воспроизводимая сборка;
- logging;
- обработка ошибок;
- инструкция запуска и восстановления.

### Production

Дополнительно ОБЯЗАТЕЛЬНЫ:

- CI/CD;
- rollback;
- observability;
- security review;
- runbook;
- restore test;
- dependency update policy;
- release checklist;
- явный владелец сервиса.

### Critical

Дополнительно ОБЯЗАТЕЛЬНЫ:

- SLO;
- RTO/RPO;
- staging;
- disaster recovery;
- аудит;
- incident process;
- capacity plan;
- регулярная проверка восстановления;
- повышенный контроль изменений.

## 2. Definition of Ready

Задача готова к разработке, если определены:

- пользователь и цель;
- acceptance criteria;
- источник данных;
- права;
- ошибки и пограничные случаи;
- состояния;
- интеграционные зависимости;
- влияние на схему данных;
- требования к интерфейсу;
- наблюдаемость;
- способ тестирования.

## 3. Definition of Done

Функция готова, если:

- happy path реализован;
- ожидаемые ошибки обработаны;
- server-side validation добавлена;
- authorization проверена;
- critical tests написаны;
- loading/empty/error/success UI присутствует;
- миграции подготовлены;
- логи и метрики добавлены;
- документация обновлена;
- rollback понятен;
- lint, typecheck, tests и build проходят.

## 4. ADR

Значимые решения фиксируются в Architecture Decision Record.

ADR ОБЯЗАТЕЛЕН для:

- отдельного backend;
- нового языка;
- Redis;
- очереди;
- нового хранилища;
- микросервиса;
- event bus;
- vector DB;
- Kubernetes;
- AI, влияющего на бизнес-решение;
- Telegram personal account;
- существенного изменения модели данных.


---

<!-- Source: 20-architecture/domain-and-state.md -->

# Доменная модель, бизнес-правила и состояния

## 1. Domain discovery

Для сложного процесса СЛЕДУЕТ описать:

- actors;
- commands;
- events;
- entities;
- value objects;
- aggregates;
- invariants;
- states;
- exceptions;
- manual interventions;
- source of truth.

## 2. Бизнес-правило

Критичное правило должно иметь:

- идентификатор;
- формулировку;
- входные данные;
- результат;
- граничные случаи;
- версию;
- дату действия;
- тестовые примеры.

Пример:

```md
RULE-SCORING-004

Точный счёт: 5 очков.
Правильная разница: 3 очка.
Правильный исход: 1 очко.

Исключения:
- отменённый матч;
- техническое поражение;
- серия пенальти.
```

## 3. Детерминированные вычисления

Для scoring, раскроя, цен, аналитики и документов ОБЯЗАТЕЛЬНО сохранять по необходимости:

- input;
- algorithm version;
- parameters;
- output;
- source version;
- timestamp;
- seed, если используется случайность.

## 4. State machine

Сущность со статусами должна иметь явный конечный автомат.

ОБЯЗАТЕЛЬНО определить:

- состояния;
- переходы;
- исполнителей;
- preconditions;
- side effects;
- terminal states;
- retry;
- cancellation;
- recovery.

Пример:

```yaml
pdf_build:
  pending: [validating, cancelled]
  validating: [rendering, failed]
  rendering: [ready, failed, cancelled]
  failed: [pending]
  ready: []
  cancelled: []
```

## 5. Idempotency

Операция должна быть идемпотентной, если она:

- вызывается webhook;
- запускается cron;
- повторяется worker;
- синхронизирует внешние данные;
- пересчитывает результат;
- создаёт платёжный или значимый документ.

## 6. Модульный монолит

Базовый выбор — модульный монолит.

Модуль должен иметь:

- собственную предметную ответственность;
- явный public API;
- изолированную бизнес-логику;
- контролируемый доступ к данным;
- тесты.

## 7. Выделение сервиса

Отдельный сервис оправдан, если есть сильная причина:

- другой runtime;
- независимое масштабирование;
- тяжёлая обработка;
- отдельный security boundary;
- отдельный lifecycle;
- несколько потребителей;
- независимая команда.

Если этих причин нет, это модуль.


---

<!-- Source: 20-architecture/integrations.md -->

# Интеграционный стандарт

## 1. Внешняя система — ненадёжная граница

Каждая интеграция должна иметь:

- timeout;
- retry policy;
- exponential backoff;
- idempotency;
- rate limit handling;
- mapping внешних и внутренних ID;
- журнал;
- статус обработки;
- ручной replay;
- reconciliation.

## 2. Anti-corruption layer

Внешние DTO не становятся внутренней доменной моделью.

```text
External payload
→ validation
→ normalization
→ mapping
→ domain command
```

## 3. Webhook

Webhook ОБЯЗАН:

1. проверить подлинность;
2. валидировать payload;
3. вычислить deduplication key;
4. сохранить входящее событие;
5. быстро вернуть ответ;
6. передать тяжёлую обработку worker.

ЗАПРЕЩЕНО выполнять длинную цепочку операций внутри webhook request.

## 4. Inbox/Outbox

Для критичных интеграций СЛЕДУЕТ применять:

### Inbox

- external_event_id;
- payload;
- received_at;
- processing_status;
- attempts;
- last_error;
- processed_at.

### Outbox

- event_type;
- payload;
- destination;
- status;
- attempts;
- next_retry_at.

## 5. Reconciliation

Webhook или incremental sync не считаются достаточной гарантией.

СЛЕДУЕТ иметь периодическую сверку:

- пропущенных событий;
- зависших статусов;
- потерянных файлов;
- дубликатов;
- несогласованных сумм;
- записей без mapping.

## 6. API contract

Для API, имеющего более одного клиента, ОБЯЗАТЕЛЕН OpenAPI или эквивалентный контракт.

Контракт описывает:

- auth;
- schemas;
- error model;
- pagination;
- filtering;
- sorting;
- versioning;
- idempotency;
- rate limits.

## 7. Ошибки

Единый формат:

```json
{
  "error": {
    "code": "RESOURCE_NOT_DELETABLE",
    "message": "Объект нельзя удалить",
    "details": {},
    "requestId": "..."
  }
}
```

Клиент принимает решение по `code`, а не по тексту.


---

<!-- Source: 30-technology/selection-matrix.md -->

# Матрица выбора технологий

## Web UI

Использовать **React + Next.js**, если нужен современный web-интерфейс.

Не создавать frontend, если задача решается worker, CLI, API или ботом.

## Отдельный backend

### Next.js full-stack

Использовать, если:

- один основной web-клиент;
- умеренная доменная логика;
- небольшой или средний продукт;
- нет отдельного масштабирования backend.

### NestJS

Добавлять, если:

- несколько клиентов;
- сложный API;
- развитая доменная логика;
- множество интеграций;
- независимые workers;
- отдельный release cycle.

### FastAPI

Использовать, если backend тесно связан с:

- Python;
- OCR;
- CV;
- DS/ML;
- документами;
- специализированными вычислениями.

## PostgreSQL

Базовая транзакционная БД.

Подключается, если существуют постоянные бизнес-данные, связи и транзакции.

## Redis

Подключать только для:

- cache;
- TTL state;
- distributed lock;
- rate limiting;
- idempotency keys;
- queue backend;
- counters;
- Pub/Sub.

Redis не является основным источником истины.

## Очередь

Нужна, если операция:

- долгая;
- повторяемая;
- переживает restart;
- требует retry;
- имеет concurrency limit;
- обрабатывает PDF, OCR, CV, import/export;
- зависит от нестабильного API.

## Python

Подключать для:

- NumPy/SciPy;
- pandas/Polars;
- ML;
- OCR;
- CV;
- audio;
- document processing;
- aiogram;
- scientific computation.

Не добавлять Python ради обычного CRUD.

## S3-compatible storage

Подключать, если есть:

- uploads;
- generated PDF;
- изображения;
- версии artifacts;
- большие файлы.

## Полнотекстовый поиск

1. PostgreSQL FTS.
2. OpenSearch/Elasticsearch — только после доказанной недостаточности.

## Vector DB

Подключать, если действительно нужен semantic retrieval.

Не использовать как модный аналог обычной БД или поиска.

## Kubernetes

Рассматривать при:

- нескольких узлах;
- большом количестве сервисов;
- независимых командах;
- сложном autoscaling;
- необходимости orchestration.

До этого предпочтительнее Docker Compose/Dokploy.


---

<!-- Source: 40-interface/ui-standard.md -->

# UI и UX стандарт

## 1. Основной принцип

Интерфейс — рабочий инструмент, который снижает когнитивную нагрузку и риск ошибки.

## 2. Обязательные состояния

Каждый data-driven экран должен иметь:

- loading;
- empty dataset;
- empty search result;
- error;
- success;
- disabled/partial, если применимо.

## 3. Дизайн-система

ОБЯЗАТЕЛЬНЫ токены:

- color;
- spacing;
- radius;
- shadow;
- typography;
- z-index;
- motion;
- breakpoint.

ЗАПРЕЩЕНО:

- случайные цвета;
- произвольные отступы;
- смешение иконок;
- уникальные компоненты без причины;
- использование placeholder вместо label.

## 4. Формы

- label виден постоянно;
- client и server validation;
- ошибка рядом с полем;
- сообщение объясняет исправление;
- маска не мешает вставке;
- обязательность известна заранее;
- unsaved changes защищены;
- длинная форма группируется по смыслу.

## 5. Data-heavy UI

Для таблиц определить:

- приоритет колонок;
- фиксированные и гибкие ширины;
- sorting/filtering contract;
- pagination;
- сохранение фильтров;
- bulk selection;
- действия строки;
- мобильное поведение;
- virtualization threshold.

## 6. Долгие операции

Если операция выполняется в фоне:

- возвращается operation ID;
- страницу можно закрыть;
- статус восстанавливается;
- progress не выдумывается;
- retry отличается от rebuild;
- готовый artifact имеет версию;
- failed state содержит действие.

## 7. Удаление

Destructive action требует:

- server-side permission;
- явного объекта;
- описания последствий;
- подтверждения;
- audit;
- soft/hard delete policy.

## 8. Доступность

Цель — WCAG 2.2 AA для значимых интерфейсов.

Минимум:

- keyboard;
- visible focus;
- semantic HTML;
- labels;
- contrast;
- screen reader status;
- adequate touch targets;
- reduced motion.

## 9. Frontend архитектура

Базовый контур:

- Next.js App Router;
- TypeScript strict;
- Server Components по умолчанию;
- Client Components только для интерактивности;
- Tailwind;
- shadcn/ui или системные primitives;
- React Hook Form;
- Zod;
- TanStack Table для сложных таблиц;
- client store только при необходимости.


---

<!-- Source: 50-data/data-standard.md -->

# Данные, PostgreSQL и эволюция схемы

## 1. Источник истины

Для каждого типа данных определяется один master.

Пример:

| Данные | Master |
|---|---|
| CRM и сделки | Bitrix24 |
| бухгалтерский учёт | 1С |
| операционные сущности продукта | PostgreSQL продукта |
| файлы | S3 |
| cache | не источник истины |

## 2. PostgreSQL

ОБЯЗАТЕЛЬНО:

- PK и FK;
- constraints;
- versioned migrations;
- timezone-aware timestamps;
- `numeric` для денег;
- parameterized SQL;
- connection pool;
- индексы под реальные запросы;
- backup и restore test.

Файлы обычно хранятся в object storage, в БД — metadata и key.

## 3. ORM

ORM ускоряет разработку, но не отменяет SQL.

Raw SQL применяется для:

- аналитики;
- bulk operations;
- сложных запросов;
- оптимизации после измерения.

## 4. Schema evolution

Production-изменения выполняются по схеме:

1. expand;
2. deploy совместимого кода;
3. backfill;
4. switch reads/writes;
5. verify;
6. contract.

ЗАПРЕЩЕНО использовать `db push` вместо контролируемой production migration.

## 5. Большие миграции

- backfill отдельно;
- пакетная обработка;
- контроль locks;
- тест на реалистичном объёме;
- rollback/recovery plan;
- совместимость нескольких версий приложения.

## 6. Деньги, даты и единицы

- деньги: `numeric` или minor units;
- currency хранится явно;
- округление является бизнес-правилом;
- timestamp хранится с timezone;
- business timezone фиксируется;
- единица измерения является частью значения;
- цена имеет источник и дату актуальности.

## 7. Аудит

Audit log содержит:

- actor;
- action;
- resource;
- old value;
- new value;
- timestamp;
- request ID;
- source;
- reason, если применимо.


---

<!-- Source: 50-data/files.md -->

# Файлы и artifacts

## 1. Жизненный цикл

```text
upload → validate → quarantine → process → store → publish → retain/delete
```

## 2. Метаданные

Для файла СЛЕДУЕТ хранить:

- id;
- owner;
- original_name;
- mime_type;
- detected_type;
- size;
- checksum;
- storage_key;
- status;
- source;
- created_at;
- expires_at.

## 3. Безопасность

ОБЯЗАТЕЛЬНО:

- проверять magic bytes;
- ограничивать размер;
- использовать случайный storage key;
- private by default;
- signed URL;
- защищаться от decompression bomb;
- sandbox для PDF;
- sanitization или запрет внешнего SVG;
- не доверять расширению.

## 4. Generated artifacts

Для PDF, preview, export и report хранить:

- build ID;
- source version;
- template version;
- renderer version;
- checksum;
- status;
- created_at;
- error;
- retention policy.


---

<!-- Source: 60-quality/security.md -->

# Безопасность

Ориентиры: OWASP ASVS и OWASP Top 10.

## 1. Authentication

- проверенные механизмы предпочтительнее самописных;
- пароли: Argon2id или современный эквивалент;
- MFA для администраторов;
- session revocation;
- secure cookies;
- brute-force protection;
- секреты не передаются в URL.

## 2. Authorization

- deny by default;
- server-side checks;
- RBAC + ownership + scope;
- list фильтрует недоступные записи;
- detail повторно проверяет доступ;
- mutation проверяет конкретное действие;
- UI capability flags приходят с сервера;
- object-level authorization покрывается тестами.

## 3. Validation

- всё внешнее недоверенное;
- schema validation;
- parameterized SQL;
- allowlist для URL и SSRF-защита;
- file validation;
- webhook signature;
- mass assignment предотвращается DTO.

## 4. Secrets

- не в Git;
- не в Docker image;
- не в logs;
- rotation;
- минимальные права;
- разные секреты сред.

## 5. Infrastructure

- non-root containers;
- минимальный image;
- БД не публикуется наружу;
- SSH keys;
- firewall;
- TLS;
- backups offsite;
- разделение dev/prod.

## 6. Supply chain

- lockfile;
- Dependabot/Renovate;
- dependency scan;
- license review;
- обновление base images;
- удаление неиспользуемых пакетов.

## 7. Data classification

Категории:

- public;
- internal;
- confidential;
- personal;
- critical.

Для каждой задаются:

- access;
- retention;
- encryption;
- audit;
- backup;
- deletion.


---

<!-- Source: 60-quality/testing-performance.md -->

# Тестирование и производительность

## 1. Пирамида тестирования

### Static

- strict typing;
- lint;
- formatter;
- schema checks.

### Unit

- business rules;
- calculations;
- permissions;
- state transitions;
- transformations.

### Integration

- repository + real DB;
- API;
- migrations;
- queue;
- adapters.

### Contract

При независимых сервисах и внешних API.

### E2E

Playwright для ключевых путей:

- login;
- создание главной сущности;
- изменение статуса;
- критичная форма;
- export/download;
- права.

### Visual regression

Для:

- дизайн-системы;
- PDF;
- каталогов;
- КП;
- критичных публичных страниц.

## 2. Test data

- production data не используется;
- fixtures минимальны;
- время замораживается;
- seed фиксирован;
- тесты изолированы;
- внешние API мокируются на границе.

## 3. Производительность

Сначала измерение.

### Frontend

- LCP;
- INP;
- CLS;
- TTFB;
- JS size;
- request count.

### Backend

- p50/p95/p99;
- throughput;
- error rate;
- saturation;
- queue lag.

### Database

- slow queries;
- locks;
- connections;
- index usage;
- sequential scans;
- storage growth.

## 4. Базовые практики

- Server Components;
- минимальный client JS;
- optimized images;
- pagination;
- no N+1;
- batch operations;
- connection pooling;
- timeout;
- concurrency limit;
- async jobs для тяжёлых операций;
- cache только после измерения.

## 5. Performance budget

Проект должен иметь применимые бюджеты, например:

```yaml
api_p95_ms: 400
lcp_seconds: 2.5
initial_js_kb_gzip: 250
error_rate_percent: 1
queue_wait_p95_seconds: 30
```


---

<!-- Source: 70-operations/operations.md -->

# CI/CD, эксплуатация и надёжность

## 1. CI pipeline

Минимум:

1. install from lockfile;
2. lint;
3. typecheck;
4. unit tests;
5. integration tests;
6. build;
7. dependency scan;
8. Docker build;
9. smoke test.

## 2. Deployment

- один artifact между средами;
- сборка не выполняется вручную на production;
- migration контролируется;
- healthcheck после deploy;
- rollback документирован;
- production deployment журналируется.

## 3. Docker

- multi-stage;
- non-root;
- minimal image;
- production dependencies only;
- healthcheck;
- immutable runtime;
- no secrets;
- versioned tag.

## 4. Docker Compose / Dokploy

Базовый вариант для одного или нескольких VPS.

Каждый сервис имеет:

- healthcheck;
- restart policy;
- resource limits;
- network;
- явные volumes;
- environment config;
- backup policy.

## 5. Cron и scheduler

- cron инициирует job;
- job идемпотентен;
- overlap policy;
- distributed lock при необходимости;
- timezone задана;
- last_started/last_completed;
- timeout;
- alert о пропуске;
- manual replay.

## 6. Observability

### Logs

Структурированные JSON:

- timestamp;
- level;
- service;
- environment;
- requestId;
- userId;
- operation;
- duration;
- errorCode.

### Metrics

- requests;
- latency;
- errors;
- CPU/memory;
- DB connections;
- queue length;
- failed jobs;
- dependency errors;
- business metrics.

### Tracing

OpenTelemetry подключается при сложной цепочке или нескольких сервисах.

## 7. Backup

Backup считается существующим только после restore test.

ОБЯЗАТЕЛЬНО:

- schedule;
- retention;
- offsite copy;
- encryption;
- RPO/RTO;
- documented restore.

## 8. Incident management

Для production:

- severity;
- owner;
- containment;
- recovery;
- timeline;
- communication;
- postmortem;
- corrective actions.

## 9. Runbook

Для критичного сценария:

- symptom;
- checks;
- likely causes;
- safe actions;
- rollback;
- escalation;
- verification.


---

<!-- Source: 80-specialized/pdf-documents.md -->

# PDF и документный конвейер

## 1. Базовая архитектура

```text
Source
→ parsing
→ normalized document model
→ validation
→ layout planning
→ HTML/CSS
→ renderer
→ preflight
→ artifact storage
→ delivery
```

## 2. Разделение моделей

Шаблон не читает напрямую случайный payload Bitrix24, 1С или Tilda.

ОБЯЗАТЕЛЬНО иметь normalized document model.

## 3. Базовый renderer

Для дизайнерских документов:

- HTML/CSS;
- Jinja2/React templates;
- Playwright/Chromium.

Для professional print может потребоваться PrinceXML или иной движок.

## 4. Версионирование

Хранить:

- document schema version;
- template version;
- renderer version;
- source version;
- build ID;
- checksum.

## 5. Preflight

Проверки:

- missing images;
- low resolution;
- text overflow;
- empty required fields;
- font substitution;
- broken QR/link;
- wrong page count;
- failed resources;
- print profile mismatch.

## 6. Профили

Разделять:

- screen PDF;
- office print;
- professional print;
- PDF/A;
- PDF/X;
- RGB/CMYK;
- bleed/crop marks;
- font embedding.

## 7. Background build

PDF generation СЛЕДУЕТ выполнять worker-процессом, если сборка долгая или нестабильная.

UI получает build ID и восстанавливает status после перезагрузки.


---

<!-- Source: 80-specialized/telegram-integrations.md -->

# Telegram, Bitrix24 и 1С

## Telegram Bot API

Использовать:

- Python;
- aiogram;
- webhook в production;
- polling в development;
- PostgreSQL для постоянных данных;
- Redis только для FSM/rate limit/queue при необходимости.

Handler не содержит бизнес-логику. Бот — presentation adapter.

## Telegram personal account

Только при явном бизнес-требовании.

- отдельный MTProto adapter;
- Telethon/Pyrogram;
- encrypted session;
- re-auth procedure;
- rate limits;
- audit;
- изоляция от ядра;
- оценка риска блокировки и правил платформы.

## Bitrix24

Для каждой интеграции определить:

- entity;
- source of truth;
- event;
- REST method;
- field mapping;
- external ID;
- retry;
- reconciliation;
- file handling;
- permissions.

Webhook должен сохраняться в inbox до обработки.

## 1С

1С остаётся источником истины для учётных данных, если это определено процессом.

СЛЕДУЕТ:

- использовать явные DTO;
- не переносить имена полей 1С в домен без mapping;
- разделять full dump и incremental sync;
- хранить внешние ID;
- иметь reconciliation;
- контролировать объём и pagination;
- журналировать ошибки обмена;
- применять read-only по умолчанию для AI/MCP.


---

<!-- Source: 80-specialized/scraping-ai-mcp.md -->

# Scraping, AI, RAG и MCP

## 1. Scraping

Для нестабильного HTML-источника:

- parser fixtures;
- sample HTML;
- raw payload retention;
- schema drift detection;
- fallback selectors;
- parse-rate metrics;
- alert при пустом результате;
- frequency policy;
- legal/terms review;
- domain logic отдельно от parser.

Пустой результат не считается успешным автоматически.

## 2. AI

LLM — вероятностный компонент, не источник истины.

Подходящие задачи:

- classification;
- extraction;
- summarization;
- drafts;
- routing;
- semantic search;
- operator assistance.

Без контроля не применять для:

- окончательных финансовых решений;
- прав доступа;
- необратимых действий;
- deterministic calculation;
- юридически значимого решения.

## 3. Guardrails

- structured output;
- schema validation;
- prompt versioning;
- model/version log;
- cost limit;
- timeout;
- fallback;
- human-in-the-loop;
- prompt injection defense;
- minimal tool access;
- eval dataset.

## 4. RAG

- ingestion pipeline;
- chunking policy;
- metadata;
- access filter before retrieval;
- embedding version;
- reindex policy;
- deletion;
- stale index detection;
- source citation;
- retrieval evaluation.

Vector DB подключается только при semantic retrieval.

## 5. MCP

Tool должен быть:

- атомарным;
- узким;
- typed;
- auditable;
- permission-aware;
- paginated;
- limited;
- read-only by default.

Read и write tools разделяются.

Destructive tool требует дополнительного подтверждения.

SQL-инструменты:

- SELECT only по умолчанию;
- allowlist schemas/tables;
- statement timeout;
- row limit;
- no secrets;
- audit;
- запрет multi-statement.


---

<!-- Source: 80-specialized/3d-webgl.md -->

# 3D, WebGL и графические приложения

Применяется только если проект содержит 3D/графическую сцену.

## Базовый контур

- Three.js или React Three Fiber;
- явная система координат;
- scene graph;
- asset pipeline;
- camera/navigation policy;
- picking;
- gizmo;
- worker для тяжёлой обработки при необходимости.

## Performance budget

Определить:

- target FPS;
- frame budget;
- GPU memory;
- geometry count;
- draw calls;
- texture budget;
- model load time.

## Обязательные практики

- disposal geometry/material/texture;
- compressed assets;
- LOD при необходимости;
- lazy loading;
- bounding volumes;
- debounced expensive calculations;
- off-main-thread parsing, если требуется;
- fallback для слабых устройств;
- измерение GPU/CPU, а не догадки.

## UX

- predictable camera;
- undo;
- snapping;
- visible selection;
- coordinate feedback;
- keyboard modifiers;
- no accidental destructive transform.


---

<!-- Source: 90-templates/project-passport.md -->

# Шаблон паспорта проекта

## Бизнес-задача

## Пользователи

## Ключевые сценарии

## As-is / To-be

## Источники истины

## Интеграции

## Данные и классификация

## Критичность

## Нагрузка

## SLO / RTO / RPO

## Бизнес-правила

## Состояния сущностей

## Права

## Предлагаемая архитектура

## Условные технологии

## Отвергнутые альтернативы

## Риски

## План тестирования

## План deployment

## Backup / Restore

## Наблюдаемость

## План масштабирования


---

<!-- Source: 90-templates/adr.md -->

# ADR-XXX: Название

## Статус

Proposed / Accepted / Deprecated / Superseded

## Контекст

## Решение

## Альтернативы

## Причины

## Последствия

## Риски

## Условия пересмотра


---

<!-- Source: 90-templates/ai-agent-policy.md -->

# AES Policy для coding agent

Работай в соответствии с Avangard Engineering Standard.

## Обязательные правила

1. Не добавляй технологию, сервис, БД, cache, queue, bot, AI-модуль или abstraction, если необходимость не следует из требований.
2. Перед существенным компонентом укажи, какое требование он закрывает.
3. Предпочитай минимально достаточную архитектуру.
4. Не создавай пустые заготовки «на будущее».
5. Не внедряй автоматически Redis, Kubernetes, microservices, Elasticsearch, vector DB, Python service или Telegram bot.
6. Бизнес-логика не должна находиться в UI, webhook handler или Telegram handler.
7. Проверка прав выполняется на сервере.
8. Все внешние payload валидируются.
9. Постоянные изменения данных выполняются через migrations.
10. Долгие операции выносятся в worker только при наличии оснований.
11. Для критичного правила добавь тест.
12. Для нового статуса опиши state transition.
13. Для интеграции добавь timeout, retry, idempotency и mapping.
14. Для production изменения укажи rollback.
15. Не скрывай допущения и ограничения.

## Git: авторство коммитов

ЗАПРЕЩЕНО указывать соавторство AI/агента в коммитах, сообщениях коммитов, trailer-ах и метаданных.

В том числе ЗАПРЕЩЕНО:

- `Co-authored-by: Cursor <cursoragent@cursor.com>`;
- любые другие `Co-authored-by` с Cursor, Claude, Copilot, GPT и иными AI-агентами;
- формулировки вроде «generated with», «via Cursor Agent», «co-authored by AI» в теле коммита.

Автор коммита — человек (владелец репозитория / исполнитель), который принимает и фиксирует изменение. Агент не является соавтором.

## Профильное назначение

- React/Next.js — web UI и full-stack web;
- NestJS — сложный TypeScript backend;
- FastAPI/Python — DS, ML, OCR, CV, документы и вычисления;
- PostgreSQL — транзакционные данные;
- Redis — cache, TTL, lock, rate limit, queue;
- aiogram — Telegram Bot API;
- S3 — файлы и artifacts;
- Playwright — E2E и HTML-to-PDF;
- OpenSearch — только если PostgreSQL search недостаточен;
- vector DB — только для semantic retrieval.
