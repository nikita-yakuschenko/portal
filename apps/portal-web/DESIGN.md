---
name: AVGST B2B Portal
description: Кабинеты HQ и дилеров производителя модульных и панельно-каркасных домов
colors:
  avangard-green: "oklch(0.677 0.149 149)"
  avangard-green-dark: "oklch(0.72 0.145 149)"
  avangard-yellow: "oklch(0.857 0.174 90)"
  avangard-ink: "oklch(0.178 0 0)"
  avangard-graphite: "oklch(0.26 0 0)"
  cold-paper: "oklch(0.973 0.003 265)"
  cold-mist: "oklch(0.968 0.004 265)"
  surface-white: "oklch(1 0 0)"
  muted-speech: "oklch(0.556 0 0)"
  hairline: "oklch(0.922 0 0)"
  alarm-red: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "var(--font-geist-sans), var(--font-inter), Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "var(--font-geist-sans), var(--font-inter), Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "var(--font-geist-sans), var(--font-inter), Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "var(--font-geist-sans), var(--font-inter), Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "var(--font-geist-sans), var(--font-inter), Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
  caption:
    fontFamily: "var(--font-geist-sans), var(--font-inter), Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  2xl: "1.125rem"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
  8: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.avangard-green}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.avangard-green}"
    textColor: "{colors.surface-white}"
  button-outline:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.avangard-ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.avangard-ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-destructive:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    height: "2.25rem"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.avangard-ink}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.avangard-ink}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
    typography: "{typography.body}"
  badge-default:
    backgroundColor: "{colors.avangard-green}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
    typography: "{typography.caption}"
  badge-secondary:
    backgroundColor: "{colors.cold-mist}"
    textColor: "{colors.avangard-ink}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
  sidebar-item-active:
    backgroundColor: "{colors.cold-mist}"
    textColor: "{colors.avangard-ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
---

# Design System: AVGST B2B Portal

## Overview

**Creative North Star: "Заводской цех"**

Кабинет — рабочая площадка, а не витрина. Всё, чем пользуются каждый день, лежит на виду и подписано; ничто не спрятано за жестами и догадками. Поверхности холодные и светлые, как цех при дневном свете: белые карточки на бледно-сером полу страницы, тонкие серые линии вместо декоративных разделителей. Плотность близка к демо shadcn — оператор видит много данных без прокрутки, но не задыхается.

Зелёный работает как крашеная кнопка на станке: он редкий, всегда означает действие и никогда не растекается заливкой по экрану. Жёлтый — фирменный импульс из логотипа, появляется точечно и не конкурирует с зелёным. Всё остальное — оттенки холодного серого и чернильный текст.

Компоненты ощущаются осязаемо и уверенно: границы читаются, нажатие заметно, состояния отчётливы. Осязаемость достигается плотностью заливки и чёткостью контура, а не тенями и свечением — глубина здесь тональная, а не световая. Интерфейс намеренно не похож на универсальный AI-дашборд с фиолетовыми градиентами и на «премиальный» лендинг: он похож на инструмент.

**Key Characteristics:**

- Холодные светлые поверхности, ни одного тёплого бежевого фона
- Зелёный только на действии; на экране один доминирующий CTA
- Разделение границей и сменой поверхности, а не тенью
- Плотность рабочего инструмента, а не маркетингового экрана
- Канон shadcn/new-york читается раньше, чем логотип бренда

## Colors

Палитра холодная и почти монохромная: один зелёный акцент действия, один жёлтый импульс бренда, всё остальное — нейтрали.

### Primary

- **Avangard Green** (`oklch(0.677 0.149 149)`): главное действие, focus ring, активный пункт сайдбара, цена и подтверждение. Появляется на кнопке «Сохранить», «Опубликовать», «Добавить» — по одной штуке на экран. В тёмной теме светлеет до `oklch(0.72 0.145 149)`, чтобы удержать контраст на графите.

### Secondary

- **Avangard Yellow** (`oklch(0.857 0.174 90)`): фирменный импульс из логотипа. Живёт в `--brand-yellow`, а не в `--accent`: жёлтый — это бренд, а не состояние наведения. Допустим как редкий промо-акцент или жёлтая кнопка первого экрана на витрине дилера, но не как массовый цвет кнопок кабинета.

### Neutral

