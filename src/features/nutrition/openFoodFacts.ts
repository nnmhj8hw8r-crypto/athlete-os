// Open Food Facts (https://openfoodfacts.org) — открытая база продуктов, лицензия ODbL.
// Запрос по штрихкоду идёт прямо из браузера: ключ не нужен, API разрешает запросы с любого сайта,
// поэтому поиск работает и без нашего сервера (например, на GitHub Pages).
// Поиск по названию из браузера недоступен: поисковые адреса OFF блокируют сторонние сайты (CORS),
// поэтому здесь только штрихкод.
import { z } from 'zod';
import type { CatalogErrorResponse, CatalogFood, CatalogResponse } from '../../../shared/catalog.ts';

export const OFF_BASE_URL = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_ru,brands,product_quantity_unit,quantity,nutriments';

const optNum = z.number().finite().nonnegative().optional().catch(undefined);
const offProductSchema = z.object({
  code: z.string().optional(),
  product_name: z.string().optional().catch(undefined),
  product_name_ru: z.string().optional().catch(undefined),
  brands: z.string().optional().catch(undefined),
  product_quantity_unit: z.string().optional().catch(undefined),
  quantity: z.string().optional().catch(undefined),
  nutriments: z
    .object({
      'energy-kcal_100g': optNum,
      'energy-kj_100g': optNum,
      proteins_100g: optNum,
      fat_100g: optNum,
      carbohydrates_100g: optNum,
    })
    .optional()
    .catch(undefined),
});

const err = (code: CatalogErrorResponse['code'], message: string, extra: Partial<CatalogErrorResponse> = {}): CatalogErrorResponse => ({
  status: 'error',
  code,
  message,
  ...extra,
});

/** Жидкость определяется по единице упаковки; без явного признака считаем, что значения даны на 100 г. */
function basisOf(p: z.infer<typeof offProductSchema>): 'g' | 'ml' {
  const unit = p.product_quantity_unit?.trim().toLowerCase();
  if (unit === 'ml' || unit === 'мл') return 'ml';
  if (unit === 'g' || unit === 'г') return 'g';
  // \b в JS не понимает кириллицу, поэтому конец единицы проверяется явно
  return /\d\s*(ml|мл|l|л)(?![a-zа-яё])/i.test(p.quantity ?? '') ? 'ml' : 'g';
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Приводит карточку OFF к общему формату. Если нет хотя бы одного из показателей
 * (калории, Б, Ж, У) или они противоречивы, возвращает null — лучше попросить ввести данные
 * с упаковки, чем молча подставить ноль.
 */
export function normalizeOffProduct(raw: unknown, ean: string): { food: CatalogFood | null; name?: string } {
  const r = offProductSchema.safeParse(raw);
  if (!r.success) return { food: null };
  const p = r.data;
  const name = (p.product_name_ru || p.product_name || '').trim() || undefined;
  const n = p.nutriments;
  const kcal = n?.['energy-kcal_100g'] ?? (n?.['energy-kj_100g'] !== undefined ? n['energy-kj_100g'] / 4.184 : undefined);
  const { proteins_100g: protein, fat_100g: fat, carbohydrates_100g: carbs } = n ?? {};
  if (!name || kcal === undefined || protein === undefined || fat === undefined || carbs === undefined) return { food: null, name };

  const basis = basisOf(p);
  if (basis === 'g' && protein + fat + carbs > 100) return { food: null, name };
  const code = p.code?.trim() || ean;
  return {
    name,
    food: {
      provider: 'off',
      externalId: code,
      name,
      brand: p.brands?.split(',')[0]?.trim() || undefined,
      basis,
      per100: { kcal: round1(kcal), protein: round1(protein), fat: round1(fat), carbs: round1(carbs) },
      url: `${OFF_BASE_URL}/product/${encodeURIComponent(code)}`,
      license: 'ODbL',
      barcode: code,
    },
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseOffBarcodeBody(httpStatus: number, body: unknown, ean: string): CatalogResponse {
  const notFound = err('not_found', 'В Open Food Facts такого штрихкода нет. Введите данные с упаковки — продукт сохранится в ваш каталог.');
  if (httpStatus === 404) return notFound;
  if (httpStatus === 429) return err('rate_limited', 'Open Food Facts просит подождать: слишком много запросов. Повторите через минуту.', { retryAfterSec: 60 });
  if (httpStatus < 200 || httpStatus >= 300) return err('upstream_error', `Open Food Facts временно недоступен (код ${httpStatus}).`);
  if (!isObject(body)) return err('bad_response', 'Open Food Facts вернул ответ в неожиданном формате. Введите продукт вручную.');
  if (body.status === 0 || !isObject(body.product)) return notFound;

  const { food, name } = normalizeOffProduct(body.product, ean);
  if (food) return { status: 'ok', exact: true, foods: [food] };
  return err(
    'not_found',
    name
      ? `Товар «${name}» есть в Open Food Facts, но пищевая ценность указана не полностью. Введите данные с упаковки.`
      : 'В Open Food Facts нет пищевой ценности для этого штрихкода. Введите данные с упаковки.',
    name ? { productName: name } : {},
  );
}

export interface OffClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function offLookupBarcode(ean: string, signal?: AbortSignal, options: OffClientOptions = {}): Promise<CatalogResponse> {
  const { baseUrl = OFF_BASE_URL, timeoutMs = 8000, fetchImpl = fetch } = options;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetchImpl(`${baseUrl}/api/v2/product/${encodeURIComponent(ean)}.json?fields=${FIELDS}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    return parseOffBarcodeBody(res.status, body, ean);
  } catch (e) {
    if (signal?.aborted) throw e;
    if ((e as Error).name === 'AbortError') return err('timeout', 'Open Food Facts не ответил вовремя. Попробуйте позже или введите продукт вручную.');
    return err('network', 'Нет связи с Open Food Facts. Можно выбрать продукт из своего каталога или ввести вручную.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
