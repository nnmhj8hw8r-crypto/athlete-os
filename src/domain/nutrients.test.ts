import { describe, expect, it } from 'vitest';
import { cleanExtra, scaleExtra, sumExtra } from './nutrients.ts';

describe('расширенные нутриенты', () => {
  it('пересчёт на порцию сохраняет «нет данных»', () => {
    expect(scaleExtra({ fiber: 2, sodium: 100 }, 150)).toEqual({ fiber: 3, sodium: 150 });
    expect(scaleExtra(undefined, 100)).toBeUndefined();
  });

  it('cleanExtra отбрасывает пустое и отрицательное', () => {
    expect(cleanExtra({ fiber: 1, sugars: undefined, sodium: -1 })).toEqual({ fiber: 1 });
    expect(cleanExtra({})).toBeUndefined();
  });

  it('сумма только по известным значениям, покрытие — по калориям', () => {
    const t = sumExtra([
      { kcal: 300, extra: { fiber: 5 } },
      { kcal: 100, extra: {} },
      { kcal: 600, extra: { fiber: 3, sugars: 10 } },
    ]);
    expect(t.fiber).toEqual({ value: 8, coverage: 0.9, known: 2 });
    expect(t.sugars.coverage).toBeCloseTo(0.6);
    expect(t.transFat).toEqual({ value: 0, coverage: 0, known: 0 });
  });
});
