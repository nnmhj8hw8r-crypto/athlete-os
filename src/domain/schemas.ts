// Модели данных и их проверка. Одни и те же схемы используются для форм,
// для записи в IndexedDB и для проверки импортируемой резервной копии.
import { z } from 'zod';
import { extraSchema, nutrientBasisSchema, per100Schema } from '../../shared/catalog.ts';
import { isValidDateKey } from './time.ts';

// Русские сообщения по умолчанию для проверок, у которых не задан собственный текст.
z.config(z.locales.ru());

const id = z.string().min(1).max(100);
const isoDateTime = z
  .string()
  .refine((v) => v.includes('T') && !Number.isNaN(Date.parse(v)), 'Некорректные дата и время');
const dateKey = z.string().refine(isValidDateKey, 'Некорректная дата');
const text = (max: number, message = 'Заполните поле') => z.string().trim().min(1, message).max(max, `Не длиннее ${max} символов`);
const optionalText = (max: number) => z.string().max(max, `Не длиннее ${max} символов`).optional();
const url = z
  .string()
  .max(2000)
  .refine((v) => /^https?:\/\/\S+$/i.test(v), 'Ссылка должна начинаться с http:// или https://');
const rating = (min: number, max: number) =>
  z.number().int('Нужно целое число').min(min, `От ${min} до ${max}`).max(max, `От ${min} до ${max}`);
const timestamps = { createdAt: isoDateTime, updatedAt: isoDateTime };

export { extraSchema, nutrientBasisSchema, per100Schema };

// ---------- Питание ----------

export const recipeIngredientSchema = z.object({
  /** id продукта каталога или встроенной базы (usda:…, off:…). Вода — 'water'. */
  foodId: id,
  name: text(200),
  basis: nutrientBasisSchema,
  amount: z.number().finite().positive('Количество должно быть больше нуля').max(100_000),
  per100: per100Schema,
  /** Расширенные нутриенты на 100 г/мл (с версии данных 2). */
  extra: extraSchema.optional(),
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

export const recipeSchema = z.object({
  ingredients: z.array(recipeIngredientSchema).min(1, 'Добавьте хотя бы один ингредиент'),
  /** Итоговая масса готового блюда. Обязательна, если в рецепте есть ингредиенты в мл. */
  totalWeightG: z.number().finite().positive().max(100_000).optional(),
});

export const foodSourceSchema = z.enum(['manual', 'perek', 'off', 'recipe']);
export type FoodSource = z.infer<typeof foodSourceSchema>;

export const foodSchema = z
  .object({
    id,
    name: text(200, 'Укажите название'),
    brand: optionalText(200),
    basis: nutrientBasisSchema,
    per100: per100Schema,
    /** Расширенные нутриенты на 100 г/мл; отсутствующее поле = нет данных (с версии данных 2). */
    extra: extraSchema.optional(),
    source: foodSourceSchema,
    /** Откуда взяты цифры: «упаковка», «сайт производителя» и т. п. */
    sourceNote: optionalText(500),
    sourceUrl: url.optional(),
    externalId: optionalText(200),
    license: optionalText(200),
    barcode: z.string().regex(/^\d{8,14}$/, 'Штрихкод — от 8 до 14 цифр').optional(),
    recipe: recipeSchema.optional(),
    ...timestamps,
  })
  .superRefine((f, ctx) => {
    const { protein, fat, carbs } = f.per100;
    if (f.basis === 'g' && protein + fat + carbs > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['per100'],
        message: 'Сумма белков, жиров и углеводов не может превышать 100 г на 100 г продукта',
      });
    }
  });
export type Food = z.infer<typeof foodSchema>;

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const mealTypeSchema = z.enum(MEAL_TYPES);
export type MealType = z.infer<typeof mealTypeSchema>;

