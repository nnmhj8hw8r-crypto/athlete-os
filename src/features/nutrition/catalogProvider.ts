// Внешние продуктовые базы. Дневник питания работает с любым провайдером через этот интерфейс,
// поэтому второй источник (например, Open Food Facts) добавляется без переписывания страниц:
// нужен серверный адаптер, приводящий ответ к CatalogResponse, и ещё одна реализация ниже.
// Локальный каталог (IndexedDB) провайдером не является — он доступен всегда, в том числе офлайн.
import {
  catalogHealthSchema,
  catalogResponseSchema,
  type CatalogErrorResponse,
  type CatalogResponse,
} from '../../../shared/catalog.ts';

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
  'Сервер поиска продуктов не отвечает. Возможно, приложение запущено без серверной части. ' +
  'Дневник работает и без него: выберите продукт из каталога или введите вручную.';

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
