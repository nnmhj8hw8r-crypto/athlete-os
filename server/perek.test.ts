import { describe, expect, it, vi } from 'vitest';
import { catalogResponseSchema } from '../shared/catalog.ts';
import { createPerekClient, parseRetryAfter } from './perek.ts';

const KEY = 'test-key-not-real';
const EAN = '4606068171360';

const sampleFood = {
  id: 'food-1',
  name: 'Кефир 2,5%',
  type: 'branded',
  brand: { id: 'b', name: 'Тестовый бренд', kind: 'brand' },
  per100: { kcal: 53, protein: 2.9, fat: 2.5, carbs: 4 },
  servings: [{ label: 'стакан', grams: 200 }],
  unit: 'мл',
  market: 'ru',
  url: 'https://perek.us/food/kefir',
  license: null,
};

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function client(fetchImpl: typeof fetch, extra: Partial<Parameters<typeof createPerekClient>[0]> = {}) {
  return createPerekClient({ apiKey: KEY, fetchImpl, ...extra });
}

/** Каждый ответ адаптера должен соответствовать общему контракту и не содержать ключ. */
function expectSafe(result: unknown) {
  expect(catalogResponseSchema.safeParse(result).success).toBe(true);
  expect(JSON.stringify(result)).not.toContain(KEY);
}

