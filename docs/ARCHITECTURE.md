# Архитектура — Personal Athlete OS v0.1

## Обзор

```
Браузер (PWA, React)                         Локальный сервер (Node.js, Fastify) — необязателен
┌────────────────────────────────────┐       ┌───────────────────────────────────┐
│ src/features/*  страницы и формы   │       │ server/app.ts   /api/* + раздача  │
│ src/ui/*        общие компоненты   │ fetch │                 сборки dist/      │
│ src/domain/*    расчёты, схемы     │──────▶│ server/perek.ts адаптер Perek.us  │──▶ perek.us
│ src/data/*      Dexie / IndexedDB  │ /api  │   ключ: env PEREK_API_KEY         │   (X-Api-Key)
│ Service Worker  кэш оболочки       │       └───────────────────────────────────┘
└────────────────────────────────────┘
          ▲ shared/  — общий код: контракт каталога (zod), проверка EAN
```

Всё, кроме поиска во внешней продуктовой базе, работает в браузере без сервера и без сети.

## Стек

| Часть | Технология |
|---|---|
| Интерфейс | React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Vite 7 |
| Хранение | IndexedDB через Dexie 4, `dexie-react-hooks` (`useLiveQuery`) |
| Проверка данных | zod 4 (одни схемы для форм, базы и импорта; русская локаль сообщений) |
| PWA | vite-plugin-pwa (Workbox, generateSW, `registerType: autoUpdate`) |
| Сервер | Fastify 5, @fastify/static 10; запуск через встроенную поддержку TypeScript в Node.js ≥ 22.18 |
| Сканер | @zxing/browser (динамическая загрузка только при открытии камеры) |
| Тесты | Vitest 4, fake-indexeddb для тестов базы |
| Линтер | ESLint 9 + typescript-eslint + react-hooks |

Маршрутизация — собственный hash-роутер (`src/ui/router.ts`), стили — один файл с переменными
(`src/styles.css`, светлая и тёмная темы).

## Слои и папки

- `src/config.ts` — часовой пояс, категории по умолчанию, подписи видов спорта.
- `src/domain/` — чистые функции и схемы, без React/Dexie:
  - `schemas.ts` — все модели данных (zod) и список таблиц `ENTITY_SCHEMAS`;
  - `time.ts` — даты и время в поясе приложения, форматирование;
  - `nutrition.ts` — КБЖУ порции, суммы, рецепты, проверка калорийности;
  - `sleep.ts` — время в постели, оценка сна, средние;
  - `competition.ts` — ближайший старт, отсчёт дней, подсказка взвешивания;
  - `training.ts` — прогресс упражнений, шаблоны;
  - `backup.ts` — формат и проверка резервной копии, версия схемы данных;
  - `summary.ts` — текст сводки для ИИ и шаблоны запросов;
  - `form.ts` — разбор полей (запятая в числах), ошибки полей; `ids.ts` — идентификаторы;
  - `aiAdapter.ts` — только интерфейс будущего адаптера ИИ (реализаций нет).
- `src/data/` — доступ к хранилищу: `db.ts` (схема Dexie), `repo.ts` (сохранение с проверкой,
  удаление, настройки, экспорт/импорт), `foods.ts` (каталог продуктов).
- `src/features/` — разделы: `dashboard`, `nutrition`, `training`, `recovery`, `season`, `more`.
- `src/ui/` — `components.tsx` (страница, карточка, поле, диалог на `<dialog>`, вкладки, шкала 1–5),
  `feedback.tsx` (уведомления и подтверждения), `LineChart.tsx` (SVG-график), `router.ts`, `icons.tsx`.
- `shared/` — `catalog.ts` (контракт ответа каталога + схемы), `ean.ts`.
- `server/` — `index.ts` (запуск), `app.ts` (маршруты), `perek.ts` (адаптер).

Страницы читают данные через `useLiveQuery(() => db.<таблица>...)`, а пишут только через
`saveEntity`/`deleteEntity`/функции `src/data`. Замена хранилища (например, синхронизация с сервером)
затрагивает слой `src/data`, а не страницы.

## Данные

Таблицы IndexedDB (база `personal-athlete-os`):

