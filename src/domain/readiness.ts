// Оценка готовности к тренировке 0–100 относительно ЛИЧНОЙ нормы пользователя (v0.8).
//
// Личная норма показателя — медиана последних (до 28) значений из прошлых чек-инов. Каждый показатель
// переводится в 0–100: на уровне нормы — 70, каждое «типичное отклонение» (scale) в лучшую сторону +30,
// в худшую −30, с ограничением 0–100. Показатели собраны в 4 компонента со стартовыми весами
// (сон 30%, энергия/настроение/стресс 25%, мышечная боль 25%, пульс покоя/HRV 20%). Компонент без данных
// выпадает, его вес распределяется на остальные. Пока прошлых чек-инов меньше M (по умолчанию 7) —
// «Калибровка». Все числа — стартовые предложения, научно не проверены и настраиваются пользователем.
// Это описание своих записей, а не медицинская оценка.
import { joinMuscles } from './muscles.ts';
import type { Checkin, Muscle } from './schemas.ts';

export type ComponentId = 'sleep' | 'wellbeing' | 'soreness' | 'heart';
export type MetricId = 'sleepHours' | 'sleepQuality' | 'energy' | 'mood' | 'stress' | 'soreCount' | 'restingHr' | 'lnHrv';

export interface ReadinessConfig {
  /** Сколько прошлых чек-инов нужно до первой оценки (M). */
  calibrationDays: number;
  /** Веса компонентов, % (сумма не обязана быть 100 — нормируется). */
  weights: Record<ComponentId, number>;
  /** Время восстановления мышц, ч. */
  recoveryHoursSmall: number;
  recoveryHoursLarge: number;
}

export const DEFAULT_READINESS_CONFIG: ReadinessConfig = {
  calibrationDays: 7,
  weights: { sleep: 30, wellbeing: 25, soreness: 25, heart: 20 },
  recoveryHoursSmall: 48,
  recoveryHoursLarge: 72,
};

export const COMPONENT_LABEL: Record<ComponentId, string> = {
  sleep: 'Сон',
  wellbeing: 'Энергия, настроение, стресс',
  soreness: 'Мышечная боль',
  heart: 'Пульс покоя и HRV',
};

const clampInt = (v: unknown, lo: number, hi: number, def: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : def;

export function normalizeReadinessConfig(raw: unknown): ReadinessConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReadinessConfig>;
  const w = (r.weights && typeof r.weights === 'object' ? r.weights : {}) as Partial<Record<ComponentId, number>>;
  const d = DEFAULT_READINESS_CONFIG;
  return {
    calibrationDays: clampInt(r.calibrationDays, 3, 28, d.calibrationDays),
    weights: {
      sleep: clampInt(w.sleep, 0, 100, d.weights.sleep),
      wellbeing: clampInt(w.wellbeing, 0, 100, d.weights.wellbeing),
      soreness: clampInt(w.soreness, 0, 100, d.weights.soreness),
      heart: clampInt(w.heart, 0, 100, d.weights.heart),
    },
    recoveryHoursSmall: clampInt(r.recoveryHoursSmall, 12, 168, d.recoveryHoursSmall),
    recoveryHoursLarge: clampInt(r.recoveryHoursLarge, 12, 168, d.recoveryHoursLarge),
  };
}

interface MetricDef {
  component: ComponentId;
  /** +1 — больше лучше, −1 — больше хуже. */
  dir: 1 | -1;
  /** «Типичное отклонение» для перевода в баллы. */
  scale: number;
  get: (c: Checkin) => number | undefined;
}

