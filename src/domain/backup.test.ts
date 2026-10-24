import { describe, expect, it } from 'vitest';
import { drafts } from '../test/fixtures.ts';
import { BACKUP_FORMAT, DATA_SCHEMA_VERSION, type BackupData, backupFileName, createBackup, parseBackup } from './backup.ts';

const meta = { createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z' };

function fullData(): BackupData {
  return {
    foods: [{ ...drafts.foods, id: 'f1', ...meta }],
    meals: [{ ...drafts.meals, id: 'm1', ...meta }],
    workouts: [{ ...drafts.workouts, id: 'w1', ...meta }],
    exercises: [{ ...drafts.exercises, id: 'e1', ...meta }],
    workoutTemplates: [{ ...drafts.workoutTemplates, id: 't1', ...meta }],
    sleep: [{ ...drafts.sleep, id: 's1', ...meta }],
    competitions: [{ ...drafts.competitions, id: 'c1', ...meta }],
    bodyWeights: [{ ...drafts.bodyWeights, id: 'b1', ...meta }],
    supplements: [{ ...drafts.supplements, id: 'p1', ...meta }],
    sources: [{ ...drafts.sources, id: 'r1', ...meta }],
    water: [{ ...drafts.water, id: 'wa1', ...meta }],
    programs: [{ ...drafts.programs, id: 'pr1', ...meta }],
    schedule: [{ ...drafts.schedule, id: 'sc1', ...meta }],
    testDefs: [{ ...drafts.testDefs, id: 'td1', ...meta }],
    testResults: [{ ...drafts.testResults, id: 'tr1', ...meta }],
    checkins: [{ ...drafts.checkins, id: 'ci1', ...meta }],
    settings: [{ key: 'pendingSleepStart', value: '2026-10-20T20:30:00.000Z' }],
  };
}

describe('backupFileName', () => {
  it('использует московское время', () => {
    expect(backupFileName(new Date('2026-10-21T21:19:00.000Z'))).toBe('athlete-os-backup-2026-10-22-00-19.json');
  });
});

describe('parseBackup', () => {
  it('принимает только что созданную копию без потерь', () => {
    const backup = createBackup(fullData(), '0.1.0', new Date('2026-10-21T10:00:00.000Z'));
    const r = parseBackup(JSON.stringify(backup));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.total).toBe(17);
      expect(r.counts.meals).toBe(1);
      expect(r.backup.data).toEqual(backup.data);
    }
  });

  it('разрешает отсутствие разделов (пустые таблицы)', () => {
    const r = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: meta.createdAt, data: { foods: [] } }),
    );
    expect(r.ok).toBe(true);
  });

  it('копия версии 1 (до воды и расширенных нутриентов) импортируется в версию 2', () => {
    const v1meal = {
      id: 'm1', date: '2026-10-21', mealType: 'breakfast', foodName: 'Гречка', basis: 'g', amount: 150,
      per100: { kcal: 100, protein: 4, fat: 1, carbs: 20 }, nutrients: { kcal: 150, protein: 6, fat: 1.5, carbs: 30 },
      createdAt: meta.createdAt, updatedAt: meta.createdAt,
    };
    const r = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: meta.createdAt, data: { meals: [v1meal] } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.schemaVersion).toBe(DATA_SCHEMA_VERSION);
      expect(r.backup.data.water).toEqual([]);
      expect(r.backup.data.meals[0]).toEqual(v1meal);
    }
  });

  it('копия версии 2 (до программ): шаблоны превращаются в программы', () => {
    const tpl = { ...drafts.workoutTemplates, id: 't1', ...meta };
    const r = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 2, exportedAt: meta.createdAt, data: { workoutTemplates: [tpl] } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.data.workoutTemplates).toEqual([tpl]);
      expect(r.backup.data.programs).toHaveLength(1);
      expect(r.backup.data.programs[0]).toMatchObject({ id: 't1', name: 'Тестовый шаблон', format: 'exercises', items: [{ sets: 3 }] });
      expect(r.backup.data.schedule).toEqual([]);
      expect(r.backup.data.testResults).toEqual([]);
    }
  });

  it('копия версии 3 (до чек-инов) импортируется: чек-инов нет', () => {
    const r = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 3, exportedAt: meta.createdAt, data: {} }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data.checkins).toEqual([]);
  });

  it('отклоняет не-JSON', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, errors: ['Файл не является корректным JSON'] });
  });

  it('отклоняет чужой формат', () => {
    expect(parseBackup(JSON.stringify({ hello: 'world' })).ok).toBe(false);
    expect(parseBackup('[]').ok).toBe(false);
  });

  it('отклоняет копию более новой версии', () => {
    const r = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: DATA_SCHEMA_VERSION + 1, exportedAt: meta.createdAt, data: {} }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/более новой/);
  });

  it('отклоняет весь файл, если хотя бы одна запись некорректна', () => {
    const data = fullData();
    data.foods.push({ ...data.foods[0]!, id: 'f2', per100: { kcal: -5, protein: 1, fat: 1, carbs: 1 } });
    const r = parseBackup(JSON.stringify(createBackup(data, '0.1.0')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/^Продукты и рецепты, запись 2: per100\.kcal/);
  });

  it('отклоняет повторяющиеся идентификаторы', () => {
    const data = fullData();
    data.meals.push({ ...data.meals[0]! });
    const r = parseBackup(JSON.stringify(createBackup(data, '0.1.0')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/повторяющийся идентификатор/);
  });

  it('отклоняет два чек-ина на одну дату (дата уникальна в базе)', () => {
    const data = fullData();
    data.checkins.push({ ...data.checkins[0]!, id: 'ci2', sleepHours: 6 });
    const r = parseBackup(JSON.stringify(createBackup(data, '0.1.0')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/уже есть чек-ин в этом файле/);
  });

  it('отклоняет неизвестные разделы и раздел не-списком', () => {
    const r = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: meta.createdAt, data: { foods: {}, hack: [] } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join('\n')).toMatch(/Неизвестные разделы: hack/);
      expect(r.errors.join('\n')).toMatch(/ожидался список/);
    }
  });
});
