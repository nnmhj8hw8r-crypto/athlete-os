import { describe, expect, it } from 'vitest';
import { BUILT_IN_TESTS, allTests, bestResult, formatTestValue, lastChange, latestResult, parseTestValue } from './fitnessTests.ts';
import type { TestResult } from './schemas.ts';

const res = (id: string, date: string, value: number): TestResult => ({ id, testId: 't', date, value, createdAt: `${date}T00:00:00.000Z`, updatedAt: '' });

describe('тесты и замеры', () => {
  it('у встроенных тестов уникальные id', () => {
    expect(new Set(BUILT_IN_TESTS.map((t) => t.id)).size).toBe(BUILT_IN_TESTS.length);
  });

  it('свои тесты добавляются в общий список', () => {
    const all = allTests([{ id: 'own1', name: 'Броски за 30 с', unit: 'reps', higherIsBetter: true, createdAt: '', updatedAt: '' }]);
    expect(all.at(-1)).toMatchObject({ id: 'own1', category: 'own', builtIn: false });
  });

  it('время вводится как м:сс или секундами с запятой', () => {
    expect(parseTestValue({ unit: 'sec' }, '12:40')).toBe(760);
    expect(parseTestValue({ unit: 'sec' }, '4,6')).toBe(4.6);
    expect(parseTestValue({ unit: 'reps' }, '15')).toBe(15);
    expect(parseTestValue({ unit: 'cm' }, '')).toBeUndefined();
    expect(parseTestValue({ unit: 'cm' }, 'abc')).toBeUndefined();
  });

  it('форматирование значения', () => {
    expect(formatTestValue({ unit: 'sec' }, 4.6)).toBe('4,6 с');
    expect(formatTestValue({ unit: 'sec' }, 760)).toBe('12:40');
    expect(formatTestValue({ unit: 'reps' }, 15)).toBe('15 раз');
    expect(formatTestValue({ unit: 'other', unitLabel: 'бр.' }, 9)).toBe('9 бр.');
  });

  it('лучший результат учитывает направление', () => {
    const list = [res('a', '2026-10-01', 12), res('b', '2026-10-08', 9), res('c', '2026-10-15', 14)];
    expect(bestResult({ higherIsBetter: true }, list)?.id).toBe('c');
    expect(bestResult({ higherIsBetter: false }, list)?.id).toBe('b');
    expect(latestResult(list)?.id).toBe('c');
  });

  it('изменение к предыдущему результату', () => {
    const list = [res('a', '2026-10-01', 20), res('b', '2026-10-08', 18.5)];
    expect(lastChange({ higherIsBetter: false }, list)).toEqual({ delta: -1.5, improved: true });
    expect(lastChange({ higherIsBetter: true }, list)).toEqual({ delta: -1.5, improved: false });
    expect(lastChange({ higherIsBetter: true }, [list[0]!])).toBeNull();
  });
});
