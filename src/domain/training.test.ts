import { describe, expect, it } from 'vitest';
import type { Program, ProgramItem, Workout, WorkoutTemplate } from './schemas.ts';
import {
  cleanupWorkout,
  exerciseHistory,
  exerciseProgress,
  formatClock,
  formatPlanItem,
  formatSet,
  lastResultText,
  markRecordedDone,
  parseClock,
  programFromTemplate,
  programItemsFromWorkout,
  templateFromWorkout,
  weekdaysLabel,
  workoutDraftFromTemplate,
  workoutFromProgram,
  workoutSetCount,
} from './training.ts';

const w = (id: string, startAt: string, sets: Workout['exercises'][number]['sets']): Workout => ({
  id,
  startAt,
  type: 'gym',
  title: 'Сила',
  exercises: [{ exerciseId: 'squat', name: 'Присед', sets }, { exerciseId: 'other', name: 'Другое', sets: [{ reps: 10 }] }],
  createdAt: startAt,
  updatedAt: startAt,
});

describe('exerciseProgress', () => {
  it('строит историю упражнения в хронологическом порядке', () => {
    const list = [
      w('b', '2026-10-14T15:00:00.000Z', [{ reps: 5, weightKg: 105 }, { reps: 5, weightKg: 110 }, { reps: 3 }]),
      w('a', '2026-10-07T15:00:00.000Z', [{ reps: 5, weightKg: 100 }]),
    ];
    expect(exerciseProgress(list, 'squat')).toEqual([
      { workoutId: 'a', date: '2026-10-07', startAt: '2026-10-07T15:00:00.000Z', sets: 1, maxWeightKg: 100, totalReps: 5, volumeKg: 500, totalSec: 0, totalKm: 0 },
      { workoutId: 'b', date: '2026-10-14', startAt: '2026-10-14T15:00:00.000Z', sets: 3, maxWeightKg: 110, totalReps: 13, volumeKg: 1075, totalSec: 0, totalKm: 0 },
    ]);
  });

  it('maxWeightKg = null, если вес нигде не указан', () => {
    expect(exerciseProgress([w('a', '2026-10-07T15:00:00.000Z', [{ reps: 10 }])], 'squat')[0]?.maxWeightKg).toBeNull();
  });

  it('пропускает тренировки без упражнения', () => {
    expect(exerciseProgress([w('a', '2026-10-07T15:00:00.000Z', [])], 'missing')).toEqual([]);
  });
});

describe('шаблоны', () => {
  it('создаёт шаблон и тренировку из него без результатов', () => {
    const workout = w('a', '2026-10-07T15:00:00.000Z', [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }]);
    expect(workoutSetCount(workout)).toBe(3);
    const t = { ...templateFromWorkout(workout, 'Ноги'), id: 't1', createdAt: '', updatedAt: '' };
    expect(t.exercises[0]).toEqual({ exerciseId: 'squat', name: 'Присед', plannedSets: 2 });
    const draft = workoutDraftFromTemplate(t);
    expect(draft.templateId).toBe('t1');
    expect(draft.exercises[0]?.sets).toEqual([{}, {}]);
  });
});

