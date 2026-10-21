import { describe, expect, it, vi } from 'vitest';
import { catalogResponseSchema, type CatalogResponse } from '../../../shared/catalog.ts';
import { chainBarcodeProviders, type FoodCatalogProvider } from './catalogProvider.ts';
import { normalizeOffProduct, offLookupBarcode, parseOffBarcodeBody } from './openFoodFacts.ts';

const EAN = '4620014250831';

// Сокращённый реальный ответ /api/v2/product/{ean}.json
const kefir = {
  code: EAN,
  product_name: 'Кефир',
  brands: 'Тестовый бренд, Другой',
  product_quantity_unit: 'ml',
  nutriments: { 'energy-kcal_100g': 51, proteins_100g: 2.8, fat_100g: 2.5, carbohydrates_100g: 4 },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const expectContract = (r: unknown) => expect(catalogResponseSchema.safeParse(r).success).toBe(true);

describe('Open Food Facts: разбор карточки', () => {
  it('берёт значения на 100 мл, первый бренд и ссылку на источник', () => {
    const { food } = normalizeOffProduct(kefir, EAN);
    expect(food).toMatchObject({
      provider: 'off',
      name: 'Кефир',
      brand: 'Тестовый бренд',
      basis: 'ml',
      per100: { kcal: 51, protein: 2.8, fat: 2.5, carbs: 4 },
      barcode: EAN,
      license: 'ODbL',
      url: `https://world.openfoodfacts.org/product/${EAN}`,
    });
  });

  it('предпочитает русское название', () => {
    expect(normalizeOffProduct({ ...kefir, product_name_ru: 'Кефир 2,5%' }, EAN).food?.name).toBe('Кефир 2,5%');
  });

  it('определяет жидкость по количеству, если единица не указана', () => {
    const rest = { ...kefir, product_quantity_unit: undefined };
    expect(normalizeOffProduct({ ...rest, quantity: '930 мл' }, EAN).food?.basis).toBe('ml');
    expect(normalizeOffProduct({ ...rest, quantity: '400 г' }, EAN).food?.basis).toBe('g');
  });

  it('пересчитывает кДж в ккал, если ккал нет', () => {
    const n = { 'energy-kj_100g': 418.4, proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 1 };
    expect(normalizeOffProduct({ ...kefir, nutriments: n }, EAN).food?.per100.kcal).toBe(100);
  });

  it('не подставляет ноль вместо отсутствующего показателя', () => {
    const n = { 'energy-kcal_100g': 51, proteins_100g: 2.8, fat_100g: 2.5 };
    const r = normalizeOffProduct({ ...kefir, nutriments: n }, EAN);
    expect(r.food).toBeNull();
    expect(r.name).toBe('Кефир');
  });

  it('отбрасывает противоречивые данные (Б+Ж+У > 100 г на 100 г)', () => {
    const n = { 'energy-kcal_100g': 500, proteins_100g: 60, fat_100g: 30, carbohydrates_100g: 20 };
    expect(normalizeOffProduct({ ...kefir, product_quantity_unit: 'g', nutriments: n }, EAN).food).toBeNull();
  });

  it('не падает на мусоре в полях', () => {
    expect(normalizeOffProduct({ ...kefir, brands: 42, nutriments: { proteins_100g: 'x' } }, EAN).food).toBeNull();
  });
});

describe('Open Food Facts: ответы API', () => {
  it('найденный товар', () => {
    const r = parseOffBarcodeBody(200, { status: 1, product: kefir }, EAN);
    expectContract(r);
    expect(r.status === 'ok' && r.foods[0]?.name).toBe('Кефир');
  });

  it('404 и status 0 — «не найдено»', () => {
    for (const r of [parseOffBarcodeBody(404, { status: 0 }, EAN), parseOffBarcodeBody(200, { status: 0 }, EAN)]) {
      expectContract(r);
      expect(r.status === 'error' && r.code).toBe('not_found');
    }
  });

  it('товар без пищевой ценности — «не найдено» с названием для ручного ввода', () => {
    const r = parseOffBarcodeBody(200, { status: 1, product: { product_name: 'Сырок' } }, EAN);
    expectContract(r);
    expect(r).toMatchObject({ status: 'error', code: 'not_found', productName: 'Сырок' });
  });

  it('429, 5xx и непонятный ответ', () => {
    expect(parseOffBarcodeBody(429, undefined, EAN)).toMatchObject({ code: 'rate_limited' });
    expect(parseOffBarcodeBody(503, undefined, EAN)).toMatchObject({ code: 'upstream_error' });
    expect(parseOffBarcodeBody(200, 'oops', EAN)).toMatchObject({ code: 'bad_response' });
  });

  it('запрашивает только нужные поля по штрихкоду', async () => {
    const fetchImpl = vi.fn(async () => json(200, { status: 1, product: kefir }));
    const r = await offLookupBarcode(EAN, undefined, { fetchImpl: fetchImpl as typeof fetch });
    expect(r.status).toBe('ok');
    const url = String((fetchImpl.mock.calls[0] as unknown[])[0]);
    expect(url).toContain(`/api/v2/product/${EAN}.json?fields=`);
  });

  it('сетевая ошибка и тайм-аут не бросают исключение', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await offLookupBarcode(EAN, undefined, { fetchImpl: failing as typeof fetch })).toMatchObject({ code: 'network' });

    const hanging = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    expect(await offLookupBarcode(EAN, undefined, { fetchImpl: hanging as unknown as typeof fetch, timeoutMs: 10 })).toMatchObject({ code: 'timeout' });
  });
});