- **Avangard Ink** (`oklch(0.178 0 0)`): весь основной текст, заголовки, значения в таблицах.
- **Avangard Graphite** (`oklch(0.26 0 0)`): тёмные поверхности, карточки тёмной темы, маркетинговые тёмные блоки.
- **Cold Paper** (`oklch(0.973 0.003 265)`): пол рабочей области кабинета и поверхность сайдбара. Именно на нём стоят белые карточки — этот перепад и создаёт слои.
- **Cold Mist** (`oklch(0.968 0.004 265)`): вторичные заливки, `muted`, `accent`, hover пунктов меню, фон бейджа-статуса.
- **Surface White** (`oklch(1 0 0)`): карточки, поповеры, диалоги — то, на чём читают и вводят.
- **Muted Speech** (`oklch(0.556 0 0)`): подписи, пояснения под полем, вторичный текст. Взят каноничным, а не брендовым `#999999`, который не проходит AA.
- **Hairline** (`oklch(0.922 0 0)`): границы карточек, полей и разделители. Светлее брендового `#DBDBDB` — это главный визуальный признак «как в документации shadcn».
- **Alarm Red** (`oklch(0.577 0.245 27.325)`): удаление, отклонение, ошибка. Семантический красный, не фирменный.

### Named Rules

**The One Green Rule.** Зелёный занимает не более 6% площади экрана и всегда означает действие. Второй зелёный элемент на экране — повод пересмотреть иерархию, а не добавить третий.

**The Cold Neutral Rule.** Нейтрали остаются холодными: любой тёплый бежевый или кремовый фон — чужой в этой системе, даже если он «мягче».

**The Yellow Is Brand Rule.** Жёлтый берётся только из `--brand-yellow`. Присваивать его `--accent` запрещено: `--accent` — это состояние интерфейса, а не голос бренда.

## Typography

**Display / Body Font:** Geist Sans (fallback Inter, затем Arial)
**Служебный акцент:** Roboto Condensed — только подпись имени аккаунта на QR-экране витрины

**Character:** один гротеск на весь продукт. Geist держит цифры и плотные таблицы, не привлекая к себе внимания; шкала повторяет демо shadcn, а не маркетинговый Display.

### Hierarchy

- **Display** (600, 30px, 1.2): заголовок страницы кабинета, единственный на экране.
- **Headline** (600, 20px, 1.3): заголовок карточки или крупного раздела.
- **Title** (600, 16px, 1.4): подраздел, заголовок диалога, имя строки.
- **Body** (400, 14px, 1.43): основной текст, значения полей, ячейки таблиц.
- **Label** (500, 14px, 1): подписи полей, текст кнопок, пункты меню.
- **Caption** (400, 12px, 1.33): пояснения под полем, метаданные, бейджи.

### Named Rules

**The shadcn Scale Rule.** Размеры берутся из типографики компонентов registry (`text-sm`, `font-medium`), параллельная шкала классов не вводится.

**The No Caps Rule.** Капс допустим только в микро-метках (бейдж, eyebrow до трёх слов). Длинный текст капсом запрещён.

## Layout

Рабочая область кабинета — `--page` (холодная бумага), контент — белые карточки на ней. Навигация вынесена в `Sidebar` из registry, ширина контента ограничена контейнером, отступы страницы 24–32px.

Ритм построен на 4px-шкале Tailwind: 8 / 12 / 16 / 24 — основные шаги, 32 — между крупными секциями. Произвольных значений вне шкалы нет.

Плотность — как в демо shadcn Dashboard: строка таблицы 36–40px, поле ввода 36px, кнопка 36px. Формы группируются в карточки по смыслу, а не льются одним списком.

Адаптив: до 768px всё сворачивается в одну колонку, сайдбар уходит в `Sheet`. Двухколоночные формы разбираются на стек — горизонтальная прокрутка запрещена.

## Elevation & Depth

Система тональная, не световая. Глубина создаётся сменой поверхности (`--page` → `--card`) и волосяной границей, а не тенью. Тени берутся только те, что даёт канон shadcn: `shadow-xs` у кнопки и поля, `shadow-sm` у карточки, отдельная тень у диалога и поповера.

### Shadow Vocabulary

- **Control** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): кнопки и поля ввода в покое.
- **Overlay** (канон shadcn у `Dialog` / `Popover` / `Sheet`): слои, всплывающие над страницей.

