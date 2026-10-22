// Масса тела: сводка для «Сезона» и главного экрана. Только разница своих записей, без оценок.
import type { BodyWeight } from './schemas.ts';

export interface WeightSummary {
  last: BodyWeight;
  /** Изменение к записи примерно недельной давности (не позже чем 6,5 дня назад), кг. */
  change7: number | null;
  /** Сколько осталось до цели (последний − цель), кг; null — цели нет. */
  toTarget: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function weightSummary(weights: readonly BodyWeight[], targetKg?: number, now: Date = new Date()): WeightSummary | null {
  const sorted = [...weights].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const last = sorted[sorted.length - 1];
  if (!last) return null;
  const weekAgo = [...sorted].reverse().find((w) => Date.parse(w.measuredAt) <= now.getTime() - 6.5 * 86_400_000);
  return {
    last,
    change7: weekAgo ? round1(last.weightKg - weekAgo.weightKg) : null,
    toTarget: targetKg !== undefined ? round1(last.weightKg - targetKg) : null,
  };
}

/** Записи за последние N дней (по времени измерения), по возрастанию; days = null — все. */
export function weightsInPeriod(weights: readonly BodyWeight[], days: number | null, now: Date = new Date()): BodyWeight[] {
  const from = days === null ? -Infinity : now.getTime() - days * 86_400_000;
  return [...weights].filter((w) => Date.parse(w.measuredAt) >= from).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
}
