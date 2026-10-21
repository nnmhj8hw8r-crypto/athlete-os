// Локальный каталог продуктов: поиск и сохранение продуктов из внешней базы.
import type { CatalogFood } from '../../shared/catalog.ts';
import type { Food } from '../domain/schemas.ts';
import { db } from './db.ts';
import { saveEntity } from './repo.ts';

/**
 * Сохраняет продукт из внешней базы в свой каталог, чтобы использовать его без сети.
 * Повторное сохранение того же продукта обновляет запись, а не создаёт дубликат.
 */
export async function saveCatalogFood(cf: CatalogFood): Promise<Food> {
  const existing = await db.foods
    .where('externalId')
    .equals(cf.externalId)
    .filter((f) => f.source === cf.provider)
    .first();
  const barcode = cf.barcode && /^\d{8,14}$/.test(cf.barcode) ? cf.barcode : existing?.barcode;
  const r = await saveEntity(
    'foods',
    {
      name: cf.name,
      brand: cf.brand,
      basis: cf.basis,
      per100: cf.per100,
      source: 'perek',
      sourceNote: 'Perek.us',
      sourceUrl: cf.url,
      externalId: cf.externalId,
      license: cf.license,
      barcode,
    },
    existing,
  );
  if (!r.ok) throw new Error(`Продукт не прошёл проверку: ${Object.values(r.errors)[0] ?? 'ошибка'}`);
  return r.value;
}

export async function findFoodByBarcode(ean: string): Promise<Food | undefined> {
  return db.foods.where('barcode').equals(ean).first();
}

/** Поиск по названию и бренду без учёта регистра; новые и изменённые — выше. */
export function filterFoods(foods: readonly Food[], query: string): Food[] {
  const q = query.trim().toLocaleLowerCase('ru-RU');
  const list = q
    ? foods.filter((f) => `${f.name} ${f.brand ?? ''}`.toLocaleLowerCase('ru-RU').includes(q))
    : [...foods];
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
