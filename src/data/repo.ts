// Операции с локальными данными. Интерфейс и расчёты не обращаются к Dexie напрямую
// для записи — только через эти функции, чтобы позднее можно было подменить хранилище
// (например, добавить синхронизацию с сервером) без переписывания страниц.
import type { Table } from 'dexie';
import { APP_VERSION } from '../appVersion.ts';
import { type Backup, type BackupData, createBackup } from '../domain/backup.ts';
import { type FieldErrors, toFieldErrors } from '../domain/form.ts';
import { newId } from '../domain/ids.ts';
import { ENTITY_SCHEMAS, TABLE_NAMES, type EntityOf, type Exercise, type TableName } from '../domain/schemas.ts';
import { db } from './db.ts';

export type EntityTableName = Exclude<TableName, 'settings'>;
type Meta = 'id' | 'createdAt' | 'updatedAt';
export type DraftOf<K extends EntityTableName> = Omit<EntityOf<K>, Meta>;

export type SaveResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

function table<K extends EntityTableName>(name: K): Table<EntityOf<K>, string> {
  return db.table(name);
}

/**
 * Проверяет черновик записи и добавляет служебные поля.
 * existing — ранее сохранённая запись при редактировании (id и дата создания сохраняются).
 */
export function prepareEntity<K extends EntityTableName>(
  name: K,
  draft: DraftOf<K>,
  existing?: { id: string; createdAt: string },
  now: Date = new Date(),
): SaveResult<EntityOf<K>> {
  const stamp = now.toISOString();
  const candidate = {
    ...draft,
    id: existing?.id ?? newId(),
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
  const r = ENTITY_SCHEMAS[name].safeParse(candidate);
  if (!r.success) return { ok: false, errors: toFieldErrors(r.error, candidate) };
  return { ok: true, value: r.data as EntityOf<K> };
}

export async function saveEntity<K extends EntityTableName>(
  name: K,
  draft: DraftOf<K>,
  existing?: { id: string; createdAt: string },
): Promise<SaveResult<EntityOf<K>>> {
  const prepared = prepareEntity(name, draft, existing);
  if (prepared.ok) await table(name).put(prepared.value);
  return prepared;
}

export async function deleteEntity(name: EntityTableName, id: string): Promise<void> {
  await table(name).delete(id);
}

/** Находит упражнение по названию (без учёта регистра) или создаёт новое. */
export async function ensureExercise(name: string): Promise<Exercise> {
  const clean = name.trim().replace(/\s+/g, ' ');
  const lower = clean.toLocaleLowerCase('ru-RU');
  const found = await db.exercises.filter((e) => e.name.toLocaleLowerCase('ru-RU') === lower).first();
  if (found) return found;
  const r = await saveEntity('exercises', { name: clean });
  if (!r.ok) throw new Error(Object.values(r.errors)[0] ?? 'Некорректное название упражнения');
  return r.value;
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key);
}

export async function exportAll(now: Date = new Date()): Promise<Backup> {
  const entries = await db.transaction('r', TABLE_NAMES, () =>
    Promise.all(TABLE_NAMES.map(async (t) => [t, await db.table(t).toArray()] as const)),
  );
  return createBackup(Object.fromEntries(entries) as BackupData, APP_VERSION, now);
}

export type ImportMode = 'merge' | 'replace';

/**
 * Записывает проверенную резервную копию одной транзакцией: при любой ошибке
 * база остаётся в прежнем состоянии.
 * merge — добавить и обновить записи с теми же id; replace — сначала очистить все таблицы.
 */
export async function importBackup(backup: Backup, mode: ImportMode): Promise<void> {
  await db.transaction('rw', TABLE_NAMES, async () => {
    for (const t of TABLE_NAMES) {
      const tbl = db.table(t);
      if (mode === 'replace') await tbl.clear();
      await tbl.bulkPut(backup.data[t] as unknown[]);
    }
  });
}

export async function countAll(): Promise<number> {
  const counts = await Promise.all(TABLE_NAMES.map((t) => db.table(t).count()));
  return counts.reduce((a, b) => a + b, 0);
}
