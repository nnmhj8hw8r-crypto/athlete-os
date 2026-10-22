// Сон и восстановление. Здесь только то, что честно следует из введённых данных:
// промежуток между отметками и оценка сна по самооценкам пользователя.
// Фазы и циклы сна по двум отметкам времени не вычисляются.
import type { SleepEntry } from './schemas.ts';
import { addDays, toDateKey } from './time.ts';

/** Минуты между отходом ко сну и пробуждением (время в постели) или null при некорректных данных. */
export function timeInBedMinutes(bedtime: string, wakeTime: string): number | null {
  const a = Date.parse(bedtime);
  const b = Date.parse(wakeTime);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const minutes = Math.round((b - a) / 60_000);
  if (minutes <= 0 || minutes > 24 * 60) return null;
  return minutes;
}

/**
 * Оценка времени сна: время в постели минус засыпание и ночные пробуждения.
 * Возвращается только если пользователь ввёл хотя бы одну из этих оценок —
 * иначе это был бы тот же промежуток, выданный за фактический сон.
 */
export function estimatedSleepMinutes(
  entry: Pick<SleepEntry, 'bedtime' | 'wakeTime' | 'sleepLatencyMin' | 'wakeDuringNightMin'>,
): number | null {
  const inBed = timeInBedMinutes(entry.bedtime, entry.wakeTime);
  if (inBed === null) return null;
  if (entry.sleepLatencyMin === undefined && entry.wakeDuringNightMin === undefined) return null;
  return Math.max(0, inBed - (entry.sleepLatencyMin ?? 0) - (entry.wakeDuringNightMin ?? 0));
}

export const RATING_FIELDS = ['wellbeing', 'fatigue', 'soreness', 'motivation'] as const;
export type RatingField = (typeof RATING_FIELDS)[number];

export const RATING_META: Record<RatingField, { label: string; low: string; high: string }> = {
  wellbeing: { label: 'Утреннее самочувствие', low: 'плохое', high: 'отличное' },
  fatigue: { label: 'Усталость', low: 'нет', high: 'сильная' },
  soreness: { label: 'Болезненность / забитость мышц', low: 'нет', high: 'сильная' },
  motivation: { label: 'Желание тренироваться', low: 'нет', high: 'очень высокое' },
};

export interface RecoveryAverages {
  count: number;
  timeInBedMin: number | null;
  wellbeing: number | null;
  fatigue: number | null;
  soreness: number | null;
  motivation: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/** Средние значения по набору записей — описательная статистика, а не диагноз. */
export function recoveryAverages(entries: readonly SleepEntry[]): RecoveryAverages {
  const pick = (f: RatingField) =>
    mean(entries.map((e) => e[f]).filter((v): v is number => v !== undefined));
  return {
    count: entries.length,
    timeInBedMin: mean(entries.flatMap((e) => timeInBedMinutes(e.bedtime, e.wakeTime) ?? [])),
    wellbeing: pick('wellbeing'),
    fatigue: pick('fatigue'),
    soreness: pick('soreness'),
    motivation: pick('motivation'),
  };
}

export interface SleepDay {
  /** День пробуждения по Москве, YYYY-MM-DD. */
  date: string;
  /** Время в постели, мин; null — записи за день нет. */
  inBedMin: number | null;
  wellbeing: number | null;
  fatigue: number | null;
  soreness: number | null;
  motivation: number | null;
}

/**
 * Ряд по дням за период [from, to] (включительно) — для графиков. Если за день несколько записей
 * (дневной сон), время в постели суммируется, а оценки берутся из последней записи дня.
 */
export function sleepDays(entries: readonly SleepEntry[], from: string, to: string): SleepDay[] {
  const byDay = new Map<string, SleepEntry[]>();
  for (const e of entries) {
    const d = toDateKey(e.wakeTime);
    if (d < from || d > to) continue;
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const out: SleepDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list = (byDay.get(d) ?? []).sort((a, b) => a.wakeTime.localeCompare(b.wakeTime));
    const last = list[list.length - 1];
    const minutes = list.flatMap((e) => timeInBedMinutes(e.bedtime, e.wakeTime) ?? []);
    out.push({
      date: d,
      inBedMin: minutes.length ? minutes.reduce((a, b) => a + b, 0) : null,
      wellbeing: last?.wellbeing ?? null,
      fatigue: last?.fatigue ?? null,
      soreness: last?.soreness ?? null,
      motivation: last?.motivation ?? null,
    });
  }
  return out;
}