export const mealEntrySchema = z.object({
  id,
  date: dateKey,
  mealType: mealTypeSchema,
  /** Ссылка на продукт каталога. Продукт могут удалить — запись от этого не меняется. */
  foodId: id.optional(),
  foodName: text(200),
  brand: optionalText(200),
  basis: nutrientBasisSchema,
  amount: z.number().finite().positive('Порция должна быть больше нуля').max(100_000, 'Слишком большая порция'),
  /** Снимок пищевой ценности продукта на момент записи. */
  per100: per100Schema,
  /** Рассчитанные калории и БЖУ порции. Не пересчитываются при изменении продукта. */
  nutrients: per100Schema,
  /** Снимок расширенных нутриентов на 100 г/мл и их значения для порции (с версии данных 2). */
  extra100: extraSchema.optional(),
  extra: extraSchema.optional(),
  /** Продукт встроенной или офлайн-базы (usda:…, dish:…, off:…), если он не сохранён в каталог. */
  refId: optionalText(100),
  sourceUrl: url.optional(),
  notes: optionalText(1000),
  ...timestamps,
});
export type MealEntry = z.infer<typeof mealEntrySchema>;

/** Выпитая вода (с версии данных 2). Отдельно от еды: вода в продуктах считается в нутриентах. */
export const waterEntrySchema = z.object({
  id,
  date: dateKey,
  ml: z.number().int('Целое число миллилитров').min(1, 'Больше нуля').max(5000, 'Не больше 5 литров за раз'),
  ...timestamps,
});
export type WaterEntry = z.infer<typeof waterEntrySchema>;

// ---------- Тренировки ----------

export const WORKOUT_TYPES = ['judo', 'sambo', 'gym', 'other'] as const;
export const workoutTypeSchema = z.enum(WORKOUT_TYPES);
export type WorkoutType = z.infer<typeof workoutTypeSchema>;

/**
 * Формат занятия (v0.5): обычная тренировка по упражнениям, тренировка на ковре
 * (разминка, техника, немного борьбы) или день борьбы (встречи в партере и в стойке).
 */
export const WORKOUT_FORMATS = ['exercises', 'mat', 'fight'] as const;
export const workoutFormatSchema = z.enum(WORKOUT_FORMATS);
export type WorkoutFormat = z.infer<typeof workoutFormatSchema>;

/**
 * Что измеряется в подходе упражнения:
 * weight_reps — вес × повторения, reps — повторения (свой вес), time — время,
 * distance_time — расстояние и время, rounds — встречи/раунды по времени, check — только «сделано».
 */
export const EXERCISE_METRICS = ['weight_reps', 'reps', 'time', 'distance_time', 'rounds', 'check'] as const;
export const exerciseMetricSchema = z.enum(EXERCISE_METRICS);
export type ExerciseMetric = z.infer<typeof exerciseMetricSchema>;

export const EXERCISE_GROUPS = [
  'warmup',
  'cardio',
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'legs',
  'glutes',
  'abs',
  'fullbody',
  'wrestling',
  'other',
] as const;
export const exerciseGroupSchema = z.enum(EXERCISE_GROUPS);
export type ExerciseGroup = z.infer<typeof exerciseGroupSchema>;

/** Мышцы для «человечка» на иконке упражнения (src/ui/BodyFigure.tsx). */
export const MUSCLES = [
  'chest',
  'delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'adductors',
  'calves',
  'traps',
  'lats',
  'rearDelts',
  'lowerBack',
  'glutes',
  'hamstrings',
] as const;
export const muscleSchema = z.enum(MUSCLES);
export type Muscle = z.infer<typeof muscleSchema>;

export const workoutSetSchema = z.object({
  reps: z.number().int('Целое число').min(0).max(1000).optional(),
  weightKg: z.number().finite().min(0, 'Не меньше 0').max(1000).optional(),
  /** Длительность подхода или встречи, с (v0.5). */
  durationSec: z.number().int().min(0).max(86400).optional(),
  /** Расстояние, км (v0.5). */
  distanceKm: z.number().finite().min(0).max(1000).optional(),
  restSec: z.number().int().min(0).max(3600).optional(),
  rpe: z.number().min(1, 'RPE от 1 до 10').max(10, 'RPE от 1 до 10').optional(),
  /** Подход отмечен выполненным (галочка на экране тренировки). */
  done: z.boolean().optional(),
  notes: optionalText(500),
});
export type WorkoutSet = z.infer<typeof workoutSetSchema>;

