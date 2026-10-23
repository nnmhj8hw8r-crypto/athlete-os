// Виджеты главного экрана: какие показывать, в каком порядке и за какой период (настройка пользователя,
// хранится в settings.dashboardLayout). Неизвестные и повторяющиеся записи отбрасываются, новые виджеты
// встают на своё место из порядка по умолчанию (после ближайшего соседа) — так старая сохранённая
// настройка не ломается после обновления приложения.

export const WIDGET_IDS = [
  'sleepNow',
  'readiness',
  'competition',
  'weight',
  'sleep',
  'wellbeing',
  'sleepStrip',
  'nutrition',
  'trainings',
  'muscles',
  'trainingLoad',
] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

export const WIDGET_LABEL: Record<WidgetId, string> = {
  sleepNow: 'Сон: «Лёг спать» / «Проснулся»',
  readiness: 'Готовность к тренировке',
  competition: 'Ближайший старт',
  weight: 'Масса тела',
  sleep: 'Время в постели',
  wellbeing: 'Самочувствие',
  sleepStrip: 'Записи сна за 14 дней',
  nutrition: 'Питание сегодня',
  trainings: 'Последние тренировки',
  muscles: 'Усталость мышц',
  trainingLoad: 'Готовность и нагрузка по неделям',
};

/** Пояснение к виджету в окне настройки — чтобы было понятно, что он покажет. */
export const WIDGET_HINT: Record<WidgetId, string> = {
  sleepNow: 'Кнопка «Лёг спать» вечером и «Проснулся» утром — время сна запишется само.',
  readiness: 'Утренний чек-ин за 30 секунд и оценка, насколько вы готовы к тренировке сегодня.',
  competition: 'Сколько дней до старта и взвешивания, цель по весу.',
  weight: 'График массы тела и изменение за неделю.',
  sleep: 'Сколько вы были в постели — график за 2 недели, месяц или 3 месяца.',
  wellbeing: 'Качество сна, энергия и настроение по вашим отметкам.',
  sleepStrip: 'Полоска ночей за 2 недели: видно пропуски и короткие ночи.',
  nutrition: 'Калории, белки, жиры и углеводы за сегодня.',
  trainings: 'Три последние тренировки: что, когда и сколько длилось.',
  muscles: 'Схема тела: какие мышцы ещё восстанавливаются после тренировок.',
  trainingLoad: 'Готовность и нагрузка по неделям — видно накопление усталости.',
};

/** Варианты периода для виджетов с графиком. */
export const WIDGET_PERIODS: Partial<Record<WidgetId, { value: string; label: string }[]>> = {
  weight: [
    { value: '30', label: '30 дн' },
    { value: '90', label: '90 дн' },
    { value: 'all', label: 'Всё' },
  ],
  sleep: [
    { value: '14', label: '2 нед' },
    { value: '30', label: '30 дн' },
    { value: '90', label: '90 дн' },
  ],
  wellbeing: [
    { value: '14', label: '2 нед' },
    { value: '30', label: '30 дн' },
    { value: '90', label: '90 дн' },
  ],
};

export interface WidgetConfig {
  id: WidgetId;
  visible: boolean;
  period?: string;
}

export const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: 'sleepNow', visible: true },
  { id: 'readiness', visible: true },
  { id: 'competition', visible: true },
  { id: 'weight', visible: true, period: '30' },
  { id: 'sleep', visible: true, period: '14' },
  { id: 'wellbeing', visible: true, period: '14' },
  { id: 'sleepStrip', visible: false },
  { id: 'nutrition', visible: true },
  { id: 'trainings', visible: true },
  { id: 'muscles', visible: false },
  { id: 'trainingLoad', visible: false },
];

const isWidget = (v: unknown): v is WidgetId => typeof v === 'string' && (WIDGET_IDS as readonly string[]).includes(v);

function validPeriod(id: WidgetId, p: unknown): string | undefined {
  const opts = WIDGET_PERIODS[id];
  if (!opts) return undefined;
  return typeof p === 'string' && opts.some((o) => o.value === p) ? p : DEFAULT_LAYOUT.find((w) => w.id === id)?.period;
}

/** Приводит сохранённую настройку к корректному виду. */
export function normalizeLayout(raw: unknown): WidgetConfig[] {
  const out: WidgetConfig[] = [];
  if (Array.isArray(raw)) {
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      const { id, visible, period } = r as Record<string, unknown>;
      if (!isWidget(id) || out.some((w) => w.id === id)) continue;
      const cfg: WidgetConfig = { id, visible: visible !== false };
      const p = validPeriod(id, period);
      if (p) cfg.period = p;
      out.push(cfg);
    }
  }
  DEFAULT_LAYOUT.forEach((d, k) => {
    if (out.some((w) => w.id === d.id)) return;
    // Ближайший предыдущий по умолчанию виджет, который уже есть в списке; если нет — в начало.
    const prev = DEFAULT_LAYOUT.slice(0, k)
      .reverse()
      .find((p) => out.some((w) => w.id === p.id));
    const at = prev ? out.findIndex((w) => w.id === prev.id) + 1 : 0;
    out.splice(at, 0, { ...d });
  });
  return out;
}

/** Сдвиг виджета на одну позицию вверх (−1) или вниз (+1). */
export function moveWidget(list: readonly WidgetConfig[], id: WidgetId, dir: -1 | 1): WidgetConfig[] {
  const i = list.findIndex((w) => w.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Меняет местами два виджета — для перемещения, когда часть списка скрыта простым режимом. */
export function swapWidgets(list: readonly WidgetConfig[], a: WidgetId, b: WidgetId): WidgetConfig[] {
  const i = list.findIndex((w) => w.id === a);
  const j = list.findIndex((w) => w.id === b);
  if (i < 0 || j < 0) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function updateWidget(list: readonly WidgetConfig[], id: WidgetId, patch: Partial<Omit<WidgetConfig, 'id'>>): WidgetConfig[] {
  return list.map((w) => (w.id === id ? { ...w, ...patch } : w));
}
