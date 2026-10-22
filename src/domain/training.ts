// Тренировочный журнал и программы: подписи, планы упражнений, история и простая аналитика.
import type {
  ExerciseGroup,
  ExerciseMetric,
  Program,
  ProgramItem,
  ScheduleSlot,
  Workout,
  WorkoutExercise,
  WorkoutFormat,
  WorkoutSet,
  WorkoutTemplate,
  WorkoutType,
} from './schemas.ts';
import { plural, toDateKey } from './time.ts';

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  judo: 'Дзюдо',
  sambo: 'Самбо',
  gym: 'Тренажёрный зал',
  other: 'Другое',
};

export const WORKOUT_FORMAT_LABEL: Record<WorkoutFormat, string> = {
  exercises: 'По упражнениям',
  mat: 'Тренировка на ковре',
  fight: 'День борьбы',
};

export const EXERCISE_GROUP_LABEL: Record<ExerciseGroup, string> = {
  warmup: 'Разминка',
  cardio: 'Кардио',
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  forearms: 'Предплечья и хват',
  legs: 'Ноги',
  glutes: 'Ягодицы',
  abs: 'Пресс',
  fullbody: 'Всё тело',
  wrestling: 'Борьба',
  other: 'Другое',
};

export const EXERCISE_METRIC_LABEL: Record<ExerciseMetric, string> = {
  weight_reps: 'Вес × повторения',
  reps: 'Повторения',
  time: 'Время',
  distance_time: 'Расстояние и время',
  rounds: 'Встречи по времени',
  check: 'Отметка «сделано»',
};

export const SCHEDULE_SLOT_LABEL: Record<ScheduleSlot, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
};

export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

/** «Пн, Ср, Пт» по номерам дней 1–7. */
export function weekdaysLabel(days: readonly number[] | undefined): string {
  if (!days?.length) return '';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT[d - 1] ?? '')
    .filter(Boolean)
    .join(', ');
}

/** Разбор времени: «90» → 90 с, «3:25» → 205 с, «1:02:00» → 3720 с. Пусто или ошибка → undefined. */
export function parseClock(value: string): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(v)) return undefined;
  const parts = v.split(':').map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return undefined;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** 205 → «3:25», 3720 → «1:02:00». */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}

/** Длительность словами: 600 → «10 минут», 90 → «1:30», 45 → «45 с». */
export function formatDurationShort(sec: number): string {
  if (sec % 60 === 0 && sec >= 60) {
    const m = sec / 60;
    return `${m} ${plural(m, ['минута', 'минуты', 'минут'])}`;
  }
  return sec < 60 ? `${sec} с` : formatClock(sec);
}

const r2 = (n: number) => (Math.round(n * 100) / 100).toLocaleString('ru-RU');

/** Текст плана пункта программы: «2 × 8–12 повторений», «10 минут», «6 встреч × 3 минуты». */
export function formatPlanItem(item: ProgramItem): string {
  const metric = item.metric ?? 'weight_reps';
  const n = item.sets;
  const range = item.repsMin !== undefined && item.repsMax !== undefined && item.repsMax !== item.repsMin;
  const single = item.repsMin ?? item.repsMax;
  const setsWord = `${n} ${plural(n, ['подход', 'подхода', 'подходов'])}`;
  switch (metric) {
    case 'weight_reps':
    case 'reps': {
      const w = item.weightKg !== undefined ? ` · ${r2(item.weightKg)} кг` : '';
      if (range) return `${n} × ${item.repsMin}–${item.repsMax} повторений${w}`;
      if (single !== undefined) return `${n} × ${single} ${plural(single, ['повторение', 'повторения', 'повторений'])}${w}`;
      return `${setsWord}${w}`;
    }
    case 'time':
      if (item.durationSec === undefined) return setsWord;
      return n > 1 ? `${n} × ${formatDurationShort(item.durationSec)}` : formatDurationShort(item.durationSec);
    case 'distance_time': {
      const parts = [
        item.distanceKm !== undefined ? `${r2(item.distanceKm)} км` : '',
        item.durationSec !== undefined ? formatDurationShort(item.durationSec) : '',
      ].filter(Boolean);
      const body = parts.join(' · ') || 'по самочувствию';
      return n > 1 ? `${n} × ${body}` : body;
    }
    case 'rounds': {
      const word = `${n} ${plural(n, ['встреча', 'встречи', 'встреч'])}`;
      return item.durationSec !== undefined ? `${word} × ${formatDurationShort(item.durationSec)}` : word;
    }
    case 'check':
      return 'выполнить';
  }
}