export const METRICS: Record<MetricId, MetricDef> = {
  sleepHours: { component: 'sleep', dir: 1, scale: 1, get: (c) => c.sleepHours },
  sleepQuality: { component: 'sleep', dir: 1, scale: 1, get: (c) => c.sleepQuality },
  energy: { component: 'wellbeing', dir: 1, scale: 1, get: (c) => c.energy },
  mood: { component: 'wellbeing', dir: 1, scale: 1, get: (c) => c.mood },
  stress: { component: 'wellbeing', dir: -1, scale: 1, get: (c) => c.stress },
  soreCount: { component: 'soreness', dir: -1, scale: 2, get: (c) => c.soreMuscles.length },
  restingHr: { component: 'heart', dir: -1, scale: 4, get: (c) => c.restingHr },
  lnHrv: { component: 'heart', dir: 1, scale: 0.15, get: (c) => (c.hrvRmssd ? Math.log(c.hrvRmssd) : undefined) },
};

const METRIC_IDS = Object.keys(METRICS) as MetricId[];
const NORM_WINDOW = 28;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export interface Factor {
  metric: MetricId;
  value: number;
  norm: number;
  /** Отклонение в «типичных отклонениях» со знаком «лучше(+)/хуже(−)». */
  impact: number;
}

export type ReadinessResult =
  | { kind: 'no-checkin' }
  | { kind: 'calibrating'; have: number; need: number }
  | { kind: 'insufficient' }
  | {
      kind: 'score';
      score: number;
      components: Partial<Record<ComponentId, number>>;
      factors: Factor[];
      /** Компоненты, по которым нет данных (их вес перераспределён). */
      missing: ComponentId[];
    };

/** Готовность на день `date` по чек-ину этого дня и прошлым чек-инам. */
export function computeReadiness(checkins: readonly Checkin[], date: string, config: ReadinessConfig = DEFAULT_READINESS_CONFIG): ReadinessResult {
  const today = checkins.find((c) => c.date === date);
  if (!today) return { kind: 'no-checkin' };
  const past = checkins.filter((c) => c.date < date).sort((a, b) => b.date.localeCompare(a.date));
  if (past.length < config.calibrationDays) return { kind: 'calibrating', have: past.length, need: config.calibrationDays };

  const factors: Factor[] = [];
  const byComponent: Partial<Record<ComponentId, number[]>> = {};
  for (const id of METRIC_IDS) {
    const def = METRICS[id];
    const value = def.get(today);
    if (value === undefined) continue;
    const history = past.flatMap((c) => {
      const v = def.get(c);
      return v === undefined ? [] : [v];
    });
    // Норма показателя — только если у него самого достаточно прошлых значений.
    if (history.length < config.calibrationDays) continue;
    const norm = median(history.slice(0, NORM_WINDOW))!;
    const impact = (def.dir * (value - norm)) / def.scale;
    factors.push({ metric: id, value, norm, impact });
    (byComponent[def.component] ??= []).push(Math.min(100, Math.max(0, 70 + 30 * impact)));
  }

  const components: Partial<Record<ComponentId, number>> = {};
  const missing: ComponentId[] = [];
  let sum = 0;
  let wsum = 0;
  for (const c of Object.keys(config.weights) as ComponentId[]) {
    const scores = byComponent[c];
    const w = config.weights[c];
    if (!scores?.length) {
      missing.push(c);
      continue;
    }
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    components[c] = Math.round(avg);
    sum += avg * w;
    wsum += w;
  }
  if (wsum === 0) return { kind: 'insufficient' };
  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return { kind: 'score', score: Math.round(sum / wsum), components, factors, missing };
}

/** Оценка по дням за период (для истории и недельного графика). null — оценки нет. */
export function readinessSeries(checkins: readonly Checkin[], dates: readonly string[], config: ReadinessConfig = DEFAULT_READINESS_CONFIG): (number | null)[] {
  return dates.map((d) => {
    const r = computeReadiness(checkins, d, config);
    return r.kind === 'score' ? r.score : null;
  });
}

export interface ReadinessBand {
  title: string;
  advice: string;
  level: 'high' | 'moderate' | 'low' | 'rest';
}

