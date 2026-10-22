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

/**
 * Расширенные нутриенты на 100 г/мл. Любое поле может отсутствовать: «нет данных» ≠ 0.
 * Единицы: г — сахара, клетчатка, жиры, омега-3, вода; мг — холестерин, натрий, калий, кальций,
 * железо, магний; мкг — витамин D.
 */
export const EXTRA_KEYS = [
  'sugars',
  'addedSugars',
  'fiber',
  'satFat',
  'monoFat',
  'polyFat',
  'transFat',
  'omega3',
  'cholesterol',
  'sodium',
  'potassium',
  'calcium',
  'iron',
  'magnesium',
  'vitD',
  'water',
] as const;
export type ExtraKey = (typeof EXTRA_KEYS)[number];
export const extraSchema = z.object(
  Object.fromEntries(EXTRA_KEYS.map((k) => [k, z.number().finite().nonnegative().max(100_000).optional()])) as Record<
    ExtraKey,
    z.ZodOptional<z.ZodNumber>
  >,
);
export type Extra = Partial<Record<ExtraKey, number>>;

export const catalogProviderIdSchema = z.enum(['perek', 'off']);
export type CatalogProviderId = z.infer<typeof catalogProviderIdSchema>;

export const catalogFoodSchema = z.object({
  provider: catalogProviderIdSchema,
  externalId: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  basis: nutrientBasisSchema,
  per100: per100Schema,
  extra: extraSchema.optional(),
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
    /** Товар известен, но данные неполные: что есть — подставляется в форму ручного ввода. */
    partial: z
      .object({
        brand: z.string().optional(),
        basis: nutrientBasisSchema.optional(),
        per100: per100Schema.partial(),
        url: z.string().optional(),
      })
      .optional(),
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