describe('программы (v0.5)', () => {
  const item = (patch: Partial<ProgramItem>): ProgramItem => ({ exerciseId: 'x', name: 'X', sets: 2, ...patch });

  it('formatPlanItem: подписи как в карточке программы', () => {
    expect(formatPlanItem(item({ metric: 'weight_reps', repsMin: 8, repsMax: 12 }))).toBe('2 × 8–12 повторений');
    expect(formatPlanItem(item({ metric: 'reps', sets: 3, repsMin: 10 }))).toBe('3 × 10 повторений');
    expect(formatPlanItem(item({ metric: 'weight_reps', sets: 1, repsMin: 1, weightKg: 100 }))).toBe('1 × 1 повторение · 100 кг');
    expect(formatPlanItem(item({ metric: 'distance_time', sets: 1, durationSec: 600 }))).toBe('10 минут');
    expect(formatPlanItem(item({ metric: 'rounds', sets: 6, durationSec: 180 }))).toBe('6 встреч × 3 минуты');
    expect(formatPlanItem(item({ metric: 'rounds', sets: 2 }))).toBe('2 встречи');
    expect(formatPlanItem(item({ metric: 'time', sets: 3, durationSec: 45 }))).toBe('3 × 45 с');
    expect(formatPlanItem(item({ metric: 'check', sets: 1 }))).toBe('выполнить');
  });

  it('parseClock и formatClock', () => {
    expect(parseClock('90')).toBe(90);
    expect(parseClock('3:25')).toBe(205);
    expect(parseClock('1:02:00')).toBe(3720);
    expect(parseClock('3:75')).toBeUndefined();
    expect(parseClock('abc')).toBeUndefined();
    expect(parseClock('')).toBeUndefined();
    expect(formatClock(205)).toBe('3:25');
    expect(formatClock(3720)).toBe('1:02:00');
  });

  it('тренировка по программе: подходы по плану, без отметок «сделано»', () => {
    const p: Program = {
      id: 'p1', name: 'Борьба', type: 'judo', format: 'fight', icon: 'auto', color: 'red', createdAt: '', updatedAt: '',
      items: [
        item({ exerciseId: 'lib:randori-standing', metric: 'rounds', sets: 3, durationSec: 180, restSec: 60 }),
        item({ exerciseId: 'lib:bench-press', metric: 'weight_reps', sets: 2, repsMin: 8, repsMax: 12, weightKg: 60 }),
      ],
    };
    const d = workoutFromProgram(p, '2026-10-22T15:00:00.000Z', 's1');
    expect(d).toMatchObject({ title: 'Борьба', format: 'fight', programId: 'p1', scheduleId: 's1' });
    expect(d.exercises[0]?.sets).toEqual([{ durationSec: 180, restSec: 60 }, { durationSec: 180, restSec: 60 }, { durationSec: 180, restSec: 60 }]);
    expect(d.exercises[1]?.sets[0]).toEqual({ reps: 12, weightKg: 60 });
  });

  it('cleanupWorkout убирает пустые подходы и упражнения', () => {
    const r = cleanupWorkout({
      exercises: [
        { exerciseId: 'a', name: 'A', sets: [{}, { reps: 5 }, { done: true }] },
        { exerciseId: 'b', name: 'B', sets: [{}, { restSec: 60 }] },
      ],
    });
    expect(r.exercises).toEqual([{ exerciseId: 'a', name: 'A', sets: [{ reps: 5 }, { done: true }] }]);
  });

  it('cleanupWorkout(onlyDone): подходы по плану без галочки не сохраняются', () => {
    const w = {
      exercises: [
        { exerciseId: 'r', name: 'Встречи', sets: [{ durationSec: 180, done: true }, { durationSec: 180 }] },
        { exerciseId: 'p', name: 'Партер', sets: [{ durationSec: 180 }] },
      ],
    };
    expect(cleanupWorkout(w, true).exercises).toEqual([{ exerciseId: 'r', name: 'Встречи', sets: [{ durationSec: 180, done: true }] }]);
    expect(cleanupWorkout(w).exercises).toHaveLength(2);
  });

  it('markRecordedDone: при правке записанные подходы отмечены', () => {
    const r = markRecordedDone({ exercises: [{ exerciseId: 'a', name: 'A', sets: [{ reps: 5 }, {}] }] });
    expect(r.exercises[0]?.sets).toEqual([{ reps: 5, done: true }, {}]);
  });

  it('история упражнения: новые сверху, без текущей тренировки и пустых подходов', () => {
    const list = [
      w('a', '2026-10-07T15:00:00.000Z', [{ reps: 5, weightKg: 100 }]),
      w('b', '2026-10-14T15:00:00.000Z', [{ reps: 5, weightKg: 110 }, {}]),
      w('c', '2026-10-21T15:00:00.000Z', [{ reps: 1, weightKg: 120 }]),
    ];
    const h = exerciseHistory(list, 'squat', 'c');
    expect(h.map((x) => x.workoutId)).toEqual(['b', 'a']);
    expect(h[0]?.sets).toEqual([{ reps: 5, weightKg: 110 }]);
    expect(lastResultText(list, 'squat', 'c')).toBe('110 кг × 5');
    expect(lastResultText(list, 'missing')).toBeNull();
  });

  it('formatSet по типу измерения', () => {
    expect(formatSet({ reps: 10, weightKg: 62.5 })).toBe('62,5 кг × 10');
    expect(formatSet({ reps: 12 }, 'reps')).toBe('12 повт.');
    expect(formatSet({ distanceKm: 5, durationSec: 1800 }, 'distance_time')).toBe('5 км · 30:00');
    expect(formatSet({ durationSec: 180 }, 'rounds')).toBe('3:00');
    expect(formatSet({ done: true }, 'check')).toBe('сделано');
  });

  it('программа из выполненной тренировки и из старого шаблона', () => {
    const items = programItemsFromWorkout(w('a', '2026-10-07T15:00:00.000Z', [{ reps: 8, weightKg: 100 }, { reps: 6, weightKg: 100 }]));
    expect(items[0]).toEqual({ exerciseId: 'squat', name: 'Присед', metric: 'weight_reps', sets: 2, repsMin: 6, repsMax: 8, weightKg: 100 });
    const t: WorkoutTemplate = {
      id: 't1', name: 'Ковёр', type: 'judo', title: 'Техника', createdAt: 'c', updatedAt: 'u',
      exercises: [{ exerciseId: 'e1', name: 'Броски', plannedSets: 0 }],
    };
    expect(programFromTemplate(t)).toMatchObject({ id: 't1', name: 'Ковёр', format: 'mat', notes: 'Техника', items: [{ exerciseId: 'e1', sets: 1 }] });
  });

  it('weekdaysLabel', () => {
    expect(weekdaysLabel([5, 1, 3])).toBe('Пн, Ср, Пт');
    expect(weekdaysLabel(undefined)).toBe('');
  });
});
