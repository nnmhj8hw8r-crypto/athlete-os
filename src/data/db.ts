// Локальная база IndexedDB (через Dexie). Единственное место, где описана её структура.
//
// Как менять структуру:
// 1. Не редактировать существующие version(N) — пользователи уже открыли базу с ними.
// 2. Добавить this.version(N + 1).stores({...}) с новыми индексами и при необходимости
//    .upgrade(tx => ...) для преобразования старых записей.
// 3. Увеличить DATA_SCHEMA_VERSION в src/domain/backup.ts и добавить миграцию копий.
// Подробнее — docs/ARCHITECTURE.md, раздел «Версии схемы данных».
import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyWeight,
  Competition,
  Exercise,
  Food,
  KnowledgeSource,
  MealEntry,
  Setting,
  SleepEntry,
  Supplement,
  TableName,
  WaterEntry,
  Workout,
  WorkoutTemplate,
} from '../domain/schemas.ts';

export type AthleteDb = Dexie & {
  foods: EntityTable<Food, 'id'>;
  meals: EntityTable<MealEntry, 'id'>;
  workouts: EntityTable<Workout, 'id'>;
  exercises: EntityTable<Exercise, 'id'>;
  workoutTemplates: EntityTable<WorkoutTemplate, 'id'>;
  sleep: EntityTable<SleepEntry, 'id'>;
  competitions: EntityTable<Competition, 'id'>;
  bodyWeights: EntityTable<BodyWeight, 'id'>;
  supplements: EntityTable<Supplement, 'id'>;
  sources: EntityTable<KnowledgeSource, 'id'>;
  water: EntityTable<WaterEntry, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

export const DB_NAME = 'personal-athlete-os';

/** Индексы таблиц версии 1. Первое поле — первичный ключ. */
const SCHEMA_V1: Record<Exclude<TableName, 'water'>, string> = {
  foods: 'id, name, barcode, source, externalId, updatedAt',
  meals: 'id, date, foodId',
  workouts: 'id, startAt, type, templateId',
  exercises: 'id, name',
  workoutTemplates: 'id, name',
  sleep: 'id, wakeTime',
  competitions: 'id, startAt, sport',
  bodyWeights: 'id, measuredAt',
  supplements: 'id, name',
  sources: 'id, title, checkedDate',
  settings: 'key',
};

export function openDb(name = DB_NAME): AthleteDb {
  const db = new Dexie(name) as AthleteDb;
  // Последняя объявленная версия должна совпадать с DATA_SCHEMA_VERSION (проверяется тестом).
  db.version(1).stores(SCHEMA_V1);
  // Версия 2: таблица выпитой воды; у продуктов и записей питания появились необязательные
  // расширенные нутриенты (extra) — старые записи остаются корректными без преобразования.
  db.version(2).stores({ water: 'id, date' });
  return db;
}

export const db = openDb();
