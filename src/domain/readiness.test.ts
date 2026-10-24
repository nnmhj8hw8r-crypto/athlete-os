import { describe, expect, it } from 'vitest';
import { CHECKIN_SCALES } from './checkinScales.ts';
import {
  adviceLine,
  computeReadiness,
  DEFAULT_READINESS_CONFIG,
  describeFactor,
  personalScale,
  explain,
  median,
  normalizeReadinessConfig,
  readinessBand,
  readinessSeries,
} from './readiness.ts';
import type { Checkin } from './schemas.ts';
import { addDays } from './time.ts';

const c = (date: string, p: Partial<Checkin> = {}): Checkin => ({
  id: date,
  date,
  soreMuscles: [],
  createdAt: `${date}T05:00:00.000Z`,
  updatedAt: `${date}T05:00:00.000Z`,
  ...p,
});

/** n одинаковых «обычных» дней до 2026-10-22. */
const history = (n: number, p: Partial<Checkin> = {}) =>
  Array.from({ length: n }, (_, i) => c(addDays('2026-10-22', -(i + 1)), { sleepHours: 7.5, sleepQuality: 4, energy: 4, mood: 4, stress: 2, ...p }));

describe('готовность', () => {
  it('нет чек-ина сегодня', () => {
    expect(computeReadiness(history(10), '2026-10-22')).toEqual({ kind: 'no-checkin' });
  });

  it('калибровка: прошлых чек-инов меньше M', () => {
    expect(computeReadiness([...history(3), c('2026-10-22', { sleepHours: 7 })], '2026-10-22')).toEqual({ kind: 'calibrating', have: 3, need: 7 });
    const cfg = { ...DEFAULT_READINESS_CONFIG, calibrationDays: 3 };
    expect(computeReadiness([...history(3), c('2026-10-22', { sleepHours: 7 })], '2026-10-22', cfg).kind).toBe('score');
  });

  it('на уровне нормы — 70; хуже нормы — ниже; лучше — выше', () => {
    const base = history(10);
    const same = computeReadiness([...base, c('2026-10-22', { sleepHours: 7.5, sleepQuality: 4, energy: 4, mood: 4, stress: 2 })], '2026-10-22');
    expect(same).toMatchObject({ kind: 'score', score: 70 });
    const bad = computeReadiness([...base, c('2026-10-22', { sleepHours: 6.1, sleepQuality: 2, energy: 2, mood: 3, stress: 4, soreMuscles: ['lats', 'biceps'] })], '2026-10-22');
    const good = computeReadiness([...base, c('2026-10-22', { sleepHours: 8.5, sleepQuality: 5, energy: 5, mood: 5, stress: 1 })], '2026-10-22');
    if (bad.kind !== 'score' || good.kind !== 'score') throw new Error('нет оценки');
    expect(bad.score).toBeLessThan(40);
    expect(good.score).toBeGreaterThan(85);
    expect(bad.factors[0]?.impact).toBeLessThan(0);
  });

  it('без пульса и HRV вес перераспределяется — компонент указан как отсутствующий', () => {
    const r = computeReadiness([...history(10), c('2026-10-22', { sleepHours: 7.5 })], '2026-10-22');
    expect(r.kind).toBe('score');
    if (r.kind === 'score') {
      expect(r.missing).toContain('heart');
      expect(r.components.heart).toBeUndefined();
      expect(r.score).toBe(70);
    }
  });

  it('у показателя мало истории — он не учитывается (норма не придумывается)', () => {
    const r = computeReadiness([...history(10), c('2026-10-22', { sleepHours: 7.5, restingHr: 70, hrvRmssd: 30 })], '2026-10-22');
    if (r.kind !== 'score') throw new Error('нет оценки');
    expect(r.factors.some((f) => f.metric === 'restingHr')).toBe(false);
  });

  it('пустой чек-ин без истории показателей — недостаточно данных', () => {
    const past = Array.from({ length: 8 }, (_, i) => c(addDays('2026-10-22', -(i + 1)), { soreMuscles: [] }));
    const cfg = { ...DEFAULT_READINESS_CONFIG, weights: { sleep: 30, wellbeing: 25, soreness: 0, heart: 20 } };
    expect(computeReadiness([...past, c('2026-10-22')], '2026-10-22', cfg)).toEqual({ kind: 'insufficient' });
  });

  it('медиана, ряд по дням, настройки', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
    const all = [...history(10), c('2026-10-22', { sleepHours: 7.5, sleepQuality: 4, energy: 4, mood: 4, stress: 2 })];
    expect(readinessSeries(all, ['2026-10-01', '2026-10-22'])).toEqual([null, 70]);
    expect(normalizeReadinessConfig({ calibrationDays: 1, weights: { sleep: 500 } })).toMatchObject({ calibrationDays: 3, weights: { sleep: 100, wellbeing: 25 } });
  });

  it('тексты: плитка, объяснение, совет', () => {
    expect(describeFactor({ metric: 'sleepHours', value: 6.1, norm: 7.5, impact: -1.4 })).toMatchObject({ value: '6,1 ч', delta: 'на 1,4 ч ниже нормы', better: false });
    expect(describeFactor({ metric: 'lnHrv', value: Math.log(54), norm: Math.log(60), impact: -0.7 }).value).toBe('54 мс (ln 4)');
    expect(explain([{ metric: 'sleepHours', value: 6, norm: 7.5, impact: -1.5 }])).toMatch(/снижают: сон/);
    expect(explain([])).toMatch(/нет/);
    expect(adviceLine(65, ['lats'])).toBe('Умеренная нагрузка, широчайшие ещё восстанавливается.');
    expect(adviceLine(85, [])).toBe('Можно тренироваться в полную силу.');
    expect(readinessBand(30).level).toBe('rest');
  });
});

describe('свой разброс и шкалы чек-ина (v0.10)', () => {
  it('разброс ограничен половиной и двойным стартовым шагом', () => {
    expect(personalScale([7, 7, 7, 7], 1)).toBe(0.5);
    expect(personalScale([3, 9, 4, 10, 2, 8], 1)).toBe(2);
    expect(personalScale([7, 8], 1)).toBe(1);
    expect(personalScale([6.5, 7.5, 7, 8, 6], 1)).toBeCloseTo(0.79, 2);
  });
  it('у каждой шкалы пять словесных описаний', () => {
    for (const def of Object.values(CHECKIN_SCALES)) {
      expect(def.anchors).toHaveLength(5);
      expect(new Set(def.anchors).size).toBe(5);
    }
  });
});
