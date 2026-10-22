// Встроенный каталог упражнений (v0.5): русские названия, группа, что измеряется и какие мышцы
// подсвечиваются на иконке. Это справочник движений, а не данные спортсмена и не нормативы.
// id имеют вид lib:<слаг> и не сохраняются в таблицу exercises — как встроенные продукты в питании.
import type { Exercise, ExerciseGroup, ExerciseMetric, Muscle } from './schemas.ts';

export interface LibraryExercise {
  id: string;
  name: string;
  group: ExerciseGroup;
  metric: ExerciseMetric;
  muscles: Muscle[];
  musclesSecondary: Muscle[];
  /** Другие названия для поиска. */
  aliases?: string[];
}

type Row = [slug: string, name: string, group: ExerciseGroup, metric: ExerciseMetric, primary: Muscle[], secondary?: Muscle[], aliases?: string[]];

const ROWS: Row[] = [
  // Разминка
  ['warmup-general', 'Общая разминка', 'warmup', 'check', [], ['quads', 'delts', 'abs']],
  ['warmup-joints', 'Суставная разминка', 'warmup', 'check', [], ['delts', 'forearms', 'quads']],
  ['warmup-acrobatics', 'Акробатика и страховки', 'warmup', 'check', ['abs'], ['delts', 'lowerBack'], ['кувырки', 'самостраховка', 'укеми']],
  ['stretching', 'Растяжка', 'warmup', 'time', ['hamstrings'], ['adductors', 'lowerBack'], ['заминка', 'стретчинг']],
  // Кардио
  ['treadmill-walk', 'Ходьба на дорожке', 'cardio', 'distance_time', ['quads', 'calves'], ['glutes']],
  ['treadmill-run', 'Бег на дорожке', 'cardio', 'distance_time', ['quads', 'calves'], ['hamstrings', 'glutes']],
  ['run', 'Бег (улица)', 'cardio', 'distance_time', ['quads', 'calves'], ['hamstrings', 'glutes'], ['пробежка', 'кросс']],
  ['sprint', 'Спринт (ускорения)', 'cardio', 'distance_time', ['quads', 'hamstrings'], ['glutes', 'calves']],
  ['bike', 'Велотренажёр', 'cardio', 'distance_time', ['quads'], ['calves', 'glutes'], ['велосипед']],
  ['airbike', 'Аэробайк', 'cardio', 'time', ['quads', 'delts'], ['calves', 'triceps'], ['спринтерский велосипед', 'assault bike']],
  ['rower', 'Гребной тренажёр', 'cardio', 'distance_time', ['lats', 'quads'], ['biceps', 'lowerBack'], ['гребля']],
  ['jump-rope', 'Прыжки на скакалке', 'cardio', 'time', ['calves'], ['quads', 'delts'], ['скакалка']],
  ['elliptical', 'Эллипсоид', 'cardio', 'distance_time', ['quads'], ['glutes', 'delts']],
  ['stepper', 'Степпер', 'cardio', 'time', ['quads', 'glutes'], ['calves']],
  // Грудь
  ['bench-press', 'Жим лёжа со штангой', 'chest', 'weight_reps', ['chest'], ['triceps', 'delts'], ['жим штанги лежа']],
  ['incline-bench', 'Жим штанги на наклонной скамье', 'chest', 'weight_reps', ['chest', 'delts'], ['triceps']],
  ['smith-incline', 'Жим лёжа в Смите под 30°', 'chest', 'weight_reps', ['chest', 'delts'], ['triceps'], ['смит']],
  ['db-press', 'Жим гантелей лёжа', 'chest', 'weight_reps', ['chest'], ['triceps', 'delts']],
  ['fly-machine', 'Разводка в тренажёре «бабочка»', 'chest', 'weight_reps', ['chest'], ['delts'], ['бабочка', 'пек-дек']],
  ['dips', 'Отжимания на брусьях', 'chest', 'reps', ['chest', 'triceps'], ['delts'], ['брусья']],
  ['pushups', 'Отжимания от пола', 'chest', 'reps', ['chest', 'triceps'], ['delts', 'abs']],
  ['clap-pushups', 'Отжимания с хлопком', 'chest', 'reps', ['chest', 'triceps'], ['delts'], ['взрывные отжимания']],
  // Спина
  ['pullups', 'Подтягивания', 'back', 'reps', ['lats', 'biceps'], ['forearms', 'rearDelts'], ['турник']],
  ['pullups-weighted', 'Подтягивания с отягощением', 'back', 'weight_reps', ['lats', 'biceps'], ['forearms', 'rearDelts']],
  ['pullups-gi', 'Подтягивания на кимоно (полотенце)', 'back', 'reps', ['lats', 'forearms'], ['biceps'], ['дзюдоги', 'хват кимоно']],
  ['rope-climb', 'Лазание по канату', 'back', 'reps', ['lats', 'forearms'], ['biceps', 'abs'], ['канат']],
  ['rope-climb-nolegs', 'Лазание по канату без ног', 'back', 'reps', ['lats', 'forearms', 'biceps'], ['abs']],
  ['lat-pulldown', 'Тяга верхнего блока', 'back', 'weight_reps', ['lats'], ['biceps', 'rearDelts']],
  ['barbell-row', 'Тяга штанги в наклоне', 'back', 'weight_reps', ['lats', 'traps'], ['biceps', 'lowerBack', 'rearDelts']],
  ['db-row', 'Тяга гантели в наклоне', 'back', 'weight_reps', ['lats'], ['biceps', 'rearDelts']],
  ['cable-row', 'Тяга горизонтального блока', 'back', 'weight_reps', ['lats', 'traps'], ['biceps']],
  ['deadlift', 'Становая тяга', 'back', 'weight_reps', ['lowerBack', 'glutes', 'hamstrings'], ['traps', 'forearms', 'quads']],
  ['hyperextension', 'Гиперэкстензия', 'back', 'reps', ['lowerBack'], ['glutes', 'hamstrings']],
  ['shrugs', 'Шраги', 'back', 'weight_reps', ['traps'], ['forearms']],
  // Плечи
  ['ohp', 'Жим штанги стоя', 'shoulders', 'weight_reps', ['delts'], ['triceps', 'traps'], ['армейский жим']],
  ['db-shoulder-press', 'Жим гантелей сидя', 'shoulders', 'weight_reps', ['delts'], ['triceps']],
  ['lateral-raise', 'Махи гантелями в стороны', 'shoulders', 'weight_reps', ['delts'], ['traps'], ['махи']],
  ['rear-delt-fly', 'Разводка в наклоне (задняя дельта)', 'shoulders', 'weight_reps', ['rearDelts'], ['traps']],
  // Руки
  ['barbell-curl', 'Сгибание рук со штангой', 'biceps', 'weight_reps', ['biceps'], ['forearms'], ['бицепс штанга']],
  ['db-curl', 'Сгибание рук с гантелями', 'biceps', 'weight_reps', ['biceps'], ['forearms']],
  ['hammer-curl', 'Молотки с гантелями', 'biceps', 'weight_reps', ['biceps', 'forearms']],
  ['triceps-pushdown', 'Разгибание рук на блоке', 'triceps', 'weight_reps', ['triceps']],
  ['french-press', 'Французский жим', 'triceps', 'weight_reps', ['triceps']],
  ['close-grip-bench', 'Жим узким хватом', 'triceps', 'weight_reps', ['triceps'], ['chest']],
  // Предплечья и хват
  ['wrist-curl', 'Сгибание кистей со штангой', 'forearms', 'weight_reps', ['forearms']],
  ['wrist-roller', 'Ролик для кистей (наматывание)', 'forearms', 'reps', ['forearms'], ['delts']],
  ['dead-hang', 'Вис на перекладине', 'forearms', 'time', ['forearms'], ['lats'], ['вис']],
  ['gi-hang', 'Вис на кимоно (полотенце)', 'forearms', 'time', ['forearms'], ['lats', 'biceps']],
  ['farmer-walk', 'Прогулка фермера', 'forearms', 'weight_reps', ['forearms', 'traps'], ['abs', 'quads'], ['фермерская прогулка']],
  ['gripper', 'Кистевой эспандер', 'forearms', 'reps', ['forearms']],
  // Ноги и ягодицы
  ['squat', 'Приседания со штангой', 'legs', 'weight_reps', ['quads', 'glutes'], ['lowerBack', 'adductors'], ['присед']],
  ['front-squat', 'Фронтальные приседания', 'legs', 'weight_reps', ['quads'], ['glutes', 'abs']],
  ['leg-press', 'Жим ногами', 'legs', 'weight_reps', ['quads', 'glutes'], ['adductors']],
  ['lunges', 'Выпады', 'legs', 'weight_reps', ['quads', 'glutes'], ['hamstrings']],
  ['bulgarian-split', 'Болгарские выпады', 'legs', 'weight_reps', ['quads', 'glutes'], ['adductors']],
  ['leg-extension', 'Разгибание ног в тренажёре', 'legs', 'weight_reps', ['quads']],
  ['leg-curl', 'Сгибание ног в тренажёре', 'legs', 'weight_reps', ['hamstrings']],
  ['rdl', 'Румынская тяга', 'legs', 'weight_reps', ['hamstrings', 'glutes'], ['lowerBack']],
  ['calf-raise', 'Подъёмы на носки', 'legs', 'weight_reps', ['calves'], [], ['икры']],
  ['box-jump', 'Прыжки на тумбу', 'legs', 'reps', ['quads', 'glutes'], ['calves']],
  ['broad-jump', 'Прыжки в длину с места', 'legs', 'reps', ['quads', 'glutes'], ['calves', 'hamstrings']],
  ['hip-thrust', 'Ягодичный мост со штангой', 'glutes', 'weight_reps', ['glutes'], ['hamstrings']],
  // Пресс
  ['crunches', 'Скручивания', 'abs', 'reps', ['abs']],
  ['hanging-leg-raise', 'Подъём ног в висе', 'abs', 'reps', ['abs'], ['forearms', 'obliques']],
  ['plank', 'Планка', 'abs', 'time', ['abs'], ['delts', 'obliques']],
  ['russian-twist', 'Русские скручивания', 'abs', 'reps', ['obliques', 'abs']],
  ['ab-wheel', 'Ролик для пресса', 'abs', 'reps', ['abs'], ['lats', 'delts']],
  // Всё тело, скоростно-силовая
  ['power-clean', 'Взятие штанги на грудь', 'fullbody', 'weight_reps', ['traps', 'glutes', 'quads'], ['hamstrings', 'delts', 'forearms']],
  ['kb-swing', 'Махи гирей', 'fullbody', 'weight_reps', ['glutes', 'hamstrings'], ['lowerBack', 'delts', 'forearms']],
  ['kb-snatch', 'Рывок гири', 'fullbody', 'weight_reps', ['glutes', 'delts'], ['traps', 'forearms', 'hamstrings']],
  ['burpee', 'Бёрпи', 'fullbody', 'reps', ['quads', 'chest'], ['delts', 'abs', 'triceps']],
  ['med-ball-throw', 'Броски набивного мяча', 'fullbody', 'reps', ['delts', 'chest', 'abs'], ['triceps', 'quads']],
  ['sled-push', 'Толкание саней', 'fullbody', 'time', ['quads', 'glutes'], ['calves', 'delts']],
  ['battle-rope', 'Канаты (волны)', 'fullbody', 'time', ['delts', 'forearms'], ['abs', 'biceps']],
  ['bands-entries', 'Входы в бросок с резиной', 'fullbody', 'reps', ['quads', 'lats'], ['glutes', 'biceps', 'abs'], ['резина', 'учикоми с резиной']],
  // Борьба
  ['uchikomi', 'Набегания (входы на бросок)', 'wrestling', 'reps', ['quads', 'lats'], ['glutes', 'abs'], ['учикоми', 'uchikomi']],
  ['nagekomi', 'Броски (нагекоми)', 'wrestling', 'reps', ['quads', 'lats', 'glutes'], ['abs', 'forearms'], ['нагекоми', 'броски']],
  ['technique', 'Отработка техники', 'wrestling', 'time', [], ['lats', 'quads', 'forearms'], ['техника']],
  ['ne-waza-drill', 'Техника в партере', 'wrestling', 'time', [], ['abs', 'lats'], ['партер техника', 'не-ваза']],
  ['randori-ground', 'Борьба в партере (встречи)', 'wrestling', 'rounds', ['abs', 'lats'], ['forearms', 'glutes'], ['партер', 'не-ваза рандори']],
  ['randori-standing', 'Борьба в стойке (встречи)', 'wrestling', 'rounds', ['forearms', 'quads'], ['lats', 'glutes', 'abs'], ['стойка', 'рандори', 'тачи-ваза']],
  ['sparring', 'Учебно-тренировочные схватки', 'wrestling', 'rounds', ['forearms', 'quads', 'lats'], ['abs', 'glutes'], ['схватки', 'спарринг']],
  ['grip-fight', 'Борьба за захват', 'wrestling', 'rounds', ['forearms'], ['biceps', 'lats'], ['захват', 'кумиката']],
  ['bridge', 'Борцовский мост', 'wrestling', 'reps', ['lowerBack', 'traps'], ['glutes'], ['мост']],
  ['analysis', 'Разбор и анализ', 'wrestling', 'check', [], [], ['разбор', 'видеоразбор']],
];