| Таблица | Содержимое | Ключевые поля |
|---|---|---|
| `foods` | продукты и рецепты | `basis` (`g`/`ml`), `per100`, `source` (`manual`/`perek`/`recipe`), `recipe?` |
| `meals` | записи питания | `date` (YYYY-MM-DD по Москве), `mealType`, `amount`, снимок `per100`, `nutrients` |
| `workouts` | тренировки | `startAt` (UTC ISO), `type`, `exercises[].sets[]` |
| `exercises` | справочник упражнений | `name` |
| `workoutTemplates` | шаблоны | `exercises[].plannedSets` |
| `sleep` | сон и самочувствие | `bedtime`, `wakeTime`, оценки 1–5 |
| `competitions` | соревнования | `sport`, `weightCategory`, `startAt`, `weighInAt`, `targetWeightKg?`, `status` |
| `bodyWeights` | масса тела | `measuredAt`, `weightKg` |
| `supplements` | журнал добавок | `dose`, `doseUnit`, даты |
| `sources` | библиотека | `sourceType`, `checkedDate` |
| `settings` | ключ-значение | например `pendingSleepStart` |

У всех записей (кроме `settings`) есть `id`, `createdAt`, `updatedAt`. Моменты времени — ISO в UTC,
календарные дни — строки по Москве. Ввод `datetime-local` трактуется как московское время независимо
от пояса устройства.

### Версии схемы данных

- Текущая версия — 1 (`db.version(1)` в `src/data/db.ts`, `DATA_SCHEMA_VERSION` в `src/domain/backup.ts`;
  их совпадение проверяет тест).
- Изменение структуры: добавить `db.version(2).stores({...}).upgrade(tx => ...)`, не меняя версию 1;
  увеличить `DATA_SCHEMA_VERSION`; добавить шаг в `migrateBackupData`, чтобы старые копии импортировались.
- Резервная копия более новой версии, чем приложение, отклоняется.

### Резервная копия

JSON `{ format: "personal-athlete-os-backup", schemaVersion, exportedAt, appVersion, data: {таблица: [...]} }`.
Импорт: проверка формата, версии, каждой записи по схеме, уникальности id; при любой ошибке не
импортируется ничего. Запись — одной транзакцией Dexie (при сбое база не меняется).

## Внешние зависимости и Perek.us

- Документация: https://perek.us/developers (проверено 22.10.2026). База URL `https://perek.us/api/v1/foods`,
  `GET /search?q=&limit=&market=ru`, `GET /barcode/{ean}`, ключ в заголовке `X-Api-Key`.
- Сервер нормализует ответ к `CatalogResponse` (`shared/catalog.ts`); клиент проверяет его той же схемой.
- Формат ответа по штрихкоду в документации не показан — адаптер ищет карточку на верхнем уровне,
  в `food` и в `foods[0]`; что не разобралось — `bad_response`.
- Ошибки: нет ключа → `disabled` (503), 404 → `not_found` (с названием товара, если оно есть), 429 →
  `rate_limited` + `Retry-After` и пауза запросов, 401/403 → `auth_failed`, тайм-аут 8 с → `timeout`,
  сеть → `network`, неожиданный формат → `bad_response`.
- Свой лимит 15 запросов/мин (ниже 20/мин бесплатного тарифа), кэш в памяти: поиск 1 ч, штрихкод 24 ч
  (включая «не найдено»).
- Ссылка на источник принимается только на домен perek.us.

### Open Food Facts (с v0.2)

- `src/features/nutrition/openFoodFacts.ts`, запрос **из браузера без сервера**:
  `GET https://world.openfoodfacts.org/api/v2/product/{ean}.json?fields=…`. Ключ не нужен, API отдаёт
  `Access-Control-Allow-Origin: *` (проверено 22.10.2026).
- Поиск по названию из браузера невозможен: `cgi/search.pl` и `search.openfoodfacts.org` не разрешают
  запросы со сторонних сайтов (CORS) — проверено в браузере 22.10.2026. Поэтому OFF — только штрихкод.
- Нормализация: русское название приоритетно; ккал из `energy-kcal_100g`, иначе кДж / 4,184; основа
  «мл» по `product_quantity_unit` или по «мл/л» в `quantity`, иначе «г». Нет любого из ккал/Б/Ж/У или
  Б+Ж+У > 100 г на 100 г → `not_found` с названием товара, а не продукт с нулями.
- Атрибуция «Данные: Open Food Facts (ODbL)» со ссылкой на карточку товара.

### Цепочка по штрихкоду

