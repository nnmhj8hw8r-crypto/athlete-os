// «Моя история»: ранее съеденные продукты, сгруппированные из записей дневника.
// Используется для вкладки «История», быстрого добавления последней порции и повышения
// своих продуктов в поиске.
import type { Extra, NutrientBasis, Per100 } from '../../shared/catalog.ts';
import type { MealEntry, MealType } from './schemas.ts';

export interface HistoryItem {
  key: string;
  name: string;
  brand?: string;
  basis: NutrientBasis;
  per100: Per100;
  extra100?: Extra;
  foodId?: string;
  refId?: string;
  sourceUrl?: string;
  /** Последняя порция — для кнопки «+» (добавить как в прошлый раз). */
  lastAmount: number;
  lastAt: string;
  uses: number;
  /** Сколько раз продукт ели в каждом приёме пищи. */
  byMeal: Partial<Record<MealType, number>>;
}

/** Быстрый ввод калорий (без продукта) в историю не попадает. */
export const QUICK_REF = 'quick';

export const historyKey = (e: Pick<MealEntry, 'foodId' | 'refId' | 'foodName' | 'brand'>) =>
  e.foodId ? `food:${e.foodId}` : e.refId ? `ref:${e.refId}` : `name:${e.foodName.toLocaleLowerCase('ru-RU')}|${e.brand ?? ''}`;

/** Группирует записи: самые свежие сведения о продукте берутся из последней записи. */
export function buildHistory(entries: readonly MealEntry[]): HistoryItem[] {
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const map = new Map<string, HistoryItem>();
  for (const e of sorted) {
    if (e.refId === QUICK_REF) continue;
    const key = historyKey(e);
    const found = map.get(key);
    if (found) {
      found.uses++;
      found.byMeal[e.mealType] = (found.byMeal[e.mealType] ?? 0) + 1;
      continue;
    }
    map.set(key, {
      key,
      name: e.foodName,
      brand: e.brand,
      basis: e.basis,
      per100: e.per100,
      extra100: e.extra100,
      foodId: e.foodId,
      refId: e.refId,
      sourceUrl: e.sourceUrl,
      lastAmount: e.amount,
      lastAt: e.createdAt,
      uses: 1,
      byMeal: { [e.mealType]: 1 },
    });
  }
  return [...map.values()];
}

/** Для вкладки «История»: сначала то, что ели в этот приём пищи, затем остальное (по свежести). */
export function splitHistoryByMeal(items: readonly HistoryItem[], meal: MealType): { thisMeal: HistoryItem[]; other: HistoryItem[] } {
  const thisMeal: HistoryItem[] = [];
  const other: HistoryItem[] = [];
  for (const it of items) (it.byMeal[meal] ? thisMeal : other).push(it);
  return { thisMeal, other };
}

/** Очки для поиска: чем чаще ел, тем выше (с насыщением). */
export function historyBoost(uses: number): number {
  return Math.min(30, 10 * Math.log2(1 + uses));
}
