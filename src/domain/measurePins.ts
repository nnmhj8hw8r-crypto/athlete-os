// «Мои замеры» (v0.10): пользователь собирает свой список из тестов и упражнений своих тренировок —
// кружок справа добавляет или убирает, порядок меняется стрелками. Хранится в settings.measurePins
// списком id: тест — его id, упражнение из журнала — 'ex:' + id упражнения.
import { exerciseProgress } from './training.ts';
import type { Workout } from './schemas.ts';

export const MEASURE_PINS_KEY = 'measurePins';
export const EX_PREFIX = 'ex:';

export function normalizePins(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 200))].slice(0, 50) : [];
}

export function togglePin(pins: readonly string[], id: string): string[] {
  return pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id];
}

export function movePin(pins: readonly string[], id: string, dir: -1 | 1): string[] {
  const i = pins.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pins.length) return [...pins];
  const next = [...pins];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export interface JournalExercise {
  id: string;
  name: string;
  /** Лучший результат словами: «82,5 кг», «15 повт.», «—». */
  best: string;
  lastDate: string | null;
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

/** Упражнения, которые встречались в журнале, — с лучшим результатом (максимальный вес или повторения за тренировку). */
export function journalExercises(workouts: readonly Workout[]): JournalExercise[] {
  const names = new Map<string, string>();
  for (const w of workouts) for (const e of w.exercises) if (!names.has(e.exerciseId)) names.set(e.exerciseId, e.name);
  return [...names].map(([id, name]) => {
    const pts = exerciseProgress(workouts, id);
    const weights = pts.flatMap((p) => (p.maxWeightKg === null ? [] : [p.maxWeightKg]));
    const reps = Math.max(0, ...pts.map((p) => p.totalReps));
    const best = weights.length ? `${r1(Math.max(...weights))} кг` : reps > 0 ? `${reps} повт.` : '—';
    return { id, name, best, lastDate: pts.at(-1)?.date ?? null };
  }).sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || a.name.localeCompare(b.name, 'ru'));
}
