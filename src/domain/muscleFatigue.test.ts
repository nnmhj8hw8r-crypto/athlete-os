import { describe, expect, it } from 'vitest';
import { effortFactor, muscleLoads, recoveringMuscles, statusOf } from './muscleFatigue.ts';
import type { Workout } from './schemas.ts';
import { sessionLoad, trainingLoadSeries } from './trainingLoad.ts';

const lookup = (id: string) =>
  id === 'row' ? { muscles: ['lats' as const], musclesSecondary: ['biceps' as const] } : id === 'curl' ? { muscles: ['biceps' as const], musclesSecondary: [] } : undefined;

const w = (startAt: string, ex: Workout['exercises'], p: Partial<Workout> = {}): Workout => ({
  id: startAt,
  startAt,
  type: 'gym',
  title: 'Т',
  exercises: ex,
  createdAt: startAt,
  updatedAt: startAt,
  ...p,
});

const now = new Date('2026-10-22T12:00:00.000Z');
const hours = { small: 48, large: 72 };

describe('усталость мышц', () => {
  it('близость к отказу увеличивает вклад', () => {
    expect(effortFactor(10)).toBe(1);
    expect(effortFactor(6)).toBe(0.45);
    expect(effortFactor(undefined)).toBe(0.65);
    expect(statusOf(0.5)).toBe('fresh');
    expect(statusOf(2)).toBe('recovering');
    expect(statusOf(5)).toBe('fatigued');
  });

  it('только что тренированная группа утомлена, вспомогательная — с половинным вкладом; спад во времени', () => {
    const sets = Array.from({ length: 5 }, () => ({ reps: 8, weightKg: 60, rpe: 9 }));
    const fresh = muscleLoads([w('2026-10-22T11:00:00.000Z', [{ exerciseId: 'row', name: 'Тяга', sets }])], lookup, now, hours);
    expect(fresh.lats.status).toBe('fatigued');
    expect(fresh.biceps.fatigue).toBeCloseTo(fresh.lats.fatigue / 2 * (1 - 1 / 48) / (1 - 1 / 72), 1);
    expect(fresh.lats.weeklySets).toBe(5);
    expect(fresh.biceps.weeklySets).toBe(2.5);
    expect(recoveringMuscles(fresh)[0]).toBe('lats');

    const old = muscleLoads([w('2026-10-19T08:00:00.000Z', [{ exerciseId: 'row', name: 'Тяга', sets }])], lookup, now, hours);
    expect(old.lats.status).toBe('fresh');
    expect(old.lats.fatigue).toBe(0);
    expect(old.lats.lastTrainedAt).toBe('2026-10-19T08:00:00.000Z');
  });

  it('пустые подходы и неизвестные упражнения не считаются', () => {
    const r = muscleLoads([w('2026-10-22T11:00:00.000Z', [{ exerciseId: 'row', name: 'Тяга', sets: [{}] }, { exerciseId: 'x', name: 'X', sets: [{ reps: 5 }] }])], lookup, now, hours);
    expect(r.lats.fatigue).toBe(0);
  });
});

describe('нагрузка, усталость и форма', () => {
  it('нагрузка = минуты × тяжесть; без одного из полей не считается', () => {
    expect(sessionLoad({ durationMin: 60, rpe: 7 })).toBe(420);
    expect(sessionLoad({ durationMin: 60 })).toBeNull();
  });

  it('усталость растёт быстрее формы после блока тренировок', () => {
    const list = Array.from({ length: 5 }, (_, i) => w(`2026-10-${String(15 + i).padStart(2, '0')}T15:00:00.000Z`, [], { durationMin: 90, rpe: 8 }));
    const s = trainingLoadSeries(list, '2026-10-15', '2026-10-22');
    const last = s[s.length - 1]!;
    expect(last.fatigue).toBeGreaterThan(last.fitness);
    expect(last.form).toBeLessThan(0);
    expect(s).toHaveLength(8);
  });
});
