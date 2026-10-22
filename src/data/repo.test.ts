// CRUD всех разделов и резервная копия на настоящем движке IndexedDB (fake-indexeddb в Node).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DATA_SCHEMA_VERSION, parseBackup } from '../domain/backup.ts';
import { TABLE_NAMES } from '../domain/schemas.ts';
import { drafts } from '../test/fixtures.ts';
import Dexie from 'dexie';
import { db, openDb } from './db.ts';
import {
  type EntityTableName,
  countAll,
  deleteEntity,
  ensureExercise,
  exportAll,
  getSetting,
  importBackup,
  saveEntity,
  setSetting,
} from './repo.ts';

beforeEach(async () => {
  await Promise.all(TABLE_NAMES.map((t) => db.table(t).clear()));
});

const entityTables = Object.keys(drafts) as EntityTableName[];

describe('CRUD всех разделов', () => {
  it.each(entityTables)('%s: создание, чтение, изменение, удаление', async (name) => {
    const created = await saveEntity(name, drafts[name] as never);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const stored = await db.table(name).get(created.value.id);
    expect(stored).toEqual(created.value);

    await new Promise((r) => setTimeout(r, 2));
    const updated = await saveEntity(name, { ...drafts[name], notes: 'изменено' } as never, created.value);
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.id).toBe(created.value.id);
    expect(updated.value.createdAt).toBe(created.value.createdAt);
    expect(updated.value.updatedAt > created.value.updatedAt).toBe(true);
    expect(await db.table(name).count()).toBe(1);

    await deleteEntity(name, created.value.id);
    expect(await db.table(name).get(created.value.id)).toBeUndefined();
  });
});

describe('проверка данных при сохранении', () => {
  it('не сохраняет некорректную запись и возвращает ошибки полей', async () => {
    const r = await saveEntity('foods', { ...drafts.foods, name: '', per100: { ...drafts.foods.per100, kcal: -1 } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBe('Укажите название');
      expect(r.errors['per100.kcal']).toBeDefined();
    }
    expect(await db.foods.count()).toBe(0);
  });

  it('сообщает о пустом обязательном числовом поле', async () => {
    const r = await saveEntity('bodyWeights', { ...drafts.bodyWeights, weightKg: undefined as unknown as number });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.weightKg).toBe('Заполните поле');
  });

  it('запись питания хранит снимок и не меняется при изменении продукта', async () => {
    const food = await saveEntity('foods', drafts.foods);
    if (!food.ok) throw new Error('food');
    const meal = await saveEntity('meals', { ...drafts.meals, foodId: food.value.id });
    if (!meal.ok) throw new Error('meal');
    await saveEntity('foods', { ...drafts.foods, per100: { kcal: 1, protein: 0, fat: 0, carbs: 0 } }, food.value);
    expect((await db.meals.get(meal.value.id))?.nutrients.kcal).toBe(274.4);
    await deleteEntity('foods', food.value.id);
    expect(await db.meals.get(meal.value.id)).toBeDefined();
  });
});

describe('упражнения и настройки', () => {
  it('ensureExercise не создаёт дубликаты без учёта регистра и пробелов', async () => {
    const a = await ensureExercise('Жим  лёжа');
    const b = await ensureExercise('жим лёжа');
    expect(b.id).toBe(a.id);
    expect(a.name).toBe('Жим лёжа');
    expect(await db.exercises.count()).toBe(1);
  });

  it('настройки сохраняются и читаются', async () => {
    await setSetting('pendingSleepStart', '2026-10-20T20:30:00.000Z');
    expect(await getSetting<string>('pendingSleepStart')).toBe('2026-10-20T20:30:00.000Z');
  });
});

describe('резервная копия', () => {
  async function fillAll() {
    for (const name of entityTables) await saveEntity(name, drafts[name] as never);
    await setSetting('x', 1);
  }

  it('экспорт → импорт с заменой восстанавливает все данные', async () => {
    await fillAll();
    const backup = await exportAll();
    expect(backup.schemaVersion).toBe(DATA_SCHEMA_VERSION);
    const text = JSON.stringify(backup);

    await Promise.all(TABLE_NAMES.map((t) => db.table(t).clear()));
    await saveEntity('foods', { ...drafts.foods, name: 'Лишний продукт' });

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await importBackup(parsed.backup, 'replace');

    expect(await countAll()).toBe(entityTables.length + 1);
    expect(await db.foods.filter((f) => f.name === 'Лишний продукт').count()).toBe(0);
    expect((await exportAll()).data).toEqual(backup.data);
  });

  it('импорт с объединением сохраняет существующие записи', async () => {
    await fillAll();
    const backup = await exportAll();
    await Promise.all(TABLE_NAMES.map((t) => db.table(t).clear()));
    await saveEntity('foods', { ...drafts.foods, name: 'Свой продукт' });

    await importBackup(backup, 'merge');
    expect(await db.foods.count()).toBe(2);
  });

  it('обновление базы 2 → 3 переносит шаблоны в программы', async () => {
    const name = 'upgrade-test-db';
    const old = new Dexie(name);
    old.version(1).stores({ workoutTemplates: 'id, name', workouts: 'id, startAt, type, templateId' });
    old.version(2).stores({ water: 'id, date' });
    const tpl = { ...drafts.workoutTemplates, id: 't-old', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
    await old.table('workoutTemplates').put(tpl);
    old.close();

    const upgraded = openDb(name);
    const programs = await upgraded.programs.toArray();
    expect(programs).toHaveLength(1);
    expect(programs[0]).toMatchObject({ id: 't-old', name: 'Тестовый шаблон', items: [{ exerciseId: 'ex-1', sets: 3 }] });
    expect(await upgraded.workoutTemplates.count()).toBe(1);
    upgraded.close();
    await Dexie.delete(name);
  });

  it('схема IndexedDB совпадает с версией формата копии', async () => {
    await db.open();
    expect(db.verno).toBe(DATA_SCHEMA_VERSION);
  });
});
