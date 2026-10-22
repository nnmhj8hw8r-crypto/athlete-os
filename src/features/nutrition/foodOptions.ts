// Единый источник вариантов еды для окна добавления: моя история, мои продукты и рецепты,
// встроенная база (продукты USDA и типовые блюда), офлайн-база российских товаров.
// Порядок приоритета задаётся очками в поиске: история > мои продукты > база.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import type { Extra, NutrientBasis, Per100 } from '../../../shared/catalog.ts';
import { db } from '../../data/db.ts';
import { loadOfflineBase, offProductUrl, type OfflineBase } from '../../data/offlineBase.ts';
import { REFERENCE_FOODS, type ReferenceFood } from '../../data/referenceFoods.ts';
import { buildHistory, historyBoost, type HistoryItem } from '../../domain/foodHistory.ts';
import { createSearchIndex, searchIndex } from '../../domain/foodSearch.ts';
import type { Food, MealEntry } from '../../domain/schemas.ts';

export type OptionKind = 'history' | 'mine' | 'recipe' | 'ref' | 'dish' | 'off';

export interface FoodOption {
  key: string;
  kind: OptionKind;
  name: string;
  brand?: string;
  aliases?: readonly string[];
  basis: NutrientBasis;
  per100: Per100;
  extra?: Extra;
  foodId?: string;
  refId?: string;
  sourceUrl?: string;
  /** Сколько раз ел и последняя порция (из истории). */
  uses?: number;
  lastAmount?: number;
  food?: Food;
  reference?: ReferenceFood;
}

export const KIND_LABEL: Record<OptionKind, string> = {
  history: 'история',
  mine: 'мой продукт',
  recipe: 'мой рецепт',
  ref: 'база',
  dish: 'типовое блюдо',
  off: 'товар',
};

export const usdaUrl = (id: string) => `https://fdc.nal.usda.gov/food-details/${id.replace('usda:', '')}/nutrients`;

export function referenceOption(r: ReferenceFood): FoodOption {
  return {
    key: `ref:${r.id}`,
    kind: r.kind === 'dish' ? 'dish' : 'ref',
    name: r.name,
    aliases: r.aliases,
    basis: 'g',
    per100: r.per100,
    extra: r.extra,
    refId: r.id,
    sourceUrl: r.id.startsWith('usda:') ? usdaUrl(r.id) : undefined,
    reference: r,
  };
}

export function foodOption(f: Food): FoodOption {
  return {
    key: `food:${f.id}`,
    kind: f.source === 'recipe' ? 'recipe' : 'mine',
    name: f.name,
    brand: f.brand,
    basis: f.basis,
    per100: f.per100,
    extra: f.extra,
    foodId: f.id,
    sourceUrl: f.sourceUrl,
    food: f,
  };
}

export function historyOption(h: HistoryItem): FoodOption {
  return {
    key: h.key,
    kind: 'history',
    name: h.name,
    brand: h.brand,
    basis: h.basis,
    per100: h.per100,
    extra: h.extra100,
    foodId: h.foodId,
    refId: h.refId,
    sourceUrl: h.sourceUrl,
    uses: h.uses,
    lastAmount: h.lastAmount,
  };
}

const REFERENCE_OPTIONS = REFERENCE_FOODS.map(referenceOption);

/** Загружает офлайн-базу один раз; null — пока грузится или не удалось. */
export function useOfflineBase(): OfflineBase | null {
  const [base, setBase] = useState<OfflineBase | null>(null);
  useEffect(() => {
    let alive = true;
    void loadOfflineBase().then((b) => alive && setBase(b));
    return () => {
      alive = false;
    };
  }, []);
  return base;
}

export function useFoodData() {
  const meals = useLiveQuery(() => db.meals.orderBy('date').reverse().limit(1500).toArray(), []);
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const offline = useOfflineBase();
  const history = useMemo(() => (meals ? buildHistory(meals as MealEntry[]) : []), [meals]);
  return { meals, foods, offline, history, loading: meals === undefined || foods === undefined };
}

/**
 * Поиск по всем источникам. Своё (история, каталог) и база ищутся одним движком,
 * а очки истории поднимают то, что ты уже ел.
 */
export function useFoodSearch(query: string, data: ReturnType<typeof useFoodData>, limit = 40): FoodOption[] {
  const { foods, history, offline } = data;

  const ownIndex = useMemo(() => {
    const byKey = new Map<string, FoodOption>();
    for (const f of foods ?? []) byKey.set(`food:${f.id}`, foodOption(f));
    for (const h of history) {
      const existing = byKey.get(h.key);
      if (existing) {
        existing.uses = h.uses;
        existing.lastAmount = h.lastAmount;
      } else if (!h.refId) {
        byKey.set(h.key, historyOption(h));
      }
    }
    return createSearchIndex([...byKey.values()], (o) => ({ name: o.name, brand: o.brand }));
  }, [foods, history]);

  const usesByRef = useMemo(() => new Map(history.filter((h) => h.refId).map((h) => [h.refId!, h])), [history]);
  const refIndex = useMemo(() => createSearchIndex(REFERENCE_OPTIONS, (o) => ({ name: o.name, aliases: o.aliases })), []);

  return useMemo(() => {
    if (!query.trim()) return [];
    const withHistory = (o: FoodOption): FoodOption => {
      const h = o.refId ? usesByRef.get(o.refId) : undefined;
      return h ? { ...o, uses: h.uses, lastAmount: h.lastAmount } : o;
    };
    const boost = (o: FoodOption) => {
      const h = o.refId ? usesByRef.get(o.refId) : undefined;
      const uses = o.uses ?? h?.uses ?? 0;
      const kindBoost = o.kind === 'mine' || o.kind === 'recipe' ? 12 : o.kind === 'history' ? 10 : o.kind === 'dish' ? 3 : o.kind === 'ref' ? 2 : 0;
      return kindBoost + (uses ? historyBoost(uses) : 0);
    };
    const hits = [
      ...searchIndex(ownIndex, query, { boost, limit }),
      ...searchIndex(refIndex, query, { boost, limit }),
      // Товары с брендом ниже обычных продуктов: на «картошку» сначала картофель, потом пирожное «Картошка».
      ...(offline
        ? searchIndex(offline.index, query, { limit, boost: () => -15 }).map((h) => ({ ...h, item: offlineOption(h.item) }))
        : []),
    ];
    hits.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const out: FoodOption[] = [];
    for (const h of hits) {
      if (seen.has(h.item.key)) continue;
      seen.add(h.item.key);
      out.push(withHistory(h.item));
      if (out.length >= limit) break;
    }
    return out;
  }, [query, ownIndex, refIndex, offline, usesByRef, limit]);
}

export function offlineOption(p: OfflineBase['products'][number]): FoodOption {
  return {
    key: `ref:${p.id}`,
    kind: 'off',
    name: p.name,
    brand: p.brand,
    basis: p.basis,
    per100: p.per100,
    extra: p.extra,
    refId: p.id,
    sourceUrl: offProductUrl(p.code),
  };
}

/** Типовые блюда встроенной базы — для вкладки «Рецепты». */
export const DISH_OPTIONS = REFERENCE_OPTIONS.filter((o) => o.kind === 'dish');
