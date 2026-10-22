// Замеры и тесты (v0.5): встроенный список общих тестов физической подготовки и свои тесты
// пользователя. Нормативов и оценок «хорошо/плохо» нет — только собственная динамика.
import type { TestDef, TestResult, TestUnit } from './schemas.ts';
import { formatClock, parseClock } from './training.ts';

export const TEST_UNIT_LABEL: Record<TestUnit, string> = {
  reps: 'раз',
  sec: 'время',
  cm: 'см',
  kg: 'кг',
  m: 'м',
  other: '',
};

export type TestCategory = 'strength' | 'speed' | 'grip' | 'endurance' | 'body' | 'own';

export const TEST_CATEGORY_LABEL: Record<TestCategory, string> = {
  strength: 'Сила',
  speed: 'Скоростно-силовые',
  grip: 'Хват и предплечья',
  endurance: 'Выносливость',
  body: 'Обхваты',
  own: 'Мои тесты',
};

export interface FitnessTest {
  id: string;
  name: string;
  unit: TestUnit;
  unitLabel?: string;
  higherIsBetter: boolean;
  category: TestCategory;
  /** Как проводить, чтобы результаты были сравнимы между собой. */
  hint?: string;
  builtIn: boolean;
}

type Row = [slug: string, name: string, unit: TestUnit, higherIsBetter: boolean, category: TestCategory, hint?: string];

const ROWS: Row[] = [
  ['pullups-max', 'Подтягивания — максимум', 'reps', true, 'strength', 'Полная амплитуда, без рывков. Записывайте одинаковый хват.'],
  ['pullups-1min', 'Подтягивания за 1 минуту', 'reps', true, 'endurance', 'Число полных повторений за 60 секунд.'],
  ['pushups-max', 'Отжимания — максимум', 'reps', true, 'strength'],
  ['dips-max', 'Отжимания на брусьях — максимум', 'reps', true, 'strength'],
  ['bench-1rm', 'Жим лёжа — максимум', 'kg', true, 'strength', 'Разовый максимум или рабочий вес на 1 повторение. Отмечайте в заметке, если это расчёт.'],
  ['squat-1rm', 'Приседания — максимум', 'kg', true, 'strength'],
  ['deadlift-1rm', 'Становая тяга — максимум', 'kg', true, 'strength'],
  ['rope-nolegs', 'Канат без ног — время подъёма', 'sec', false, 'speed', 'Укажите высоту каната в заметке (например, 5 м). Время в формате м:сс или в секундах.'],
  ['rope-nolegs-count', 'Канат без ног — подъёмов подряд', 'reps', true, 'endurance'],
  ['broad-jump', 'Прыжок в длину с места', 'cm', true, 'speed', 'Лучшая из трёх попыток.'],
  ['sprint-30', 'Бег 30 м', 'sec', false, 'speed', 'С высокого старта. Можно вводить с десятыми: 4,6.'],
  ['run-3km', 'Бег 3 км', 'sec', false, 'endurance', 'Время в формате м:сс, например 12:40.'],
  ['abs-1min', 'Подъёмы туловища за 1 минуту', 'reps', true, 'endurance'],
  ['hang-bar', 'Вис на перекладине', 'sec', true, 'grip'],
  ['hang-gi', 'Вис на кимоно (полотенце)', 'sec', true, 'grip'],
  ['grip-right', 'Кистевой динамометр — правая', 'kg', true, 'grip'],
  ['grip-left', 'Кистевой динамометр — левая', 'kg', true, 'grip'],
  ['forearm-right', 'Обхват предплечья — правое', 'cm', true, 'body', 'В самом широком месте, рука расслаблена.'],
  ['forearm-left', 'Обхват предплечья — левое', 'cm', true, 'body', 'В самом широком месте, рука расслаблена.'],
  ['neck', 'Обхват шеи', 'cm', true, 'body'],
];

export const BUILT_IN_TESTS: FitnessTest[] = ROWS.map(([slug, name, unit, higherIsBetter, category, hint]) => ({
  id: `lib:${slug}`,
  name,
  unit,
  higherIsBetter,
  category,
  hint,
  builtIn: true,
}));

export function ownTest(d: TestDef): FitnessTest {
  return { id: d.id, name: d.name, unit: d.unit, unitLabel: d.unitLabel, higherIsBetter: d.higherIsBetter, category: 'own', hint: d.notes, builtIn: false };
}

export function allTests(own: readonly TestDef[]): FitnessTest[] {
  return [...BUILT_IN_TESTS, ...own.map(ownTest)];
}

const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString('ru-RU');

/** Значение с единицей: 12 раз, 4,6 с, 12:40, 42 см. */
export function formatTestValue(t: Pick<FitnessTest, 'unit' | 'unitLabel'>, value: number): string {
  if (t.unit === 'sec') return value < 60 ? `${num(value)} с` : formatClock(value);
  const u = t.unit === 'other' ? (t.unitLabel ?? '') : TEST_UNIT_LABEL[t.unit];
  return u ? `${num(value)} ${u}` : num(value);
}

/** Ввод значения: для времени — «12:40» или секунды с запятой, для остального — число с запятой. */
export function parseTestValue(t: Pick<FitnessTest, 'unit'>, raw: string): number | undefined {
  const v = raw.trim().replace(',', '.');
  if (!v) return undefined;
  if (t.unit === 'sec' && v.includes(':')) return parseClock(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Лучший результат с учётом направления (больше или меньше — лучше). */
export function bestResult(t: Pick<FitnessTest, 'higherIsBetter'>, results: readonly TestResult[]): TestResult | undefined {
  let best: TestResult | undefined;
  for (const r of results) {
    if (!best || (t.higherIsBetter ? r.value > best.value : r.value < best.value)) best = r;
  }
  return best;
}

/** Последний по дате результат (при равной дате — позже созданный). */
export function latestResult(results: readonly TestResult[]): TestResult | undefined {
  return [...results].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
}

/** Изменение последнего результата к предыдущему; improved учитывает направление теста. */
export function lastChange(
  t: Pick<FitnessTest, 'higherIsBetter'>,
  results: readonly TestResult[],
): { delta: number; improved: boolean } | null {
  const sorted = [...results].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const [last, prev] = sorted;
  if (!last || !prev) return null;
  const delta = Math.round((last.value - prev.value) * 100) / 100;
  return { delta, improved: t.higherIsBetter ? delta > 0 : delta < 0 };
}