export const workoutExerciseSchema = z.object({
  /** id из таблицы exercises или встроенного каталога (lib:…). */
  exerciseId: id,
  name: text(200),
  /** Снимок типа измерения на момент тренировки. Нет — вес × повторения (записи до v0.5). */
  metric: exerciseMetricSchema.optional(),
  notes: optionalText(1000),
  sets: z.array(workoutSetSchema).max(100),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

export const workoutSchema = z.object({
  id,
  startAt: isoDateTime,
  type: workoutTypeSchema,
  format: workoutFormatSchema.optional(),
  title: text(200, 'Укажите название или цель'),
  durationMin: z.number().int('Целое число минут').min(1, 'Больше нуля').max(1440, 'Не больше 24 часов').optional(),
  /** Над чем работал (тренировка на ковре): техника, связки. */
  focus: optionalText(1000),
  notes: optionalText(5000),
  rpe: z.number().min(1, 'От 1 до 10').max(10, 'От 1 до 10').optional(),
  exercises: z.array(workoutExerciseSchema).max(100),
  templateId: id.optional(),
  programId: id.optional(),
  scheduleId: id.optional(),
  ...timestamps,
});
export type Workout = z.infer<typeof workoutSchema>;

export const exerciseSchema = z.object({
  id,
  name: text(200, 'Укажите название упражнения'),
  /** Группа в каталоге (v0.5). Нет — «Другое». */
  group: exerciseGroupSchema.optional(),
  metric: exerciseMetricSchema.optional(),
  muscles: z.array(muscleSchema).max(16).optional(),
  musclesSecondary: z.array(muscleSchema).max(16).optional(),
  /** Заметки о технике выполнения. */
  notes: optionalText(1000),
  ...timestamps,
});
export type Exercise = z.infer<typeof exerciseSchema>;

/** Шаблоны до v0.5. При обновлении базы до версии 3 переносятся в программы; таблица хранится для копий. */
export const workoutTemplateSchema = z.object({
  id,
  name: text(200, 'Укажите название шаблона'),
  type: workoutTypeSchema,
  title: optionalText(200),
  notes: optionalText(5000),
  exercises: z
    .array(
      z.object({
        exerciseId: id,
        name: text(200),
        plannedSets: z.number().int().min(0).max(100).optional(),
        notes: optionalText(1000),
      }),
    )
    .max(100),
  ...timestamps,
});
export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>;

/** Пункт программы: упражнение и план («2 × 8–12», «10 минут», «6 встреч по 3 мин»). */
export const programItemSchema = z.object({
  exerciseId: id,
  name: text(200),
  metric: exerciseMetricSchema.optional(),
  sets: z.number().int('Целое число').min(1, 'Хотя бы 1').max(50, 'Не больше 50'),
  repsMin: z.number().int().min(0).max(1000).optional(),
  repsMax: z.number().int().min(0).max(1000).optional(),
  weightKg: z.number().finite().min(0).max(1000).optional(),
  durationSec: z.number().int().min(0).max(86400).optional(),
  distanceKm: z.number().finite().min(0).max(1000).optional(),
  restSec: z.number().int().min(0).max(3600).optional(),
  notes: optionalText(1000),
});
export type ProgramItem = z.infer<typeof programItemSchema>;

export const PROGRAM_ICONS = ['auto', 'gym', 'mat', 'fight', 'run', 'bolt', 'letter'] as const;
export type ProgramIcon = (typeof PROGRAM_ICONS)[number];
export const PROGRAM_COLORS = ['blue', 'red', 'green', 'orange', 'purple', 'gray'] as const;
export type ProgramColor = (typeof PROGRAM_COLORS)[number];

/** Программа (план тренировки): «Ковёр — Пн, Ср, Пт», «Качалка — Вт, Чт», «Скоростно-силовая». */
export const programSchema = z.object({
  id,
  name: text(100, 'Укажите название программы'),
  type: workoutTypeSchema,
  format: workoutFormatSchema,
  icon: z.enum(PROGRAM_ICONS),
  color: z.enum(PROGRAM_COLORS),
  /** Фото обложки из таблицы photos (необязательно). */
  coverPhotoId: id.optional(),
  /** Дни недели для подписи (1 — понедельник … 7 — воскресенье). Только подпись, не расписание. */
  weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  notes: optionalText(5000),
  items: z.array(programItemSchema).max(100),
  ...timestamps,
});
export type Program = z.infer<typeof programSchema>;

export const SCHEDULE_SLOTS = ['morning', 'day', 'evening'] as const;
export const scheduleSlotSchema = z.enum(SCHEDULE_SLOTS);
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;

/** План недели: на конкретный день и время суток — программа. */
export const scheduleEntrySchema = z.object({
  id,
  date: dateKey,
  slot: scheduleSlotSchema,
  programId: id,
  notes: optionalText(500),
  ...timestamps,
});
export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;

// ---------- Замеры и тесты ----------

export const TEST_UNITS = ['reps', 'sec', 'cm', 'kg', 'm', 'other'] as const;
export const testUnitSchema = z.enum(TEST_UNITS);
export type TestUnit = z.infer<typeof testUnitSchema>;

/** Свой тест или замер пользователя (встроенные — в src/domain/fitnessTests.ts). */
export const testDefSchema = z.object({
  id,
  name: text(100, 'Укажите название'),
  unit: testUnitSchema,
  /** Подпись единицы для unit = 'other'. */
  unitLabel: optionalText(20),
  /** true — лучше больше (подтягивания), false — лучше меньше (время на канате). */
  higherIsBetter: z.boolean(),
  notes: optionalText(1000),
  ...timestamps,
});
export type TestDef = z.infer<typeof testDefSchema>;

export const testResultSchema = z.object({
  id,
  /** id встроенного (lib:…) или своего теста. */
  testId: id,
  date: dateKey,
  value: z.number().finite('Введите число').min(0, 'Не меньше 0').max(100000, 'Слишком большое значение'),
  notes: optionalText(1000),
  ...timestamps,
});
export type TestResult = z.infer<typeof testResultSchema>;

// ---------- Сон и восстановление ----------

export const sleepEntrySchema = z
  .object({
    id,
    bedtime: isoDateTime,
    wakeTime: isoDateTime,
    /** Оценка пользователя: сколько минут засыпал. */
    sleepLatencyMin: z.number().int('Целое число минут').min(0, 'Не меньше 0').max(600).optional(),
    /** Оценка пользователя: суммарная длительность ночных пробуждений. */
    wakeDuringNightMin: z.number().int('Целое число минут').min(0, 'Не меньше 0').max(900).optional(),
    wellbeing: rating(1, 5).optional(),
    fatigue: rating(1, 5).optional(),
    soreness: rating(1, 5).optional(),
    motivation: rating(1, 5).optional(),
    notes: optionalText(2000),
    ...timestamps,
  })
  .superRefine((s, ctx) => {
    const minutes = (Date.parse(s.wakeTime) - Date.parse(s.bedtime)) / 60_000;
    if (!(minutes > 0)) {
      ctx.addIssue({ code: 'custom', path: ['wakeTime'], message: 'Пробуждение должно быть позже отхода ко сну' });
    } else if (minutes > 24 * 60) {
      ctx.addIssue({ code: 'custom', path: ['wakeTime'], message: 'Промежуток больше 24 часов — проверьте даты' });
    } else if ((s.sleepLatencyMin ?? 0) + (s.wakeDuringNightMin ?? 0) > minutes) {
      ctx.addIssue({
        code: 'custom',
        path: ['sleepLatencyMin'],
        message: 'Засыпание и пробуждения вместе длиннее, чем всё время в постели',
      });
    }
  });
export type SleepEntry = z.infer<typeof sleepEntrySchema>;

// ---------- Сезон ----------

export const sportSchema = z.enum(['judo', 'sambo']);

export const COMPETITION_STATUSES = ['planned', 'registered', 'completed', 'cancelled'] as const;
export const competitionStatusSchema = z.enum(COMPETITION_STATUSES);
export type CompetitionStatus = z.infer<typeof competitionStatusSchema>;

export const competitionSchema = z.object({
  id,
  sport: sportSchema,
  weightCategory: text(20, 'Укажите весовую категорию'),
  name: text(300, 'Укажите название соревнования'),
  startAt: isoDateTime,
  location: optionalText(300),
  weighInAt: isoDateTime,
  targetWeightKg: z.number().finite().min(20, 'Слишком маленькое значение').max(300).optional(),
  notes: optionalText(5000),
  rules: optionalText(5000),
  status: competitionStatusSchema,
  ...timestamps,
});
export type Competition = z.infer<typeof competitionSchema>;

export const bodyWeightSchema = z.object({
  id,
  measuredAt: isoDateTime,
  weightKg: z.number().finite().min(20, 'Слишком маленькое значение').max(300, 'Слишком большое значение'),
  notes: optionalText(1000),
  ...timestamps,
});
export type BodyWeight = z.infer<typeof bodyWeightSchema>;

// ---------- Добавки и источники ----------

export const supplementSchema = z
  .object({
    id,
    name: text(200, 'Укажите название'),
    dose: z.number().finite().positive('Дозировка должна быть больше нуля').max(100_000),
    doseUnit: text(20, 'Укажите единицу'),
    startDate: dateKey.optional(),
    endDate: dateKey.optional(),
    purpose: optionalText(1000),
    notes: optionalText(2000),
    sourceUrl: url.optional(),
    ...timestamps,
  })
  .superRefine((s, ctx) => {
    if (s.startDate && s.endDate && s.endDate < s.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Дата окончания раньше даты начала' });
    }
  });
export type Supplement = z.infer<typeof supplementSchema>;

export const SOURCE_TYPES = [
  'systematic_review',
  'meta_analysis',
  'study',
  'guideline',
  'book',
  'article',
  'video',
  'coach_experience',
  'other',
] as const;
export const sourceTypeSchema = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const knowledgeSourceSchema = z.object({
  id,
  title: text(500, 'Укажите название'),
  author: optionalText(300),
  url: url.optional(),
  publishedDate: dateKey.optional(),
  checkedDate: dateKey,
  topic: optionalText(200),
  sourceType: sourceTypeSchema,
  notes: optionalText(5000),
  ...timestamps,
});
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;

// ---------- Настройки ----------

export const settingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
});
export type Setting = z.infer<typeof settingSchema>;