describe('Цепочка баз по штрихкоду', () => {
  const ok = (provider: 'perek' | 'off'): CatalogResponse => ({
    status: 'ok',
    exact: true,
    foods: [{ provider, externalId: '1', name: provider, basis: 'g', per100: { kcal: 1, protein: 0, fat: 0, carbs: 0 } }],
  });
  const notFound = (productName?: string): CatalogResponse => ({ status: 'error', code: 'not_found', message: 'нет', ...(productName ? { productName } : {}) });

  function fake(id: string, available: boolean, barcode: CatalogResponse): FoodCatalogProvider & { lookupBarcode: ReturnType<typeof vi.fn> } {
    return {
      id,
      label: id,
      attribution: id,
      checkAvailability: async () => (available ? { available: true } : { available: false, reason: 'server_unavailable', message: 'нет сервера' }),
      searchByName: async () => notFound(),
      lookupBarcode: vi.fn(async () => barcode),
    };
  }

  it('берёт первый источник, если товар там есть', async () => {
    const off = fake('off', true, ok('off'));
    const r = await chainBarcodeProviders(fake('perek', true, ok('perek')), off).lookupBarcode(EAN);
    expect(r.status === 'ok' && r.foods[0]?.provider).toBe('perek');
    expect(off.lookupBarcode).not.toHaveBeenCalled();
  });

  it('идёт во второй источник, если в первом не нашлось', async () => {
    const r = await chainBarcodeProviders(fake('perek', true, notFound()), fake('off', true, ok('off'))).lookupBarcode(EAN);
    expect(r.status === 'ok' && r.foods[0]?.provider).toBe('off');
  });

  it('без сервера сразу использует второй источник', async () => {
    const perek = fake('perek', false, ok('perek'));
    const r = await chainBarcodeProviders(perek, fake('off', true, ok('off'))).lookupBarcode(EAN);
    expect(r.status === 'ok' && r.foods[0]?.provider).toBe('off');
    expect(perek.lookupBarcode).not.toHaveBeenCalled();
  });

  it('если не нашлось нигде, сохраняет известное первому источнику название', async () => {
    const r = await chainBarcodeProviders(fake('perek', true, notFound('Сырок')), fake('off', true, notFound())).lookupBarcode(EAN);
    expect(r).toMatchObject({ code: 'not_found', productName: 'Сырок' });
  });
});