### Named Rules

**The Border Over Shadow Rule.** Если блок нужно отделить — сначала граница и смена поверхности, тень только для того, что физически всплывает над страницей.

**The No Glow Rule.** Многослойные свечения, цветные ореолы и «пузырьковые» сверхскругления запрещены.

## Shapes

Единственная точка настройки геометрии — `--radius: 0.625rem` (10px). Производная шкала мультипликативная и не переопределяется: `sm` 6px (бейджи, мелкие контролы), `md` 8px (кнопки, поля), `lg` 10px (карточки), `xl` 14px (крупные контейнеры и медиа), `2xl` 18px (секции).

Форма спокойная: прямоугольник со скруглением, без скосов, без капсул для прямоугольных элементов. Капсула (`rounded-full`) допустима только у аватара, точки-статуса и круглой иконочной кнопки.

## Components

### Buttons

- **Shape:** мягко скруглённый прямоугольник (8px), высота 36px, иконка `size-4` слева.
- **Primary:** зелёная заливка, белый текст. Одна на экран.
- **Hover / Focus:** затемнение по opacity-модели (`hover:bg-primary/90`), focus — кольцо `--ring` зелёного. Отдельного HEX-класса на hover нет.
- **Outline / Secondary / Ghost:** белая заливка с границей, туманная заливка, прозрачный фон — по убыванию веса. Ghost — для действий в строке таблицы и тулбаре.
- **Destructive:** красная заливка, всегда в паре с `AlertDialog`.

### Cards / Containers

- **Corner Style:** 10px.
- **Background:** белая поверхность на холодной бумаге страницы.
- **Shadow Strategy:** `shadow-sm`, не больше; отделение работает границей.
- **Border:** волосяная линия `--border`.
- **Internal Padding:** 24px, заголовок и описание в `CardHeader`.

### Inputs / Fields

- **Style:** прозрачный фон, граница `--input`, скругление 8px, высота 36px.
- **Focus:** зелёное кольцо `--ring` и подсветка границы; фокус всегда виден.
- **Error:** граница и текст ошибки в `Alarm Red`, сообщение под полем и объясняет, что исправить.
- **Label:** виден постоянно, placeholder никогда не заменяет подпись.

### Navigation

- **Style:** `Sidebar` из registry на поверхности `--sidebar`, активный пункт — заливка `--sidebar-accent` с чернильным текстом, зелёный отмечает только текущий раздел.
- **Mobile:** сайдбар превращается в `Sheet`.

### Badges

- **Style:** статус в 12px, скругление 6px. Семантика через варианты (`default` / `secondary` / `outline` / `destructive`), а не через произвольные цвета.

### Feedback

- **Toast (`Sonner`):** результат действия пользователя — «сохранено», «не удалось подключить». Один `<Toaster />` в корневом layout.
- **Alert:** состояние экрана, не привязанное к последнему клику — «не удалось загрузить», «работает в тестовом режиме».

## Do's and Don'ts

### Do:

- **Do** брать компонент из registry shadcn (`npx shadcn@latest add`) и выражать бренд темой, а не форком разметки.
- **Do** ссылаться на семантические токены (`bg-primary`, `text-muted-foreground`), а не на разовые HEX в JSX.
- **Do** держать один доминирующий зелёный CTA на экран.
- **Do** отделять блоки границей и сменой поверхности; тень — только у того, что всплывает.
- **Do** давать каждому data-экрану состояния loading / empty / error, а результат мутации отправлять тостом.
- **Do** использовать иконки Tabler размером `size-4` в кнопках и меню, задавая размер классом, а не пропом.

### Don't:

- **Don't** создавать параллельные `PrimaryButton` или `AvgstCard`, если в registry есть аналог.
- **Don't** переопределять производные `--radius-*`: единственная точка настройки — `--radius`.
- **Don't** красить `--accent` в жёлтый: это состояние интерфейса, а не бренд.
- **Don't** смешивать Tabler и Lucide в одном интерфейсе.
- **Don't** дублировать тост инлайновым текстом рядом с формой.
- **Don't** добавлять тёплые бежевые фоны, многослойные свечения и градиентные заливки экрана.
- **Don't** заменять подпись поля плейсхолдером.
