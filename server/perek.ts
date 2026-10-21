// Серверный адаптер Perek.us (https://perek.us/developers).
// Ключ передаётся только в заголовке X-Api-Key исходящего запроса и никогда не попадает
// в ответы, логи или клиентский код.
import { z } from 'zod';
import type { CatalogFood, CatalogResponse, CatalogErrorResponse } from '../shared/catalog.ts';

export const PEREK_BASE_URL = 'https://perek.us/api/v1/foods';

export interface PerekClientOptions {
  apiKey: string | undefined;
  baseUrl?: string;
  timeoutMs?: number;
  /** Собственный предел запросов в минуту — ниже лимита бесплатного тарифа (20/мин). */
  maxRequestsPerMinute?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface PerekClient {
  readonly enabled: boolean;
  search(query: string, limit: number): Promise<CatalogResponse>;
  barcode(ean: string): Promise<CatalogResponse>;
}

// ---------- Разбор ответа Perek.us ----------
// Документация показывает пример только для поиска; формат ответа по штрихкоду не опубликован,
// поэтому карточка ищется в нескольких вероятных местах, а всё непонятное считается ошибкой.

const num = z.number().finite().nonnegative();
const perekFoodSchema = z.object({
  id: z.union([z.string().min(1), z.number()]).transform(String),
  name: z.string().min(1),
  brand: z.object({ name: z.string().nullish() }).nullish(),
  per100: z.object({ kcal: num, protein: num, fat: num, carbs: num }),
  unit: z.string().nullish(),
  url: z.string().nullish(),
  license: z.string().nullish(),
  barcode: z.string().nullish(),
  servings: z.array(z.object({ label: z.string(), grams: num })).nullish(),
});

function toBasis(unit: string | null | undefined): 'g' | 'ml' | null {
  if (unit === undefined || unit === null || unit === 'г' || unit === 'g') return 'g';
  if (unit === 'мл' || unit === 'ml') return 'ml';
  return null; // неизвестная единица: лучше пропустить продукт, чем перепутать основу пересчёта
}

/** Ссылка на источник принимается только на сайт perek.us. */
function safePerekUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url, 'https://perek.us');
    return u.protocol === 'https:' && (u.hostname === 'perek.us' || u.hostname.endsWith('.perek.us')) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeFood(raw: unknown, barcode?: string): CatalogFood | null {
  const r = perekFoodSchema.safeParse(raw);
  if (!r.success) return null;
  const f = r.data;
  const basis = toBasis(f.unit);
  if (!basis) return null;
  return {
    provider: 'perek',
    externalId: f.id,
    name: f.name,
    brand: f.brand?.name ?? undefined,
    basis,
    per100: f.per100,
    url: safePerekUrl(f.url),
    license: f.license ?? undefined,
    barcode: f.barcode ?? barcode,
    servings: f.servings ?? undefined,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseSearchBody(body: unknown): CatalogResponse {
  if (!isObject(body) || !Array.isArray(body.foods)) return badResponse();
  const foods = body.foods.map((f) => normalizeFood(f)).filter((f): f is CatalogFood => f !== null);
  if (body.foods.length > 0 && foods.length === 0) return badResponse();
  return { status: 'ok', exact: body.similar !== true, foods, hasMore: body.more === true };
}

export function parseBarcodeBody(body: unknown, ean: string): CatalogResponse {
  if (!isObject(body)) return badResponse();
  const candidates: unknown[] = [body, body.food, Array.isArray(body.foods) ? body.foods[0] : undefined];
  for (const c of candidates) {
    const food = normalizeFood(c, ean);
    if (food) return { status: 'ok', exact: body.similar !== true, foods: [food] };
  }
  return badResponse();
}

function productNameFrom404(body: unknown): string | undefined {
  if (!isObject(body)) return undefined;
  const p = body.product;
  if (typeof p === 'string' && p.trim()) return p.trim();
  if (isObject(p) && typeof p.name === 'string' && p.name.trim()) return p.name.trim();
  return undefined;
}

// ---------- Ошибки ----------

const err = (code: CatalogErrorResponse['code'], message: string, extra: Partial<CatalogErrorResponse> = {}): CatalogErrorResponse => ({
  status: 'error',
  code,
  message,
  ...extra,
});

const badResponse = () => err('bad_response', 'Perek.us вернул ответ в неожиданном формате. Введите продукт вручную.');

export function parseRetryAfter(header: string | null, nowMs: number): number | undefined {
  if (!header) return undefined;
  const sec = Number(header);
  if (Number.isFinite(sec) && sec >= 0) return Math.ceil(sec);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - nowMs) / 1000));
  return undefined;
}

