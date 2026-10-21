// Общий контракт для внешних продуктовых баз. Perek.us приводится к этому формату на сервере,
// Open Food Facts — прямо в браузере; клиент проверяет результат той же схемой.
import { z } from 'zod';

export const nutrientBasisSchema = z.enum(['g', 'ml']);
export type NutrientBasis = z.infer<typeof nutrientBasisSchema>;

const nonNegative = z.number().finite().nonnegative('Не может быть отрицательным');

export const per100Schema = z.object({
  kcal: nonNegative,
  protein: nonNegative,
  fat: nonNegative,
  carbs: nonNegative,
});
export type Per100 = z.infer<typeof per100Schema>;

export const catalogProviderIdSchema = z.enum(['perek', 'off']);
export type CatalogProviderId = z.infer<typeof catalogProviderIdSchema>;

export const catalogFoodSchema = z.object({
  provider: catalogProviderIdSchema,
  externalId: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  basis: nutrientBasisSchema,
  per100: per100Schema,
  /** Страница продукта у источника. Perek.us (бесплатный тариф) и Open Food Facts (ODbL) требуют ссылку рядом с цифрами. */
  url: z.string().optional(),
  license: z.string().optional(),
  barcode: z.string().optional(),
  servings: z.array(z.object({ label: z.string(), grams: nonNegative })).optional(),
});
export type CatalogFood = z.infer<typeof catalogFoodSchema>;

export const catalogErrorCodeSchema = z.enum([
  'disabled',
  'invalid_request',
  'not_found',
  'rate_limited',
  'auth_failed',
  'timeout',
  'network',
  'bad_response',
  'upstream_error',
]);
export type CatalogErrorCode = z.infer<typeof catalogErrorCodeSchema>;

export const catalogResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** false — провайдер вернул похожие, а не точные совпадения. */
    exact: z.boolean(),
    foods: z.array(catalogFoodSchema),
    hasMore: z.boolean().optional(),
  }),
  z.object({
    status: z.literal('error'),
    code: catalogErrorCodeSchema,
    message: z.string(),
    retryAfterSec: z.number().optional(),
    /** Для 404 по штрихкоду: товар известен, но пищевой ценности нет. */
    productName: z.string().optional(),
  }),
]);
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type CatalogErrorResponse = Extract<CatalogResponse, { status: 'error' }>;

export const catalogHealthSchema = z.object({
  ok: z.literal(true),
  perekEnabled: z.boolean(),
});
export type CatalogHealth = z.infer<typeof catalogHealthSchema>;

/** HTTP-код, которым локальный сервер отвечает на каждую ошибку. */
export const ERROR_HTTP_STATUS: Record<CatalogErrorCode, number> = {
  disabled: 503,
  invalid_request: 400,
  not_found: 404,
  rate_limited: 429,
  auth_failed: 502,
  timeout: 504,
  network: 502,
  bad_response: 502,
  upstream_error: 502,
};