`barcodeCatalog = chainBarcodeProviders(perekProvider, offProvider)` (`catalogProvider.ts`): свой каталог →
Perek.us (если сервер с ключом доступен) → Open Food Facts. Без сервера (GitHub Pages) Perek пропускается.
Поиск по названию — только Perek.us. Атрибуция в интерфейсе берётся по `food.provider`.

### Питание v0.4: модули

- `src/domain/russianStemmer.ts`, `foodSearch.ts` — поиск (стемминг, синонимы, опечатки, ранжирование).
- `src/domain/foodHistory.ts` — «Моя история» из записей `meals` (последняя порция, частота, по приёмам).
- `src/domain/nutrients.ts` — расширенные нутриенты: подписи, пересчёт, суммы с покрытием.
- `src/domain/plan.ts` — личный план (схема, расчёт, источники). Хранение — `settings.nutritionPlan`.
- `src/data/offlineBase.ts` — загрузка `public/data/off-ru.json` (precache SW), индекс поиска, поиск по EAN.
- `src/data/meals.ts` — запись приёма пищи (снимок КБЖУ и `extra`), быстрый ввод, вода.
- `src/features/nutrition/foodOptions.ts` — единый поиск по истории, своим продуктам, встроенной и офлайн-базе.
- `AddFlow.tsx` (шторка → экран «История/Поиск/Рецепты» → порция), `MealEntryDialog.tsx` (порция и правка),
  `NutritionPage.tsx`, `WaterCard.tsx`, `NutritionStats.tsx`, `PlanDialog.tsx`, `NutrientDetails.tsx`.
- Встроенная база: `scripts/build-reference-foods.py` → `src/data/referenceFoods.ts` (продукты с `aliases`,
  блюда с `recipe`). Офлайн-база OFF: `scripts/build-off-russia.py` → `public/data/off-ru.json`.

### Встроенный справочник (с v0.3)

- `src/data/referenceFoods.ts` — 150 продуктов USDA FoodData Central SR Legacy (CC0), значения на 100 г.
  Генерируется `scripts/build-reference-foods.py` из CSV-выгрузки USDA
  (FoodData_Central_sr_legacy_food_csv_2018-04.zip; nutrient_id 1008 ккал, 1003 белки, 1004 жиры, 1005 углеводы).
  Запуск: `python scripts/build-reference-foods.py <папка с food.csv> src/data/referenceFoods.ts`.
  Чтобы добавить продукт — дописать `fdc_id: 'русское название'` в `PICK`.
- Поиск: `src/domain/foodSearch.ts` (слова в любом порядке, начало слова, е/ё) — и для своих продуктов,
  и для справочника. В окне добавления сначала свои продукты, затем справочник.
- Выбранный справочный продукт не попадает в `foods`; запись `meals` хранит снимок КБЖУ и `sourceUrl`
  на карточку fdc.nal.usda.gov.

## Публикация (GitHub Pages)

- `vite.config.ts`: `base` = `BASE_PATH` (по умолчанию `/`); `start_url` и `scope` манифеста — тот же путь.
  В `index.html` пути иконок через `%BASE_URL%`.
- `.github/workflows/pages.yml`: typecheck + lint + test → `BASE_PATH=/<repo>/ npm run build` → Pages.
- Hash-маршрутизация не требует настройки 404 на Pages.

## PWA и офлайн

- Service Worker кэширует оболочку (JS, CSS, HTML, иконки, манифест). Ответы `/api` не кэшируются.
- Регистрируется только в защищённом контексте: `localhost` или HTTPS. По `http://<IP>` с телефона не работает;
  на GitHub Pages (HTTPS) работает.
- Обновление: новая сборка подхватывается автоматически при следующем открытии (autoUpdate).
- Сервер раздаёт файлы сборки с диска при каждом запросе, отсутствующий файл → 404 (а не index.html).

## Будущие расширения — куда встраивать

- Аккаунты и несколько спортсменов: поле `athleteId` в записях (новая версия схемы) и серверное хранилище
  за слоем `src/data`.
- Синхронизация: `updatedAt` уже есть у записей; нужен журнал изменений/удалений и сервер.
- Apple Health / Apple Watch: импорт сна и тренировок через нативное приложение или экспорт Health → JSON,
  с сохранением источника записи.
- ИИ: реализация `AiAdapter` через сервер (ключ в env), отправка только подтверждённого текста.
- Планы фаз сезона: отдельная таблица планов и связь `workout.planId` для сравнения план/факт.
