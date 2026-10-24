// Профиль пользователя из приветствия (v0.9): кто он (сценарий), режим приложения и ответы короткого
// интервью. Хранится в settings.profile на устройстве. От сценария зависят вопросы и стартовый набор
// виджетов главной, от режима — видны ли разделы для соревнующихся спортсменов.
import { DEFAULT_LAYOUT, type WidgetConfig, type WidgetId } from './dashboard.ts';

export const PROFILE_KEY = 'profile';

export const SCENARIOS = ['wrestler', 'gym', 'general'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_META: Record<Scenario, { title: string; text: string }> = {
  wrestler: { title: 'Борец / единоборства', text: 'Сезон и старты, выход в вес, нагрузка, восстановление' },
  gym: { title: 'Занимаюсь в зале', text: 'Программы и журнал силовых, прогресс, питание под цель' },
  general: { title: 'Для себя', text: 'Подсчёт калорий, сон и восстановление, тренировки' },
};

/** «Простой» скрывает разделы соревнующегося спортсмена, «полный» показывает всё. */
export type AppLevel = 'basic' | 'full';

export const LEVEL_LABEL: Record<AppLevel, string> = { basic: 'Простой', full: 'Полный' };

/** Виджеты и разделы, которые видны только в полном режиме. */
export const FULL_ONLY_WIDGETS: readonly WidgetId[] = ['competition', 'trainingLoad'];
export const FULL_ONLY_PATHS: readonly string[] = ['/season'];

/** Пол — для мужской или женской фигуры на схемах мышц. Без ответа — мужская. */
export type Sex = 'male' | 'female';
export const SEX_LABEL: Record<Sex, string> = { male: 'Мужской', female: 'Женский' };

export interface Profile {
  scenario: Scenario;
  sex?: Sex;
  level: AppLevel;
  name?: string;
  /** Ответ на вопрос «цель» или «вид борьбы» — текстом выбранного варианта. */
  goal?: string;
  sport?: string;
  weightCategory?: string;
  trainingsPerWeek?: string;
  interests?: string[];
  /** Пользователь скрыл подсказку о полном режиме на главной. */
  hideLevelHint?: boolean;
  /** Пользователь закрыл карточку «Оставьте отзыв и поделитесь» (или он из версий до 0.9.1). */
  hideFeedbackPrompt?: boolean;
  /** Когда пройдено приветствие (UTC ISO). */
  completedAt: string;
}

export function defaultLevel(s: Scenario): AppLevel {
  return s === 'general' ? 'basic' : 'full';
}

// ---------- Вопросы интервью ----------

export type Question =
  | { key: 'goal' | 'sport' | 'trainingsPerWeek' | 'sex'; kind: 'choice'; label: string; options: string[] }
  | { key: 'interests'; kind: 'multi'; label: string; options: string[] }
  | { key: 'weightCategory'; kind: 'text'; label: string; placeholder: string }
  | { key: 'weightKg'; kind: 'weight'; label: string };

export const INTERESTS = ['Сканер продуктов и КБЖУ', 'Сон и восстановление', 'Тренировки для себя', 'Вес тела'] as const;

const WEIGHT: Question = { key: 'weightKg', kind: 'weight', label: 'Текущий вес, кг' };
const SEX: Question = { key: 'sex', kind: 'choice', label: 'Пол (для схемы мышц)', options: [SEX_LABEL.male, SEX_LABEL.female] };

/** Ответ из интервью → пол профиля. */
export function sexFromAnswer(v: unknown): Sex | undefined {
  return v === SEX_LABEL.male ? 'male' : v === SEX_LABEL.female ? 'female' : undefined;
}

export const QUESTIONS: Record<Scenario, Question[]> = {
  wrestler: [
    SEX,
    { key: 'sport', kind: 'choice', label: 'Вид борьбы', options: ['Дзюдо', 'Самбо', 'Вольная', 'Греко-римская', 'Другое'] },
    { key: 'weightCategory', kind: 'text', label: 'Весовая категория', placeholder: 'например, -73' },
    WEIGHT,
    { key: 'goal', kind: 'choice', label: 'Что сейчас важнее', options: ['Подготовка к старту', 'Выход в вес', 'Набор формы', 'Восстановление'] },
  ],
  gym: [
    SEX,
    { key: 'goal', kind: 'choice', label: 'Цель', options: ['Набор мышц', 'Сила', 'Снижение жира', 'Поддержание формы'] },
    { key: 'trainingsPerWeek', kind: 'choice', label: 'Тренировок в неделю', options: ['1–2', '3–4', '5 и больше'] },
    WEIGHT,
  ],
  general: [
    SEX,
    { key: 'interests', kind: 'multi', label: 'Что интересно', options: [...INTERESTS] },
    { key: 'goal', kind: 'choice', label: 'Цель', options: ['Снизить вес', 'Держать форму', 'Набрать массу', 'Просто следить'] },
    WEIGHT,
  ],
};

// ---------- Стартовая главная по сценарию ----------

const ON: Record<Scenario, readonly WidgetId[]> = {
  wrestler: ['sleepNow', 'readiness', 'competition', 'weight', 'sleep', 'nutrition', 'trainings', 'trainingLoad'],
  gym: ['sleepNow', 'readiness', 'weight', 'nutrition', 'trainings', 'muscles'],
  general: ['sleepNow', 'readiness', 'sleep', 'nutrition'],
};

const BY_INTEREST: Record<(typeof INTERESTS)[number], readonly WidgetId[]> = {
  'Сканер продуктов и КБЖУ': ['nutrition'],
  'Сон и восстановление': ['sleepNow', 'readiness', 'sleep', 'wellbeing'],
  'Тренировки для себя': ['trainings', 'muscles'],
  'Вес тела': ['weight'],
};

/** Виджеты «Рекомендуем для вас» — по сценарию, у «для себя» — по выбранным интересам. Порядок по умолчанию. */
export function recommendedWidgets(p: Pick<Profile, 'scenario' | 'interests'>): WidgetId[] {
  const on = new Set<WidgetId>(ON[p.scenario]);
  if (p.scenario === 'general' && p.interests?.length) {
    on.clear();
    for (const i of p.interests) for (const w of BY_INTEREST[i as keyof typeof BY_INTEREST] ?? []) on.add(w);
    if (on.size === 0) for (const w of ON.general) on.add(w);
  }
  return DEFAULT_LAYOUT.map((w) => w.id).filter((id) => on.has(id));
}

/** Главная нового пользователя пуста — виджеты он добавляет сам, рекомендованные предлагаются первыми. */
export function emptyLayout(): WidgetConfig[] {
  return DEFAULT_LAYOUT.map((w) => ({ ...w, visible: false }));
}

/** При переходе в полный режим включаем скрытые им виджеты, чтобы было видно, что открылось. */
export function revealFullWidgets(layout: readonly WidgetConfig[]): WidgetConfig[] {
  return layout.map((w) => (FULL_ONLY_WIDGETS.includes(w.id) ? { ...w, visible: true } : w));
}

// ---------- Проверка сохранённого профиля ----------

const str = (v: unknown, max = 100): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

export function normalizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!SCENARIOS.includes(r.scenario as Scenario)) return null;
  const scenario = r.scenario as Scenario;
  const p: Profile = {
    scenario,
    level: r.level === 'basic' || r.level === 'full' ? r.level : defaultLevel(scenario),
    completedAt: str(r.completedAt, 40) ?? new Date(0).toISOString(),
  };
  for (const k of ['name', 'goal', 'sport', 'weightCategory', 'trainingsPerWeek'] as const) {
    const v = str(r[k], k === 'name' ? 40 : 100);
    if (v) p[k] = v;
  }
  if (r.sex === 'male' || r.sex === 'female') p.sex = r.sex;
  if (r.hideLevelHint === true) p.hideLevelHint = true;
  if (r.hideFeedbackPrompt === true) p.hideFeedbackPrompt = true;
  if (Array.isArray(r.interests)) {
    const list = r.interests.filter((i): i is string => typeof i === 'string' && (INTERESTS as readonly string[]).includes(i));
    if (list.length) p.interests = list;
  }
  return p;
}

