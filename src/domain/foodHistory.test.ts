import { describe, expect, it } from 'vitest';
import { buildHistory, historyBoost, QUICK_REF, splitHistoryByMeal } from './foodHistory.ts';
import type { MealEntry } from './schemas.ts';

let n = 0;
function entry(p: Partial<MealEntry>): MealEntry {
  n++;
  return {
    id: `m${n}`,
    date: '2026-10-22',
    mealType: 'breakfast',
    foodName: 'Гречка',
    basis: 'g',
    amount: 100,
    per100: { kcal: 100, protein: 4, fat: 1, carbs: 20 },
    nutrients: { kcal: 100, protein: 4, fat: 1, carbs: 20 },
    createdAt: `2026-10-22T0${n}:00:00.000Z`,
    updatedAt: `2026-10-22T0${n}:00:00.000Z`,
    ...p,
  };
}

describe('моя история', () => {
  it('группирует по продукту и берёт последнюю порцию', () => {
    const h = buildHistory([
      entry({ foodId: 'f1', amount: 150 }),
      entry({ foodId: 'f1', amount: 70, mealType: 'dinner' }),
      entry({ refId: 'usda:1', foodName: 'Форель' }),
      entry({ refId: QUICK_REF, foodName: 'Быстрый ввод' }),
    ]);
    expect(h.map((i) => i.name)).toEqual(['Форель', 'Гречка']);
    const buck = h.find((i) => i.foodId === 'f1')!;
    expect(buck.lastAmount).toBe(70);
    expect(buck.uses).toBe(2);
    expect(buck.byMeal).toEqual({ breakfast: 1, dinner: 1 });
  });

  it('разделение по приёму пищи', () => {
    const h = buildHistory([entry({ foodName: 'Каша' }), entry({ foodName: 'Суп', mealType: 'lunch' })]);
    const s = splitHistoryByMeal(h, 'lunch');
    expect(s.thisMeal.map((i) => i.name)).toEqual(['Суп']);
    expect(s.other.map((i) => i.name)).toEqual(['Каша']);
  });

  it('буст растёт с частотой и ограничен', () => {
    expect(historyBoost(1)).toBe(10);
    expect(historyBoost(1000)).toBe(30);
  });
});