export function readinessBand(score: number): ReadinessBand {
  if (score >= 80) return { level: 'high', title: 'Готов к нагрузке', advice: 'Можно тренироваться в полную силу' };
  if (score >= 60) return { level: 'moderate', title: 'Умеренная готовность', advice: 'Умеренная нагрузка' };
  if (score >= 40) return { level: 'low', title: 'Сниженная готовность', advice: 'Лёгкая тренировка или работа над техникой' };
  return { level: 'rest', title: 'Низкая готовность по вашим записям', advice: 'Лучше отдых или очень лёгкая активность' };
}

/** Совет одной строкой: уровень нагрузки + какие группы ещё восстанавливаются. */
export function adviceLine(score: number, recovering: readonly Muscle[]): string {
  const base = readinessBand(score).advice;
  if (!recovering.length) return `${base}.`;
  const list = recovering.slice(0, 3);
  return `${base}, ${joinMuscles(list)} ещё ${list.length > 1 ? 'восстанавливаются' : 'восстанавливается'}.`;
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export const METRIC_LABEL: Record<MetricId, string> = {
  sleepHours: 'Сон',
  sleepQuality: 'Качество сна',
  energy: 'Энергия',
  mood: 'Настроение',
  stress: 'Стресс',
  soreCount: 'Мышечная боль',
  restingHr: 'Пульс покоя',
  lnHrv: 'HRV',
};

/** Текст плитки «Что влияет»: значение и отклонение от нормы. */
export function describeFactor(f: Factor): { label: string; value: string; delta: string; up: boolean; better: boolean } {
  const up = f.value > f.norm;
  const better = f.impact > 0;
  const same = Math.abs(f.impact) < 0.25;
  const diff = Math.abs(f.value - f.norm);
  const rel = (more: string, less: string) => (same ? 'как обычно' : up ? more : less);
  switch (f.metric) {
    case 'sleepHours':
      return { label: 'Сон', value: `${r1(f.value)} ч`, delta: same ? 'как обычно' : `на ${r1(diff)} ч ${up ? 'выше' : 'ниже'} нормы`, up, better };
    case 'restingHr':
      return { label: 'Пульс покоя', value: `${Math.round(f.value)} уд/мин`, delta: same ? 'как обычно' : `${up ? '+' : '−'}${Math.round(diff)} к норме`, up, better };
    case 'lnHrv': {
      const ms = Math.exp(f.value);
      const pct = Math.round((Math.exp(Math.abs(f.value - f.norm)) - 1) * 100);
      return { label: 'HRV', value: `${Math.round(ms)} мс (ln ${r1(f.value)})`, delta: same ? 'как обычно' : `${up ? 'выше' : 'ниже'} нормы на ${pct}%`, up, better };
    }
    case 'soreCount':
      return { label: 'Мышечная боль', value: `${f.value} ${f.value === 1 ? 'группа' : f.value >= 2 && f.value <= 4 ? 'группы' : 'групп'}`, delta: rel('больше обычного', 'меньше обычного'), up, better };
    case 'stress':
      return { label: 'Стресс', value: `${f.value}/5`, delta: rel('выше обычного', 'ниже обычного'), up, better };
    default:
      return { label: METRIC_LABEL[f.metric], value: `${f.value}/5`, delta: rel('выше обычного', 'ниже обычного'), up, better };
  }
}

/** Одна фраза-объяснение простым языком. */
export function explain(factors: readonly Factor[]): string {
  const worse = factors.filter((f) => f.impact <= -0.5).map((f) => METRIC_LABEL[f.metric].toLowerCase());
  const better = factors.filter((f) => f.impact >= 0.5).map((f) => METRIC_LABEL[f.metric].toLowerCase());
  const list = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} и ${a[a.length - 1]}`);
  if (worse.length && better.length) return `Хуже вашей нормы: ${list(worse.slice(0, 3))}; лучше: ${list(better.slice(0, 2))}.`;
  if (worse.length) return `Готовность снижают: ${list(worse.slice(0, 3))} — хуже вашей обычной нормы.`;
  if (better.length) return `Показатели на уровне нормы или лучше: ${list(better.slice(0, 3))}.`;
  return 'Существенных отклонений от вашей нормы нет.';
}