/** Результат подхода коротко: «80 кг × 10», «12 повт.», «3:00», «5 км · 30:00». */
export function formatSet(set: WorkoutSet, metric: ExerciseMetric = 'weight_reps'): string {
  const parts: string[] = [];
  if (metric === 'weight_reps' || metric === 'reps') {
    if (set.weightKg !== undefined && set.reps !== undefined) parts.push(`${r2(set.weightKg)} кг × ${set.reps}`);
    else if (set.reps !== undefined) parts.push(`${set.reps} повт.`);
    else if (set.weightKg !== undefined) parts.push(`${r2(set.weightKg)} кг`);
  }
  if (metric === 'distance_time' && set.distanceKm !== undefined) parts.push(`${r2(set.distanceKm)} км`);
  if ((metric === 'time' || metric === 'distance_time' || metric === 'rounds') && set.durationSec !== undefined) parts.push(formatClock(set.durationSec));
  if (metric === 'check') parts.push(set.done ? 'сделано' : 'не отмечено');
  return parts.join(' · ') || '—';
}

export function workoutSetCount(w: Pick<Workout, 'exercises'>): number {
  return w.exercises.reduce((s, e) => s + e.sets.length, 0);
}

/** Подход считается заполненным, если есть хоть одно значение или отметка «сделано». */
export function isSetFilled(s: WorkoutSet): boolean {
  return s.done === true || s.reps !== undefined || s.weightKg !== undefined || s.durationSec !== undefined || s.distanceKm !== undefined;
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
  /** Суммарное время подходов, с (упражнения на время, кардио, встречи). */
  totalSec: number;
  /** Суммарное расстояние, км. */
  totalKm: number;
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
      totalSec: sets.reduce((s, x) => s + (x.durationSec ?? 0), 0),
      totalKm: Math.round(sets.reduce((s, x) => s + (x.distanceKm ?? 0), 0) * 100) / 100,
    });
  }
  return points.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export interface ExerciseHistoryEntry {
  workoutId: string;
  startAt: string;
  title: string;
  metric: ExerciseMetric;
  sets: WorkoutSet[];
}

/** Прошлые выполнения упражнения, новые сверху; excludeWorkoutId — текущая тренировка. */
export function exerciseHistory(workouts: readonly Workout[], exerciseId: string, excludeWorkoutId?: string): ExerciseHistoryEntry[] {
  return workouts
    .filter((w) => w.id !== excludeWorkoutId)
    .flatMap((w) =>
      w.exercises
        .filter((e) => e.exerciseId === exerciseId)
        .map((e) => ({ workoutId: w.id, startAt: w.startAt, title: w.title, metric: e.metric ?? 'weight_reps', sets: e.sets.filter(isSetFilled) })),
    )
    .filter((e) => e.sets.length > 0)
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
}

/** Последний результат упражнения одной строкой (для каталога и подсказки «в прошлый раз»). */
export function lastResultText(workouts: readonly Workout[], exerciseId: string, excludeWorkoutId?: string): string | null {
  const last = exerciseHistory(workouts, exerciseId, excludeWorkoutId)[0];
  if (!last) return null;
  return last.sets.map((s) => formatSet(s, last.metric)).join(', ');
}

/** Подходы по плану пункта программы: целевые значения подставлены, отметки «сделано» нет. */
export function setsFromPlan(item: ProgramItem): WorkoutSet[] {
  const metric = item.metric ?? 'weight_reps';
  return Array.from({ length: item.sets }, () => {
    const s: WorkoutSet = {};
    if (metric === 'weight_reps' || metric === 'reps') {
      const reps = item.repsMax ?? item.repsMin;
      if (reps !== undefined) s.reps = reps;
    }
    if (metric === 'weight_reps' && item.weightKg !== undefined) s.weightKg = item.weightKg;
    if ((metric === 'time' || metric === 'distance_time' || metric === 'rounds') && item.durationSec !== undefined) s.durationSec = item.durationSec;
    if (metric === 'distance_time' && item.distanceKm !== undefined) s.distanceKm = item.distanceKm;
    if (item.restSec !== undefined) s.restSec = item.restSec;
    return s;
  });
}

