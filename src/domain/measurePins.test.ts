import { describe, expect, it } from 'vitest';
import type { Workout } from './schemas.ts';
import { journalExercises, movePin, normalizePins, togglePin } from './measurePins.ts';

describe('мои замеры', () => {
  it('кружок добавляет и убирает, стрелки меняют порядок', () => {
    expect(togglePin(['a'], 'b')).toEqual(['a', 'b']);
    expect(togglePin(['a', 'b'], 'a')).toEqual(['b']);
    expect(movePin(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(movePin(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(normalizePins(['a', 'a', 3, ''])).toEqual(['a']);
  });

  it('упражнения из журнала — с лучшим весом', () => {
    const w = (id: string, startAt: string, weightKg: number): Workout =>
      ({
        id,
        startAt,
        title: 'Зал',
        type: 'strength',
        createdAt: startAt,
        updatedAt: startAt,
        exercises: [{ exerciseId: 'lib:bench', name: 'Жим лёжа', metric: 'weight_reps', sets: [{ weightKg, reps: 5 }] }],
      }) as unknown as Workout;
    const list = journalExercises([w('1', '2026-10-01T10:00:00.000Z', 80), w('2', '2026-10-08T10:00:00.000Z', 82.5)]);
    expect(list).toEqual([{ id: 'lib:bench', name: 'Жим лёжа', best: '82,5 кг', lastDate: '2026-10-08' }]);
  });
});