export const EXERCISE_LIBRARY: LibraryExercise[] = ROWS.map(([slug, name, group, metric, muscles, musclesSecondary = [], aliases]) => ({
  id: `lib:${slug}`,
  name,
  group,
  metric,
  muscles,
  musclesSecondary,
  aliases,
}));

const BY_ID = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

export function libraryExercise(id: string): LibraryExercise | undefined {
  return BY_ID.get(id);
}

/** Упражнение каталога в общем виде: встроенное или своё (группа и метрика по умолчанию). */
export interface CatalogExercise {
  id: string;
  name: string;
  group: ExerciseGroup;
  metric: ExerciseMetric;
  muscles: Muscle[];
  musclesSecondary: Muscle[];
  aliases?: string[];
  notes?: string;
  builtIn: boolean;
}

export function toCatalogExercise(e: Exercise | LibraryExercise): CatalogExercise {
  if ('createdAt' in e) {
    return {
      id: e.id,
      name: e.name,
      group: e.group ?? 'other',
      metric: e.metric ?? 'weight_reps',
      muscles: e.muscles ?? [],
      musclesSecondary: e.musclesSecondary ?? [],
      notes: e.notes,
      builtIn: false,
    };
  }
  return { ...e, builtIn: true };
}

/** Весь каталог: свои упражнения и встроенные (своё с тем же названием заменяет встроенное). */
export function buildCatalog(own: readonly Exercise[]): CatalogExercise[] {
  const ownNames = new Set(own.map((e) => e.name.toLocaleLowerCase('ru-RU')));
  return [
    ...own.map(toCatalogExercise),
    ...EXERCISE_LIBRARY.filter((e) => !ownNames.has(e.name.toLocaleLowerCase('ru-RU'))).map(toCatalogExercise),
  ];
}

const norm = (s: string) => s.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');

/** Поиск по названию и другим названиям: все слова запроса должны встретиться (в любом порядке). */
export function searchCatalog<T extends Pick<CatalogExercise, 'name' | 'aliases'>>(list: readonly T[], query: string): T[] {
  const words = norm(query).split(/[\s,.-]+/).filter(Boolean);
  if (words.length === 0) return [...list];
  return list.filter((e) => {
    const hay = norm([e.name, ...(e.aliases ?? [])].join(' '));
    return words.every((w) => hay.includes(w));
  });
}