// ---------- Просьба об отзыве ----------

/** Отзыв просим не при знакомстве, а когда человек попользовался: прошло 3 дня и есть хотя бы 5 записей. */
export const FEEDBACK_PROMPT_DAYS = 3;
export const FEEDBACK_PROMPT_RECORDS = 5;

export function shouldAskFeedback(p: Pick<Profile, 'completedAt' | 'hideFeedbackPrompt'>, now: Date, records: number): boolean {
  if (p.hideFeedbackPrompt) return false;
  const days = (now.getTime() - Date.parse(p.completedAt)) / 86_400_000;
  return days >= FEEDBACK_PROMPT_DAYS && records >= FEEDBACK_PROMPT_RECORDS;
}

/** Адрес формы отзыва с версией и сценарием (без имени, веса и записей) — чтобы разбирать ответы по группам. */
export function feedbackUrl(base: string, version: string, scenario?: Scenario): string {
  const u = new URL(base);
  u.searchParams.set('v', version);
  if (scenario) u.searchParams.set('mode', scenario);
  return u.toString();
}

/** Адрес формы «Сообщить об ошибке»: только версия приложения и пометка, что обращение ручное. */
export function bugReportUrl(base: string, version: string): string {
  const u = new URL(base);
  u.searchParams.set('v', version);
  u.searchParams.set('kind', 'manual');
  return u.toString();
}