/** Все таблицы локальной базы и схемы их записей. Порядок важен для резервной копии. */
export const ENTITY_SCHEMAS = {
  foods: foodSchema,
  meals: mealEntrySchema,
  workouts: workoutSchema,
  exercises: exerciseSchema,
  workoutTemplates: workoutTemplateSchema,
  programs: programSchema,
  schedule: scheduleEntrySchema,
  testDefs: testDefSchema,
  testResults: testResultSchema,
  sleep: sleepEntrySchema,
  competitions: competitionSchema,
  bodyWeights: bodyWeightSchema,
  supplements: supplementSchema,
  sources: knowledgeSourceSchema,
  water: waterEntrySchema,
  settings: settingSchema,
} as const;

export type TableName = keyof typeof ENTITY_SCHEMAS;
export const TABLE_NAMES = Object.keys(ENTITY_SCHEMAS) as TableName[];

export type EntityOf<T extends TableName> = z.infer<(typeof ENTITY_SCHEMAS)[T]>;

export const TABLE_LABELS: Record<TableName, string> = {
  foods: 'Продукты и рецепты',
  meals: 'Записи питания',
  workouts: 'Тренировки',
  exercises: 'Упражнения',
  workoutTemplates: 'Шаблоны тренировок (до v0.5)',
  programs: 'Программы тренировок',
  schedule: 'План недели',
  testDefs: 'Свои тесты и замеры',
  testResults: 'Результаты тестов',
  sleep: 'Сон и восстановление',
  competitions: 'Соревнования',
  bodyWeights: 'Масса тела',
  supplements: 'Добавки',
  sources: 'Источники',
  water: 'Вода',
  settings: 'Настройки',
};
