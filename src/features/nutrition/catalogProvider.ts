// Внешние продуктовые базы. Дневник питания работает с любым провайдером через этот интерфейс,
// поэтому новый источник добавляется без переписывания страниц.
// Perek.us идёт через наш сервер (ключ), Open Food Facts — напрямую из браузера.
// Локальный каталог (IndexedDB) провайдером не является — он доступен всегда, в том числе офлайн.
import {
  catalogHealthSchema,
  catalogResponseSchema,
  type CatalogErrorResponse,
  type CatalogProviderId,
  type CatalogResponse,
} from '../../../shared/catalog.ts';
import { loadOfflineBase, offlineToCatalogFood } from '../../data/offlineBase.ts';
import { offLookupBarcode } from './openFoodFacts.ts';

export type ProviderStatus =
  | { available: true }
  | { available: false; reason: 'disabled' | 'offline' | 'server_unavailable'; message: string };

export interface FoodCatalogProvider {
  readonly id: string;
  /** Название для интерфейса. */
  readonly label: string;
  /** Подпись ссылки-атрибуции рядом с цифрами (требование условий источника). */
  readonly attribution: string;
  checkAvailability(signal?: AbortSignal): Promise<ProviderStatus>;
  searchByName(query: string, signal?: AbortSignal): Promise<CatalogResponse>;
  lookupBarcode(ean: string, signal?: AbortSignal): Promise<CatalogResponse>;
}

const OFFLINE_MESSAGE = 'Нет подключения к интернету. Выберите продукт из своего каталога или введите вручную.';
const SERVER_MESSAGE =
  'Поиск по названию работает только с сервером Perek.us, а эта версия приложения запущена без него. ' +
  'Штрихкоды при этом ищутся в Open Food Facts; ещё можно выбрать продукт из каталога или ввести вручную.';

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

async function getJson(url: string, signal?: AbortSignal): Promise<{ status: number; body: unknown } | CatalogErrorResponse> {
  if (isOffline()) return { status: 'error', code: 'network', message: OFFLINE_MESSAGE };
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    return { status: res.status, body };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { status: 'error', code: 'network', message: isOffline() ? OFFLINE_MESSAGE : SERVER_MESSAGE };
  }
}

async function catalogRequest(url: string, signal?: AbortSignal): Promise<CatalogResponse> {
  const r = await getJson(url, signal);
  if ('code' in r) return r;
  const parsed = catalogResponseSchema.safeParse(r.body);
  if (parsed.success) return parsed.data;
  return { status: 'error', code: 'bad_response', message: SERVER_MESSAGE };
}

export const perekProvider: FoodCatalogProvider = {
  id: 'perek',
  label: 'Perek.us',
  attribution: 'Данные: perek.us',

  async checkAvailability(signal) {
    if (isOffline()) return { available: false, reason: 'offline', message: OFFLINE_MESSAGE };
    const r = await getJson('/api/health', signal);
    if ('code' in r) return { available: false, reason: 'server_unavailable', message: r.message };
    const parsed = catalogHealthSchema.safeParse(r.body);
    if (!parsed.success) return { available: false, reason: 'server_unavailable', message: SERVER_MESSAGE };
    if (!parsed.data.perekEnabled) {
      return {
        available: false,
        reason: 'disabled',
        message:
          'Поиск в Perek.us не подключён: на сервере не задан ключ PEREK_API_KEY. ' +
          'Как подключить — в README, раздел «Perek.us». Пока можно вводить продукты вручную.',
      };
    }
    return { available: true };
  },

  searchByName(query, signal) {
    const params = new URLSearchParams({ q: query, limit: '10' });
    return catalogRequest(`/api/foods/search?${params}`, signal);
  },

  lookupBarcode(ean, signal) {
    return catalogRequest(`/api/foods/barcode/${encodeURIComponent(ean)}`, signal);
  },
};

export const offProvider: FoodCatalogProvider = {
  id: 'off',
  label: 'Open Food Facts',
  attribution: 'Данные: Open Food Facts (ODbL)',

  async checkAvailability() {
    return isOffline() ? { available: false, reason: 'offline', message: OFFLINE_MESSAGE } : { available: true };
  },

  async searchByName() {
    return { status: 'error', code: 'disabled', message: 'Поиск по названию в Open Food Facts из приложения недоступен — только по штрихкоду.' };
  },

  lookupBarcode: (ean, signal) => offLookupBarcode(ean, signal),
};

export const PROVIDER_ATTRIBUTION: Record<CatalogProviderId, string> = {
  perek: perekProvider.attribution,
  off: offProvider.attribution,
};

/**
 * Поиск по штрихкоду по цепочке: сначала Perek.us (точнее по российским товарам, но нужен
 * наш сервер с ключом), если он недоступен или товара там нет — Open Food Facts.
 */
export function chainBarcodeProviders(primary: FoodCatalogProvider, fallback: FoodCatalogProvider): FoodCatalogProvider {
  return {
    id: `${primary.id}+${fallback.id}`,
    label: `${primary.label} / ${fallback.label}`,
    attribution: primary.attribution,

    async checkAvailability(signal) {
      const first = await primary.checkAvailability(signal);
      return first.available ? first : fallback.checkAvailability(signal);
    },

    searchByName: (query, signal) => primary.searchByName(query, signal),

    async lookupBarcode(ean, signal) {
      const status = await primary.checkAvailability(signal);
      if (status.available) {
        const first = await primary.lookupBarcode(ean, signal);
        if (first.status === 'ok' && first.foods.length > 0) return first;
        const second = await fallback.lookupBarcode(ean, signal);
        if (second.status === 'ok') return second;
        // Не помог и второй источник: если первый хотя бы знает название товара, его ответ полезнее.
        if (first.status === 'error' && first.code === 'not_found' && first.productName && !second.productName) return first;
        return second;
      }
      return fallback.lookupBarcode(ean, signal);
    },
  };
}

/** Офлайн-база российских товаров (выгрузка OFF): работает без интернета. */
export const offlineProvider: FoodCatalogProvider = {
  id: 'offline',
  label: 'Офлайн-база (Open Food Facts)',
  attribution: offProvider.attribution,

  async checkAvailability() {
    return (await loadOfflineBase())
      ? { available: true }
      : { available: false, reason: 'server_unavailable', message: 'Офлайн-база товаров ещё не загружена.' };
  },

  async searchByName() {
    return { status: 'error', code: 'disabled', message: 'Поиск по названию в офлайн-базе выполняется в общем поиске.' };
  },

  async lookupBarcode(ean) {
    const p = (await loadOfflineBase())?.byCode.get(ean);
    return p
      ? { status: 'ok', exact: true, foods: [offlineToCatalogFood(p)] }
      : { status: 'error', code: 'not_found', message: 'В офлайн-базе такого штрихкода нет.' };
  },
};

/** Штрихкод: офлайн-база → Perek.us (если есть сервер) → Open Food Facts онлайн. */
export const barcodeCatalog = chainBarcodeProviders(offlineProvider, chainBarcodeProviders(perekProvider, offProvider));
