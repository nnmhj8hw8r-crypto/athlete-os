// Виджеты главного экрана: какие показывать, в каком порядке и за какой период (настройка пользователя,
// хранится в settings.dashboardLayout). Неизвестные и повторяющиеся записи отбрасываются, новые виджеты
// добавляются в конец — так старая сохранённая настройка не ломается после обновления приложения.

export const WIDGET_IDS = ['competition', 'weight', 'sleep', 'wellbeing', 'sleepStrip', 'nutrition', 'trainings'] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

export const WIDGET_LABEL: Record<WidgetId, string> = {
  competition: 'Ближайший старт',
  weight: 'Масса тела',
  sleep: 'Время в постели',
  wellbeing: 'Самочувствие',
  sleepStrip: 'Записи сна за 14 дней',
  nutrition: 'Питание сегодня',
  trainings: 'Последние тренировки',
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
  { id: 'competition', visible: true },
  { id: 'weight', visible: true, period: '30' },
  { id: 'sleep', visible: true, period: '14' },
  { id: 'wellbeing', visible: true, period: '14' },
  { id: 'sleepStrip', visible: false },
  { id: 'nutrition', visible: true },
  { id: 'trainings', visible: true },
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
  for (const d of DEFAULT_LAYOUT) if (!out.some((w) => w.id === d.id)) out.push({ ...d });
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

export function updateWidget(list: readonly WidgetConfig[], id: WidgetId, patch: Partial<Omit<WidgetConfig, 'id'>>): WidgetConfig[] {
  return list.map((w) => (w.id === id ? { ...w, ...patch } : w));
}
