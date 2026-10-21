import { describe, expect, it } from 'vitest';
import {
  computeRecipe,
  hasEnergyMismatch,
  kcalFromMacros,
  nutrientsForAmount,
  nutrientsForPortion,
  sumNutrients,
} from './nutrition.ts';
import { foodSchema } from './schemas.ts';

const grain = { kcal: 343, protein: 12.6, fat: 3.3, carbs: 62.1 };
const milk = { kcal: 59, protein: 2.9, fat: 3.2, carbs: 4.7 };

describe('nutrientsForAmount', () => {
  it('считает порцию 80 г продукта со значениями на 100 г', () => {
    expect(nutrientsForAmount(grain, 80)).toEqual({ kcal: 274.4, protein: 10.08, fat: 2.64, carbs: 49.68 });
  });

  it('считает порцию 250 мл продукта со значениями на 100 мл', () => {
    expect(nutrientsForAmount(milk, 250)).toEqual({ kcal: 147.5, protein: 7.25, fat: 8, carbs: 11.75 });
  });

  it('нулевая порция даёт нули', () => {
    expect(nutrientsForAmount(grain, 0)).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
  });

  it('отклоняет отрицательное и нечисловое количество', () => {
    expect(() => nutrientsForAmount(grain, -1)).toThrow();
    expect(() => nutrientsForAmount(grain, Number.NaN)).toThrow();
  });
});

describe('nutrientsForPortion', () => {
  it('не пересчитывает миллилитры в граммы без плотности', () => {
    expect(() => nutrientsForPortion({ basis: 'ml', per100: milk }, 200, 'g')).toThrow(/плотности/);
  });

  it('считает, когда единицы совпадают', () => {
    expect(nutrientsForPortion({ basis: 'ml', per100: milk }, 100, 'ml')).toEqual(milk);
  });
});

describe('sumNutrients', () => {
  it('складывает без накопления ошибки округления', () => {
    const t = sumNutrients([
      { kcal: 0.1, protein: 0.1, fat: 0.1, carbs: 0.1 },
      { kcal: 0.2, protein: 0.2, fat: 0.2, carbs: 0.2 },
    ]);
    expect(t).toEqual({ kcal: 0.3, protein: 0.3, fat: 0.3, carbs: 0.3 });
  });

  it('пустой список — нули', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
  });
});

describe('проверка калорийности по БЖУ', () => {
  it('считает энергию по коэффициентам 4/9/4', () => {
    expect(kcalFromMacros({ protein: 10, fat: 10, carbs: 10 })).toBe(170);
  });

  it('не предупреждает при правдоподобных значениях', () => {
    expect(hasEnergyMismatch(grain)).toBe(false);
  });

  it('предупреждает при явной опечатке', () => {
    expect(hasEnergyMismatch({ kcal: 34, protein: 12.6, fat: 3.3, carbs: 62.1 })).toBe(true);
  });
});

describe('computeRecipe', () => {
  it('считает рецепт из ингредиентов в граммах по сумме масс', () => {
    const r = computeRecipe([
      { foodId: 'a', name: 'Курица', basis: 'g', amount: 200, per100: { kcal: 165, protein: 31, fat: 3.6, carbs: 0 } },
      { foodId: 'b', name: 'Рис варёный', basis: 'g', amount: 150, per100: { kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 } },
    ]);
    expect(r).toEqual({
      ok: true,
      totalWeightG: 350,
      totals: { kcal: 525, protein: 66.05, fat: 7.65, carbs: 42 },
      per100: { kcal: 150, protein: 18.87, fat: 2.19, carbs: 12 },
    });
  });

  it('требует итоговую массу, если есть ингредиенты в мл', () => {
    const ingredients = [
      { foodId: 'a', name: 'Овсянка', basis: 'g' as const, amount: 60, per100: { kcal: 366, protein: 12, fat: 6, carbs: 60 } },
      { foodId: 'b', name: 'Молоко', basis: 'ml' as const, amount: 200, per100: milk },
    ];
    expect(computeRecipe(ingredients).ok).toBe(false);
    const r = computeRecipe(ingredients, 260);
    expect(r).toMatchObject({ ok: true, totalWeightG: 260, per100: { kcal: 129.85, protein: 5, fat: 3.85, carbs: 17.46 } });
  });

  it('отклоняет пустой рецепт', () => {
    expect(computeRecipe([]).ok).toBe(false);
  });
});

describe('схема продукта', () => {
  const base = {
    id: '1',
    name: 'Продукт',
    basis: 'g',
    per100: grain,
    source: 'manual',
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
  };

  it('принимает корректный продукт', () => {
    expect(foodSchema.safeParse(base).success).toBe(true);
  });

  it('отклоняет отрицательные значения', () => {
    expect(foodSchema.safeParse({ ...base, per100: { ...grain, fat: -1 } }).success).toBe(false);
  });

  it('отклоняет пустое название', () => {
    expect(foodSchema.safeParse({ ...base, name: '   ' }).success).toBe(false);
  });

  it('отклоняет БЖУ больше 100 г на 100 г', () => {
    expect(foodSchema.safeParse({ ...base, per100: { kcal: 900, protein: 50, fat: 40, carbs: 20 } }).success).toBe(false);
  });

  it('для продукта на 100 мл ограничение 100 г не применяется', () => {
    const r = foodSchema.safeParse({ ...base, basis: 'ml', per100: { kcal: 900, protein: 50, fat: 40, carbs: 20 } });
    expect(r.success).toBe(true);
  });

  it('отклоняет некорректный штрихкод', () => {
    expect(foodSchema.safeParse({ ...base, barcode: '12ab' }).success).toBe(false);
  });
});
