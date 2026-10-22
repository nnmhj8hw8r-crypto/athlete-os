// Офлайн-база российских товаров из Open Food Facts (ODbL), собранная scripts/build-off-russia.py.
// Файл public/data/off-ru.json кэшируется Service Worker'ом вместе с приложением, поэтому после
// первого открытия поиск по ней и по штрихкоду работает без интернета.
import type { CatalogFood, Extra } from '../../shared/catalog.ts';
import { createSearchIndex, type SearchIndex } from '../domain/foodSearch.ts';

type Row = [code: string, name: string, brand: string, basis: 0 | 1, kcal: number, protein: number, fat: number, carbs: number, extra: Extra | 0];

export interface OfflineProduct {
  id: string;
  code: string;
  name: string;
  brand?: string;
  basis: 'g' | 'ml';
  per100: { kcal: number; protein: number; fat: number; carbs: number };
  extra?: Extra;
}

export interface OfflineBase {
  generated: string;
  products: OfflineProduct[];
  byCode: Map<string, OfflineProduct>;
  index: SearchIndex<OfflineProduct>;
}

export const OFF_ATTRIBUTION = 'Данные: Open Food Facts (ODbL)';
export const offProductUrl = (code: string) => `https://world.openfoodfacts.org/product/${encodeURIComponent(code)}`;

let loading: Promise<OfflineBase | null> | null = null;

export function parseOfflineBase(json: unknown): OfflineBase {
  const payload = json as { generated?: string; products?: Row[] };
  if (!payload || !Array.isArray(payload.products)) throw new Error('Неверный формат офлайн-базы');
  const products: OfflineProduct[] = [];
  for (const r of payload.products) {
    if (!Array.isArray(r) || r.length < 8 || typeof r[0] !== 'string' || typeof r[1] !== 'string') continue;
    products.push({
      id: `off:${r[0]}`,
      code: r[0],
      name: r[1],
      brand: r[2] || undefined,
      basis: r[3] === 1 ? 'ml' : 'g',
      per100: { kcal: r[4], protein: r[5], fat: r[6], carbs: r[7] },
      extra: r[8] || undefined,
    });
  }
  return {
    generated: payload.generated ?? '',
    products,
    byCode: new Map(products.map((p) => [p.code, p])),
    index: createSearchIndex(products, (p) => ({ name: p.name, brand: p.brand })),
  };
}

/** Загружает базу один раз за сессию. Ошибка загрузки не ломает приложение: возвращается null. */
export function loadOfflineBase(): Promise<OfflineBase | null> {
  if (!loading) {
    const url = `${import.meta.env.BASE_URL}data/off-ru.json`;
    loading = fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(parseOfflineBase)
      .catch(() => {
        loading = null; // попробуем ещё раз при следующем открытии
        return null;
      });
  }
  return loading;
}

export function offlineToCatalogFood(p: OfflineProduct): CatalogFood {
  return {
    provider: 'off',
    externalId: p.code,
    name: p.name,
    brand: p.brand,
    basis: p.basis,
    per100: p.per100,
    extra: p.extra,
    url: offProductUrl(p.code),
    license: 'ODbL',
    barcode: p.code,
  };
}