// ---------- Клиент ----------

export function createPerekClient(options: PerekClientOptions): PerekClient {
  const apiKey = options.apiKey?.trim() || undefined;
  const baseUrl = options.baseUrl ?? PEREK_BASE_URL;
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxPerMinute = options.maxRequestsPerMinute ?? 15;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  const recent: number[] = [];
  let blockedUntil = 0;
  const cache = new Map<string, { expires: number; value: CatalogResponse }>();

  function cached(key: string): CatalogResponse | undefined {
    const hit = cache.get(key);
    if (!hit) return undefined;
    if (hit.expires < now()) {
      cache.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function remember(key: string, value: CatalogResponse, ttlMs: number) {
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: now() + ttlMs, value });
  }

  /** Локальный лимит, чтобы не расходовать дневную квоту бесплатного тарифа одним всплеском. */
  function takeSlot(): CatalogErrorResponse | null {
    const t = now();
    if (t < blockedUntil) {
      const retryAfterSec = Math.ceil((blockedUntil - t) / 1000);
      return err('rate_limited', `Лимит запросов Perek.us исчерпан. Повторите через ${retryAfterSec} с.`, { retryAfterSec });
    }
    while (recent.length && recent[0]! <= t - 60_000) recent.shift();
    if (recent.length >= maxPerMinute) {
      const retryAfterSec = Math.max(1, Math.ceil((recent[0]! + 60_000 - t) / 1000));
      return err('rate_limited', `Слишком много запросов. Повторите через ${retryAfterSec} с.`, { retryAfterSec });
    }
    recent.push(t);
    return null;
  }

  async function request(path: string, onOk: (body: unknown) => CatalogResponse, on404: (body: unknown) => CatalogResponse): Promise<CatalogResponse> {
    if (!apiKey) {
      return err('disabled', 'Поиск в Perek.us не подключён: на сервере не задан PEREK_API_KEY.');
    }
    const limited = takeSlot();
    if (limited) return limited;

    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        return err('timeout', 'Perek.us не ответил вовремя. Попробуйте позже или введите продукт вручную.');
      }
      return err('network', 'Нет связи с Perek.us. Можно выбрать продукт из своего каталога или ввести вручную.');
    }

    let body: unknown = undefined;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }

    if (res.ok) return body === undefined ? badResponse() : onOk(body);
    if (res.status === 404) return on404(body);
    if (res.status === 429) {
      const retryAfterSec = parseRetryAfter(res.headers.get('Retry-After'), now()) ?? 60;
      blockedUntil = now() + retryAfterSec * 1000;
      return err('rate_limited', `Лимит запросов Perek.us исчерпан. Повторите через ${retryAfterSec} с.`, { retryAfterSec });
    }
    if (res.status === 401 || res.status === 403) {
      return err('auth_failed', 'Perek.us отклонил ключ API. Проверьте PEREK_API_KEY на сервере.');
    }
    return err('upstream_error', `Perek.us временно недоступен (код ${res.status}).`);
  }

  return {
    enabled: Boolean(apiKey),

    async search(query, limit) {
      const key = `s:${query.toLocaleLowerCase('ru-RU')}:${limit}`;
      const hit = cached(key);
      if (hit) return hit;
      const params = new URLSearchParams({ q: query, limit: String(limit), market: 'ru' });
      const result = await request(`/search?${params}`, parseSearchBody, () =>
        ({ status: 'ok', exact: false, foods: [] }) satisfies CatalogResponse,
      );
      if (result.status === 'ok') remember(key, result, 60 * 60_000);
      return result;
    },

    async barcode(ean) {
      const key = `b:${ean}`;
      const hit = cached(key);
      if (hit) return hit;
      const result = await request(
        `/barcode/${encodeURIComponent(ean)}`,
        (body) => parseBarcodeBody(body, ean),
        (body) => {
          const productName = productNameFrom404(body);
          return err(
            'not_found',
            productName
              ? `Товар «${productName}» известен Perek.us, но пищевой ценности для него нет. Введите данные с упаковки.`
              : 'Продукт с таким штрихкодом не найден. Введите данные с упаковки вручную.',
            productName ? { productName } : {},
          );
        },
      );
      // Кэшируются и найденные, и «не найдено» — чтобы повторное сканирование не тратило квоту.
      if (result.status === 'ok' || result.code === 'not_found') remember(key, result, 24 * 60 * 60_000);
      return result;
    },
  };
}
