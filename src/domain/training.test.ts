import { describe, expect, it } from 'vitest';
import type { Workout } from './schemas.ts';
import { exerciseProgress, templateFromWorkout, workoutDraftFromTemplate, workoutSetCount } from './training.ts';

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
      { workoutId: 'a', date: '2026-10-07', startAt: '2026-10-07T15:00:00.000Z', sets: 1, maxWeightKg: 100, totalReps: 5, volumeKg: 500 },
      { workoutId: 'b', date: '2026-10-14', startAt: '2026-10-14T15:00:00.000Z', sets: 3, maxWeightKg: 110, totalReps: 13, volumeKg: 1075 },
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