export type WorkoutDraft = Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>;

/** Новая тренировка по программе: упражнения с подходами по плану. */
export function workoutFromProgram(p: Program, startAt: string, scheduleId?: string): WorkoutDraft {
  return {
    startAt,
    type: p.type,
    format: p.format,
    title: p.name,
    programId: p.id,
    scheduleId,
    exercises: p.items.map((it) => ({ exerciseId: it.exerciseId, name: it.name, metric: it.metric, notes: it.notes, sets: setsFromPlan(it) })),
  };
}

/** Пустая тренировка без программы. */
export function emptyWorkout(startAt: string, format: WorkoutFormat = 'exercises'): WorkoutDraft {
  return {
    startAt,
    type: format === 'exercises' ? 'gym' : 'judo',
    format,
    title: WORKOUT_FORMAT_LABEL[format],
    exercises: [],
  };
}

/**
 * Перед сохранением: убрать невыполненные подходы и упражнения без подходов.
 * onlyDone — сохранять только подходы с галочкой (подходы по плану заранее заполнены целевыми
 * значениями, поэтому «заполнен» ещё не значит «выполнен»); иначе — все подходы с любым значением.
 */
export function cleanupWorkout<T extends Pick<Workout, 'exercises'>>(w: T, onlyDone = false): T {
  const exercises: WorkoutExercise[] = w.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => (onlyDone ? s.done === true : isSetFilled(s))) }))
    .filter((e) => e.sets.length > 0);
  return { ...w, exercises };
}

/** Тренировка из журнала для правки: записанные подходы считаются выполненными (галочки стоят). */
export function markRecordedDone<T extends Pick<Workout, 'exercises'>>(w: T): T {
  return { ...w, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => (isSetFilled(s) ? { ...s, done: true } : s)) })) };
}

/** Программа из шаблона до v0.5 (миграция базы и резервных копий): тот же id и упражнения. */
export function programFromTemplate(t: WorkoutTemplate): Program {
  return {
    id: t.id,
    name: t.name.slice(0, 100),
    type: t.type,
    format: t.type === 'judo' || t.type === 'sambo' ? 'mat' : 'exercises',
    icon: 'auto',
    color: 'blue',
    notes: t.notes ?? t.title,
    items: t.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: Math.max(1, Math.min(50, e.plannedSets ?? 1)), notes: e.notes })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/** Пункты программы из выполненной тренировки («Сохранить как программу»). */
export function programItemsFromWorkout(w: Pick<Workout, 'exercises'>): ProgramItem[] {
  return w.exercises.map((e) => {
    const metric = e.metric ?? 'weight_reps';
    const first = e.sets[0] ?? {};
    const reps = e.sets.flatMap((s) => (s.reps === undefined ? [] : [s.reps]));
    const item: ProgramItem = { exerciseId: e.exerciseId, name: e.name, metric, sets: Math.max(1, Math.min(50, e.sets.length)) };
    if (reps.length) {
      item.repsMin = Math.min(...reps);
      item.repsMax = Math.max(...reps);
    }
    if (metric === 'weight_reps' && first.weightKg !== undefined) item.weightKg = first.weightKg;
    if (first.durationSec !== undefined) item.durationSec = first.durationSec;
    if (first.distanceKm !== undefined) item.distanceKm = first.distanceKm;
    if (first.restSec !== undefined) item.restSec = first.restSec;
    if (e.notes) item.notes = e.notes;
    return item;
  });
}

/** Шаблон из выполненной тренировки (формат до v0.5, нужен для старых тестов и копий). */
export function templateFromWorkout(w: Workout, name: string): Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    type: w.type,
    title: w.title,
    notes: undefined,
    exercises: w.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, plannedSets: e.sets.length })),
  };
}

/** Черновик тренировки по шаблону до v0.5. */
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
