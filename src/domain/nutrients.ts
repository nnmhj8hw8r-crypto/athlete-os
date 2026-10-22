// Расширенные нутриенты: подписи, единицы, пересчёт на порцию и суммирование с учётом покрытия.
// Главное правило: отсутствие данных не равно нулю. Сумма считается только по записям, где
// значение известно, а рядом показывается, какая доля калорий дня этими данными покрыта.
import { EXTRA_KEYS, type Extra, type ExtraKey } from '../../shared/catalog.ts';

export interface NutrientMeta {
  label: string;
  unit: 'г' | 'мг' | 'мкг';
  group: 'carbs' | 'fats' | 'minerals' | 'other';
  hint?: string;
}

export const NUTRIENT_META: Record<ExtraKey, NutrientMeta> = {
  sugars: { label: 'Сахара (всего)', unit: 'г', group: 'carbs', hint: 'Все сахара: и природные (фрукты, молоко), и добавленные' },
  addedSugars: { label: 'Добавленный сахар', unit: 'г', group: 'carbs', hint: 'Только если источник его указывает' },
  fiber: { label: 'Клетчатка', unit: 'г', group: 'carbs' },
  satFat: { label: 'Насыщенные жиры', unit: 'г', group: 'fats' },
  monoFat: { label: 'Мононенасыщенные жиры', unit: 'г', group: 'fats' },
  polyFat: { label: 'Полиненасыщенные жиры', unit: 'г', group: 'fats' },
  transFat: { label: 'Трансжиры', unit: 'г', group: 'fats' },
  omega3: { label: 'Омега-3', unit: 'г', group: 'fats', hint: 'Сумма ALA, EPA, DHA, DPA — где источник их приводит' },
  cholesterol: { label: 'Холестерин', unit: 'мг', group: 'fats' },
  sodium: { label: 'Натрий', unit: 'мг', group: 'minerals', hint: 'Соль ≈ натрий × 2,5' },
  potassium: { label: 'Калий', unit: 'мг', group: 'minerals' },
  calcium: { label: 'Кальций', unit: 'мг', group: 'minerals' },
  iron: { label: 'Железо', unit: 'мг', group: 'minerals' },
  magnesium: { label: 'Магний', unit: 'мг', group: 'minerals' },
  vitD: { label: 'Витамин D', unit: 'мкг', group: 'minerals' },
  water: { label: 'Вода в еде', unit: 'г', group: 'other' },
};

export const NUTRIENT_GROUPS: { id: NutrientMeta['group']; label: string }[] = [
  { id: 'carbs', label: 'Углеводы' },
  { id: 'fats', label: 'Жиры' },
  { id: 'minerals', label: 'Минералы и витамины' },
  { id: 'other', label: 'Прочее' },
];

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Нутриенты порции из значений на 100 г/мл. Неизвестные остаются неизвестными. */
export function scaleExtra(extra: Extra | undefined, amount: number): Extra | undefined {
  if (!extra) return undefined;
  const k = amount / 100;
  const out: Extra = {};
  for (const key of EXTRA_KEYS) {
    const v = extra[key];
    if (v !== undefined) out[key] = round3(v * k);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Убирает пустые и нечисловые значения (для форм и внешних источников). */
export function cleanExtra(extra: Partial<Record<string, number | undefined>> | undefined): Extra | undefined {
  if (!extra) return undefined;
  const out: Extra = {};
  for (const key of EXTRA_KEYS) {
    const v = extra[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface NutrientTotal {
  /** Сумма по записям, где значение известно. */
  value: number;
  /** Доля калорий (0–1), для которой значение известно. */
  coverage: number;
  /** Сколько записей с данными. */
  known: number;
}

/**
 * Суммирует расширенный нутриент по записям. Покрытие считается по калориям: если клетчатка известна
 * для продуктов, дающих 70% калорий дня, итог — «не меньше X г, данные по 70% калорий».
 */
export function sumExtra(
  entries: readonly { kcal: number; extra?: Extra }[],
): Record<ExtraKey, NutrientTotal> {
  const totalKcal = entries.reduce((s, e) => s + Math.max(0, e.kcal), 0);
  const out = {} as Record<ExtraKey, NutrientTotal>;
  for (const key of EXTRA_KEYS) {
    let value = 0;
    let kcal = 0;
    let known = 0;
    for (const e of entries) {
      const v = e.extra?.[key];
      if (v === undefined) continue;
      value += v;
      kcal += Math.max(0, e.kcal);
      known++;
    }
    const coverage = totalKcal > 0 ? kcal / totalKcal : entries.length && known === entries.length ? 1 : 0;
    out[key] = { value: round3(value), coverage: Math.min(1, coverage), known };
  }
  return out;
}

/** Ниже этой доли покрытия значение показывается как «мало данных». */
export const LOW_COVERAGE = 0.5;

export function formatNutrient(value: number, unit: NutrientMeta['unit']): string {
  if (value > 0 && value < 0.01) return `< 0,01 ${unit}`;
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const r = Number(value.toFixed(digits));
  return `${r.toLocaleString('ru-RU')} ${unit}`;
}

/** Соль по натрию (мг): NaCl ≈ Na × 2,54; на этикетках ЕАЭС пересчёт тот же порядок. */
export const saltFromSodiumMg = (mg: number) => (mg * 2.5) / 1000;