describe('Perek.us без ключа', () => {
  it('отключён и не делает сетевых запросов', async () => {
    const fetchImpl = vi.fn();
    const c = createPerekClient({ apiKey: '  ', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(c.enabled).toBe(false);
    const r = await c.barcode(EAN);
    expect(r).toMatchObject({ status: 'error', code: 'disabled' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expectSafe(r);
  });
});

describe('поиск', () => {
  it('передаёт ключ только в заголовке и разбирает ответ', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://perek.us/api/v1/foods/search?q=%D0%BA%D0%B5%D1%84%D0%B8%D1%80&limit=5&market=ru');
      expect(String(url)).not.toContain(KEY);
      expect((init?.headers as Record<string, string>)['X-Api-Key']).toBe(KEY);
      return json(200, { query: 'кефир', similar: false, offset: 0, more: true, foods: [sampleFood] });
    });
    const r = await client(fetchImpl as typeof fetch).search('кефир', 5);
    expect(r).toEqual({
      status: 'ok',
      exact: true,
      hasMore: true,
      foods: [
        {
          provider: 'perek',
          externalId: 'food-1',
          name: 'Кефир 2,5%',
          brand: 'Тестовый бренд',
          basis: 'ml',
          per100: { kcal: 53, protein: 2.9, fat: 2.5, carbs: 4 },
          url: 'https://perek.us/food/kefir',
          license: undefined,
          barcode: undefined,
          servings: [{ label: 'стакан', grams: 200 }],
        },
      ],
    });
    expectSafe(r);
  });

  it('помечает похожие результаты как неточные', async () => {
    const r = await client(async () => json(200, { similar: true, foods: [sampleFood] })).search('кифир', 5);
    expect(r).toMatchObject({ status: 'ok', exact: false });
  });

  it('пропускает продукты с неизвестной единицей и битыми значениями', async () => {
    const r = await client(async () =>
      json(200, {
        foods: [sampleFood, { ...sampleFood, id: 'x', unit: 'шт' }, { ...sampleFood, id: 'y', per100: { kcal: -1 } }],
      }),
    ).search('кефир', 5);
    expect(r.status === 'ok' && r.foods.map((f) => f.externalId)).toEqual(['food-1']);
  });

  it('не пропускает посторонние ссылки в атрибуцию', async () => {
    const r = await client(async () => json(200, { foods: [{ ...sampleFood, url: 'javascript:alert(1)' }] })).search('кефир', 5);
    expect(r.status === 'ok' && r.foods[0]?.url).toBeUndefined();
  });

  it('кэширует повторный запрос', async () => {
    const fetchImpl = vi.fn(async () => json(200, { foods: [sampleFood] }));
    const c = client(fetchImpl as unknown as typeof fetch);
    await c.search('Кефир', 5);
    await c.search('кефир', 5);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('штрихкод', () => {
  it('принимает карточку на верхнем уровне', async () => {
    const r = await client(async () => json(200, sampleFood)).barcode(EAN);
    expect(r).toMatchObject({ status: 'ok', exact: true, foods: [{ externalId: 'food-1', barcode: EAN }] });
  });

  it('принимает карточку в поле food или foods', async () => {
    expect((await client(async () => json(200, { food: sampleFood })).barcode(EAN)).status).toBe('ok');
    expect((await client(async () => json(200, { foods: [sampleFood] })).barcode(EAN)).status).toBe('ok');
  });

  it('404 без данных — not_found, с названием товара, если оно известно', async () => {
    const r1 = await client(async () => json(404, { error: 'not_found' })).barcode(EAN);
    expect(r1).toMatchObject({ status: 'error', code: 'not_found' });
    const r2 = await client(async () => json(404, { product: { name: 'Сырок' } })).barcode(EAN);
    expect(r2).toMatchObject({ status: 'error', code: 'not_found', productName: 'Сырок' });
    expectSafe(r2);
  });

  it('404 без тела тоже обрабатывается', async () => {
    const r = await client(async () => new Response(null, { status: 404 })).barcode(EAN);
    expect(r).toMatchObject({ status: 'error', code: 'not_found' });
  });

  it('429 — rate_limited с Retry-After и паузой без новых запросов', async () => {
    let t = 1_000_000;
    const fetchImpl = vi.fn(async () => json(429, { error: 'limit' }, { 'Retry-After': '30' }));
    const c = client(fetchImpl as unknown as typeof fetch, { now: () => t });
    const r = await c.barcode(EAN);
    expect(r).toMatchObject({ status: 'error', code: 'rate_limited', retryAfterSec: 30 });
    t += 10_000;
    const again = await c.barcode('96385074');
    expect(again).toMatchObject({ code: 'rate_limited', retryAfterSec: 20 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expectSafe(r);
  });

  it('сетевая ошибка — network', async () => {
    const r = await client(async () => {
      throw new TypeError('fetch failed');
    }).barcode(EAN);
    expect(r).toMatchObject({ status: 'error', code: 'network' });
    expectSafe(r);
  });

  it('тайм-аут — timeout', async () => {
    const r = await client(async () => {
      throw new DOMException('The operation timed out', 'TimeoutError');
    }).barcode(EAN);
    expect(r).toMatchObject({ status: 'error', code: 'timeout' });
  });

  it('настоящий тайм-аут прерывает зависший запрос', async () => {
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      })) as unknown as typeof fetch;
    const r = await client(hanging, { timeoutMs: 20 }).barcode(EAN);
    expect(r).toMatchObject({ status: 'error', code: 'timeout' });
  });

  it('повреждённый JSON и неожиданный формат — bad_response', async () => {
    const broken = await client(async () => new Response('<html>oops', { status: 200 })).barcode(EAN);
    expect(broken).toMatchObject({ status: 'error', code: 'bad_response' });
    const weird = await client(async () => json(200, { hello: 'world' })).barcode(EAN);
    expect(weird).toMatchObject({ status: 'error', code: 'bad_response' });
    const weirdSearch = await client(async () => json(200, { foods: 'nope' })).search('кефир', 5);
    expect(weirdSearch).toMatchObject({ status: 'error', code: 'bad_response' });
  });

  it('401/403 — auth_failed, 500 — upstream_error', async () => {
    expect(await client(async () => json(401, {})).barcode(EAN)).toMatchObject({ code: 'auth_failed' });
    expect(await client(async () => json(403, {})).barcode(EAN)).toMatchObject({ code: 'auth_failed' });
    expect(await client(async () => json(500, {})).barcode(EAN)).toMatchObject({ code: 'upstream_error' });
  });

  it('собственный лимит запросов в минуту', async () => {
    const fetchImpl = vi.fn(async () => json(404, {}));
    const c = client(fetchImpl as unknown as typeof fetch, { maxRequestsPerMinute: 2, now: () => 5_000_000 });
    await c.search('аа', 5);
    await c.search('бб', 5);
    const r = await c.search('вв', 5);
    expect(r).toMatchObject({ status: 'error', code: 'rate_limited' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('parseRetryAfter', () => {
  it('понимает секунды и HTTP-дату', () => {
    expect(parseRetryAfter('120', 0)).toBe(120);
    expect(parseRetryAfter(new Date(60_000).toUTCString(), 0)).toBe(60);
    expect(parseRetryAfter(null, 0)).toBeUndefined();
    expect(parseRetryAfter('later', 0)).toBeUndefined();
  });
});
