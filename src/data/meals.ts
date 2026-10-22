// Запись приёмов пищи и воды. Пищевая ценность сохраняется снимком на момент записи.
import type { Extra, NutrientBasis, Per100 } from '../../shared/catalog.ts';
import { QUICK_REF } from '../domain/foodHistory.ts';
import { scaleExtra } from '../domain/nutrients.ts';
import { nutrientsForAmount } from '../domain/nutrition.ts';
import type { MealEntry, MealType } from '../domain/schemas.ts';
import { saveEntity, type SaveResult } from './repo.ts';

/** Продукт для порции: из каталога, базы или снимок уже сохранённой записи. */
export interface PortionFood {
  foodId?: string;
  refId?: string;
  name: string;
  brand?: string;
  basis: NutrientBasis;
  per100: Per100;
  extra?: Extra;
  sourceUrl?: string;
  /** Последняя порция из истории — предлагается первой. */
  lastAmount?: number;
}

export interface MealDraft {
  food: PortionFood;
  amount: number;
  mealType: MealType;
  date: string;
  notes?: string;
}

export function mealEntryDraft({ food, amount, mealType, date, notes }: MealDraft) {
  const valid = Number.isFinite(amount) && amount >= 0;
  return {
    date,
    mealType,
    foodId: food.foodId,
    refId: food.refId,
    foodName: food.name,
    brand: food.brand,
    basis: food.basis,
    amount,
    per100: food.per100,
    // Пересчёт выполняется только для корректной порции; иначе схема покажет ошибку поля amount.
    nutrients: valid ? nutrientsForAmount(food.per100, amount) : food.per100,
    extra100: food.extra,
    extra: valid ? scaleExtra(food.extra, amount) : undefined,
    sourceUrl: food.sourceUrl,
    notes,
  };
}

export function saveMealEntry(draft: MealDraft, existing?: MealEntry): Promise<SaveResult<MealEntry>> {
  return saveEntity('meals', mealEntryDraft(draft), existing);
}

/** Быстрый ввод: только калории и БЖУ приёма пищи, без продукта (как «быстрый ввод» в FatSecret). */
export function saveQuickEntry(p: { name: string; nutrients: Per100; mealType: MealType; date: string }) {
  return saveEntity('meals', {
    date: p.date,
    mealType: p.mealType,
    refId: QUICK_REF,
    foodName: p.name.trim() || 'Быстрый ввод',
    basis: 'g',
    amount: 100,
    per100: p.nutrients,
    nutrients: p.nutrients,
  });
}

export function addWater(date: string, ml: number) {
  return saveEntity('water', { date, ml: Math.round(ml) });
}
