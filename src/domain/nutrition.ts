// Расчёт калорий и БЖУ. Только обычная арифметика, без внешних сервисов.
import type { NutrientBasis, Per100 } from '../../shared/catalog.ts';
import type { MealType, RecipeIngredient } from './schemas.ts';

export const ZERO_NUTRIENTS: Per100 = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

const round2 = (x: number) => Math.round(x * 100) / 100;

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

export function unitLabel(basis: NutrientBasis): string {
  return basis === 'ml' ? 'мл' : 'г';
}

/**
 * Пищевая ценность порции. Значения продукта заданы на 100 г или на 100 мл (basis),
 * количество порции указывается в тех же единицах. Пересчёт мл ↔ г не выполняется:
 * без плотности продукта он был бы выдумкой.
 */
export function nutrientsForAmount(per100: Per100, amount: number): Per100 {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Количество должно быть неотрицательным числом');
  const k = amount / 100;
  return {
    kcal: round2(per100.kcal * k),
    protein: round2(per100.protein * k),
    fat: round2(per100.fat * k),
    carbs: round2(per100.carbs * k),
  };
}

/** Порция в единицах, отличных от единиц продукта, — ошибка, а не повод «угадать» плотность. */
export function nutrientsForPortion(
  food: { basis: NutrientBasis; per100: Per100 },
  amount: number,
  unit: NutrientBasis,
): Per100 {
  if (unit !== food.basis) {
    throw new Error(
      `Значения продукта указаны на 100 ${unitLabel(food.basis)}, а порция — в ${unitLabel(unit)}. ` +
        'Пересчёт без плотности продукта не выполняется.',
    );
  }
  return nutrientsForAmount(food.per100, amount);
}

export function sumNutrients(list: readonly Per100[]): Per100 {
  return list.reduce<Per100>(
    (acc, n) => ({
      kcal: round2(acc.kcal + n.kcal),
      protein: round2(acc.protein + n.protein),
      fat: round2(acc.fat + n.fat),
      carbs: round2(acc.carbs + n.carbs),
    }),
    ZERO_NUTRIENTS,
  );
}

/** Энергия по коэффициентам Этуотера: 4 ккал/г белков и углеводов, 9 ккал/г жиров. */
export function kcalFromMacros(n: Pick<Per100, 'protein' | 'fat' | 'carbs'>): number {
  return round2(n.protein * 4 + n.carbs * 4 + n.fat * 9);
}

/**
 * Мягкая проверка ввода: сильное расхождение заявленных калорий и рассчитанных по БЖУ
 * часто означает опечатку. Это подсказка, а не ошибка: у продуктов с алкоголем,
 * клетчаткой или многоатомными спиртами расхождение бывает законным.
 */
export function hasEnergyMismatch(n: Per100): boolean {
  const expected = kcalFromMacros(n);
  return Math.abs(n.kcal - expected) > Math.max(25, expected * 0.2);
}

export type RecipeResult =
  | { ok: true; per100: Per100; totalWeightG: number; totals: Per100 }
  | { ok: false; error: string };

/**
 * Пищевая ценность рецепта на 100 г готового блюда.
 * Если итоговая масса не указана, берётся сумма масс ингредиентов — это возможно,
 * только когда все ингредиенты заданы в граммах.
 */
export function computeRecipe(ingredients: readonly RecipeIngredient[], totalWeightG?: number): RecipeResult {
  if (ingredients.length === 0) return { ok: false, error: 'Добавьте хотя бы один ингредиент' };
  const totals = sumNutrients(ingredients.map((i) => nutrientsForAmount(i.per100, i.amount)));
  let weight = totalWeightG;
  if (weight === undefined) {
    if (ingredients.some((i) => i.basis === 'ml')) {
      return {
        ok: false,
        error: 'В рецепте есть ингредиенты в миллилитрах. Укажите итоговую массу готового блюда в граммах.',
      };
    }
    weight = ingredients.reduce((s, i) => s + i.amount, 0);
  }
  if (!(weight > 0)) return { ok: false, error: 'Итоговая масса должна быть больше нуля' };
  const k = 100 / weight;
  return {
    ok: true,
    totalWeightG: round2(weight),
    totals,
    per100: {
      kcal: round2(totals.kcal * k),
      protein: round2(totals.protein * k),
      fat: round2(totals.fat * k),
      carbs: round2(totals.carbs * k),
    },
  };
}

export function formatKcal(n: number): string {
  return `${Math.round(n)} ккал`;
}

export function formatGrams(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString('ru-RU')} г`;
}
