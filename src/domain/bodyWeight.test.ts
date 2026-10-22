import { describe, expect, it } from 'vitest';
import { weightSummary, weightsInPeriod } from './bodyWeight.ts';
import type { BodyWeight } from './schemas.ts';

const w = (id: string, at: string, kg: number): BodyWeight => ({ id, measuredAt: at, weightKg: kg, createdAt: at, updatedAt: at });
const now = new Date('2026-10-22T08:00:00.000Z');
const list = [w('a', '2026-10-10T05:00:00.000Z', 76.4), w('b', '2026-10-15T05:00:00.000Z', 75.9), w('c', '2026-10-22T05:00:00.000Z', 75.1)];

describe('масса тела', () => {
  it('сводка: последний вес, изменение за неделю, до цели', () => {
    expect(weightSummary(list, 73, now)).toEqual({ last: list[2], change7: -0.8, toTarget: 2.1 });
    expect(weightSummary([list[2]!], undefined, now)).toEqual({ last: list[2], change7: null, toTarget: null });
    expect(weightSummary([], 73, now)).toBeNull();
  });

  it('записи за период', () => {
    expect(weightsInPeriod(list, 10, now).map((x) => x.id)).toEqual(['b', 'c']);
    expect(weightsInPeriod([...list].reverse(), null, now).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
