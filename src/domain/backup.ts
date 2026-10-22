// Резервная копия: экспорт всех локальных таблиц в JSON и строгая проверка при импорте.
// Импорт выполняется по принципу «всё или ничего»: одна некорректная запись — и файл отклоняется.
import {
  ENTITY_SCHEMAS,
  TABLE_LABELS,
  TABLE_NAMES,
  type EntityOf,
  type TableName,
} from './schemas.ts';
import { toLocalInputValue } from './time.ts';

export const BACKUP_FORMAT = 'personal-athlete-os-backup';
/**
 * Версия структуры данных. Совпадает с версией схемы IndexedDB (src/data/db.ts).
 * При изменении структуры: увеличить, добавить миграцию в migrateBackupData и в db.ts.
 */
export const DATA_SCHEMA_VERSION = 2;
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
const MAX_REPORTED_ERRORS = 20;

export type BackupData = { [K in TableName]: EntityOf<K>[] };

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  data: BackupData;
}

export function createBackup(data: BackupData, appVersion: string, now: Date = new Date()): Backup {
  return { format: BACKUP_FORMAT, schemaVersion: DATA_SCHEMA_VERSION, exportedAt: now.toISOString(), appVersion, data };
}

/** Имя файла с датой и временем по часовому поясу приложения: athlete-os-backup-2026-10-22-00-19.json */
export function backupFileName(now: Date = new Date()): string {
  const stamp = toLocalInputValue(now.toISOString()).replace(/[:T]/g, '-');
  return `athlete-os-backup-${stamp}.json`;
}

export type BackupCounts = Record<TableName, number>;

export type ParseBackupResult =
  | { ok: true; backup: Backup; counts: BackupCounts; total: number }
  | { ok: false; errors: string[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Шаги миграции копий: ключ — версия, из которой выполняется переход на следующую. */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 → 2: появилась таблица воды; расширенные нутриенты необязательны, старые записи не меняются.
  1: (data) => ({ ...data, water: data.water ?? [] }),
};

/** Приведение данных старых версий к текущей: шаги применяются по очереди. */
function migrateBackupData(data: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  let result = data;
  for (let v = fromVersion; v < DATA_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`Нет миграции для версии ${v}`);
    result = step(result);
  }
  return result;
}

export function parseBackup(text: string): ParseBackupResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, errors: ['Файл слишком большой (больше 50 МБ)'] };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Файл не является корректным JSON'] };
  }

  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, errors: ['Это не резервная копия Personal Athlete OS'] };
  }
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, errors: ['Не указана или некорректна версия резервной копии'] };
  }
  if (version > DATA_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Копия создана более новой версией приложения (схема ${version}). Обновите приложение.`],
    };
  }
  if (typeof raw.exportedAt !== 'string' || Number.isNaN(Date.parse(raw.exportedAt))) {
    return { ok: false, errors: ['Некорректная дата создания копии'] };
  }
  if (!isObject(raw.data)) return { ok: false, errors: ['В файле нет раздела data'] };

  let data: Record<string, unknown>;
  try {
    data = migrateBackupData(raw.data, version);
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }

  const errors: string[] = [];
  const result = {} as Record<TableName, unknown[]>;
  const unknownTables = Object.keys(data).filter((k) => !(TABLE_NAMES as string[]).includes(k));
  if (unknownTables.length) errors.push(`Неизвестные разделы: ${unknownTables.join(', ')}`);

  for (const table of TABLE_NAMES) {
    const rows = data[table] ?? [];
    if (!Array.isArray(rows)) {
      errors.push(`${TABLE_LABELS[table]}: ожидался список записей`);
      continue;
    }
    const schema = ENTITY_SCHEMAS[table];
    const seen = new Set<string>();
    const parsed: unknown[] = [];
    rows.forEach((row, i) => {
      const r = schema.safeParse(row);
      if (!r.success) {
        const issue = r.error.issues[0];
        const path = issue?.path.length ? `${issue.path.join('.')}: ` : '';
        errors.push(`${TABLE_LABELS[table]}, запись ${i + 1}: ${path}${issue?.message ?? 'ошибка'}`);
        return;
      }
      const key = table === 'settings' ? (r.data as { key: string }).key : (r.data as { id: string }).id;
      if (seen.has(key)) errors.push(`${TABLE_LABELS[table]}, запись ${i + 1}: повторяющийся идентификатор`);
      seen.add(key);
      parsed.push(r.data);
    });
    result[table] = parsed;
  }

  if (errors.length) {
    const extra = errors.length - MAX_REPORTED_ERRORS;
    return {
      ok: false,
      errors: extra > 0 ? [...errors.slice(0, MAX_REPORTED_ERRORS), `…и ещё ошибок: ${extra}`] : errors,
    };
  }

  const counts = Object.fromEntries(TABLE_NAMES.map((t) => [t, result[t].length])) as BackupCounts;
  return {
    ok: true,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    backup: {
      format: BACKUP_FORMAT,
      schemaVersion: DATA_SCHEMA_VERSION,
      exportedAt: raw.exportedAt,
      appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : 'unknown',
      data: result as BackupData,
    },
  };
}
