// Тренировочный журнал: подписи и простая аналитика рабочих весов.
import type { Workout, WorkoutTemplate, WorkoutType } from './schemas.ts';
import { toDateKey } from './time.ts';

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  judo: 'Дзюдо',
  sambo: 'Самбо',
  gym: 'Тренажёрный зал',
  other: 'Другое',
};

export function workoutSetCount(w: Pick<Workout, 'exercises'>): number {
  return w.exercises.reduce((s, e) => s + e.sets.length, 0);
}

export interface ExerciseProgressPoint {
  workoutId: string;
  date: string;
  startAt: string;
  sets: number;
  /** Максимальный вес в подходах, где вес указан. */
  maxWeightKg: number | null;
  totalReps: number;
  /** Тоннаж: сумма повторений × вес по подходам, где указано и то и другое. */
  volumeKg: number;
}

/** История одного упражнения по тренировкам в хронологическом порядке. */
export function exerciseProgress(workouts: readonly Workout[], exerciseId: string): ExerciseProgressPoint[] {
  const points: ExerciseProgressPoint[] = [];
  for (const w of workouts) {
    const items = w.exercises.filter((e) => e.exerciseId === exerciseId);
    if (items.length === 0) continue;
    const sets = items.flatMap((e) => e.sets);
    const weights = sets.flatMap((s) => (s.weightKg === undefined ? [] : [s.weightKg]));
    points.push({
      workoutId: w.id,
      date: toDateKey(w.startAt),
      startAt: w.startAt,
      sets: sets.length,
      maxWeightKg: weights.length ? Math.max(...weights) : null,
      totalReps: sets.reduce((s, x) => s + (x.reps ?? 0), 0),
      volumeKg: Math.round(sets.reduce((s, x) => s + (x.reps ?? 0) * (x.weightKg ?? 0), 0) * 100) / 100,
    });
  }
  return points.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Шаблон из выполненной тренировки: упражнения и число подходов, без результатов. */
export function templateFromWorkout(
  w: Workout,
  name: string,
): Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    type: w.type,
    title: w.title,
    notes: undefined,
    exercises: w.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, plannedSets: e.sets.length })),
  };
}

/** Черновик тренировки по шаблону: упражнения с пустыми подходами в нужном количестве. */
export function workoutDraftFromTemplate(t: WorkoutTemplate): Pick<Workout, 'type' | 'title' | 'exercises' | 'templateId'> {
  return {
    type: t.type,
    title: t.title ?? t.name,
    templateId: t.id,
    exercises: t.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      notes: e.notes,
      sets: Array.from({ length: e.plannedSets ?? 1 }, () => ({})),
    })),
  };
}
