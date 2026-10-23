// Личный план питания: расчёт энергии и БЖУ, темп изменения массы к взвешиванию, вода.
//
// Это оценки по общепринятым формулам, а не медицинское назначение. Цели и параметры задаёт
// пользователь; приложение только считает и предупреждает о рискованном темпе. Источники — PLAN_SOURCES.
// Протоколы острой сгонки (обезвоживание, «водная загрузка» с последующим ограничением) приложение
// не рассчитывает: для особых дней пользователь вводит свою цель по воде, назначенную специалистом.
import { z } from 'zod';
import { isValidDateKey } from './time.ts';

const dateKey = z.string().refine(isValidDateKey, 'Некорректная дата');

export const ACTIVITY_LEVELS = ['low', 'moderate', 'high', 'very_high'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** Множители физической активности к основному обмену (общепринятые коэффициенты). */
export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = { low: 1.375, moderate: 1.55, high: 1.725, very_high: 1.9 };
export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  low: 'Лёгкая: 1–3 тренировки в неделю',
  moderate: 'Средняя: 3–5 тренировок в неделю',
  high: 'Высокая: 6–7 тренировок в неделю',
  very_high: 'Очень высокая: 2 тренировки в день',
};

export const nutritionPlanSchema = z.object({
  sex: z.enum(['male', 'female']),
  birthYear: z.number().int().min(1930, 'Проверьте год').max(2020, 'Проверьте год'),
  heightCm: z.number().min(120, 'Проверьте рост').max(230, 'Проверьте рост'),
  activity: z.enum(ACTIVITY_LEVELS),
  goal: z.enum(['maintain', 'target']),
  /** Цель по массе: вручную или из выбранного соревнования. */
  targetWeightKg: z.number().min(30).max(250).optional(),
  targetDate: dateKey.optional(),
  competitionId: z.string().optional(),
  proteinPerKg: z.number().min(1, 'От 1 до 3 г/кг').max(3, 'От 1 до 3 г/кг'),
  fatPct: z.number().min(15, 'От 15 до 40%').max(40, 'От 15 до 40%'),
  /** Своя дневная цель по воде из напитков, мл. Пусто — ориентир по EFSA. */
  waterMl: z.number().int().min(500).max(10_000).optional(),
  /** Цель по воде на конкретные дни (например, назначение тренера или врача). */
  waterOverrides: z.record(dateKey, z.number().int().min(0).max(15_000)).default({}),
});
export type NutritionPlan = z.infer<typeof nutritionPlanSchema>;

export const PLAN_SETTING_KEY = 'nutritionPlan';

/** Основной обмен по Миффлину — Сан Жеору (1990), ккал/сут. */
export function bmrMifflin(sex: NutritionPlan['sex'], weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Грубая энергетическая оценка 1 кг массы тела (≈7700 ккал). Реальная динамика отличается. */
export const KCAL_PER_KG = 7700;

/** Темп снижения выше 1% массы тела в неделю — повод для предупреждения (см. PLAN_SOURCES). */
export const FAST_LOSS_PCT_PER_WEEK = 1;

/** Ориентир EFSA: адекватное потребление общей воды (из напитков и еды), мл/сут. */
export const EFSA_TOTAL_WATER_ML: Record<NutritionPlan['sex'], number> = { male: 2500, female: 2000 };
/** Доля воды из напитков (EFSA: около 70–80%, остальное — из еды). Берём 80% как ориентир. */
export const DRINKS_SHARE = 0.8;

export interface PlanTargets {
  weightKg: number;
  age: number;
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  carbsPerKg: number;
  /** Изменение массы в неделю, кг (минус — снижение). */
  weeklyChangeKg: number | null;
  weeklyChangePct: number | null;
  daysLeft: number | null;
  waterMl: number;
  warnings: string[];
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

export function computePlan(plan: NutritionPlan, weightKg: number, todayKey: string, currentYear: number): PlanTargets {
  const age = currentYear - plan.birthYear;
  const bmr = bmrMifflin(plan.sex, weightKg, plan.heightCm, age);
  const tdee = bmr * ACTIVITY_FACTOR[plan.activity];
  const warnings: string[] = [];

  let weeklyChangeKg: number | null = null;
  let daysLeft: number | null = null;
  let delta = 0;
  if (plan.goal === 'target' && plan.targetWeightKg !== undefined && plan.targetDate) {
    daysLeft = daysBetween(todayKey, plan.targetDate);
    if (daysLeft <= 0) {
      warnings.push('Дата цели уже прошла — обновите цель или выберите следующее соревнование.');
    } else {
      const diff = plan.targetWeightKg - weightKg;
      weeklyChangeKg = (diff / daysLeft) * 7;
      delta = (diff * KCAL_PER_KG) / daysLeft;
    }
  }
  const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const weeklyChangePct = weeklyChangeKg === null ? null : (weeklyChangeKg / weightKg) * 100;
  if (weeklyChangePct !== null && weeklyChangePct < -FAST_LOSS_PCT_PER_WEEK) {
    warnings.push(
      `Нужный темп — ${fmt(Math.abs(weeklyChangePct))}% массы в неделю. Это быстрее 1%/нед: при быстром снижении ` +
        'спортсмены чаще теряют мышечную массу и силу. Обсудите цель с тренером или спортивным врачом; ' +
        'приложение не рассчитывает сгонку за счёт воды.',
    );
  }

  // Цель ниже основного обмена приложение не предлагает: ограничиваем калорийность и честно
  // показываем, к какому весу такой режим приведёт к дате.
  let kcal = tdee + delta;
  if (kcal < bmr) {
    kcal = bmr;
    const expectedWeekly = ((bmr - tdee) / KCAL_PER_KG) * 7;
    const expectedAtDate = daysLeft ? weightKg + (expectedWeekly / 7) * daysLeft : weightKg;
    warnings.push(
      `Безопасно выйти на цель к этой дате не получится: калорийность ограничена основным обменом (${Math.round(bmr)} ккал). ` +
        `При таком питании ожидается около ${fmt(expectedWeekly)} кг/нед, к дате — примерно ${fmt(expectedAtDate)} кг. ` +
        'Пересмотрите дату или цель вместе с тренером.',
    );
  }
  const protein = plan.proteinPerKg * weightKg;
  const fat = (kcal * plan.fatPct) / 100 / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  const carbsPerKg = carbs / weightKg;
  if (carbsPerKg < 3) {
    warnings.push(
      `Углеводы ${fmt(carbsPerKg)} г/кг — ниже 3 г/кг, нижней границы для лёгкой нагрузки по совместной позиции ACSM. ` +
        'Для интенсивных тренировок этого может не хватить.',
    );
  }
  const waterMl = plan.waterMl ?? Math.round((EFSA_TOTAL_WATER_ML[plan.sex] * DRINKS_SHARE) / 50) * 50;

  return {
    weightKg,
    age,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
    carbsPerKg: Math.round(carbsPerKg * 10) / 10,
    weeklyChangeKg: weeklyChangeKg === null ? null : Math.round(weeklyChangeKg * 100) / 100,
    weeklyChangePct: weeklyChangePct === null ? null : Math.round(weeklyChangePct * 10) / 10,
    daysLeft,
    waterMl,
    warnings,
  };
}

/** Цель по воде на день: своя цель на дату важнее общей. */
export function waterTargetFor(plan: NutritionPlan | undefined, dateKey: string, fallbackMl: number): { ml: number; custom: boolean } {
  const custom = plan?.waterOverrides[dateKey];
  if (custom !== undefined) return { ml: custom, custom: true };
  return { ml: fallbackMl, custom: false };
}

export const PLAN_SOURCES = [
  'Mifflin MD, St Jeor ST и др. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241–247.',
  'Jäger R и др. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20 (белок 1,4–2,0 г/кг в сутки).',
  'Thomas DT, Erdman KA, Burke LM. ACSM / Academy of Nutrition and Dietetics / Dietitians of Canada: Nutrition and Athletic Performance. Med Sci Sports Exerc. 2016;48(3):543–568 (углеводы 3–10 г/кг в зависимости от нагрузки, жиры 20–35% энергии).',
  'Garthe I и др. Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. Int J Sport Nutr Exerc Metab. 2011;21(2):97–104 (≈0,7%/нед против ≈1,4%/нед).',
  'EFSA Panel on Dietetic Products, Nutrition and Allergies. Scientific Opinion on Dietary reference values for water. EFSA Journal. 2010;8(3):1459 (2,5 л/сут мужчинам, 2,0 л/сут женщинам — общая вода).',
];

// ---------- Фактический расход по вашим данным (v0.9.5) ----------

/** Окно оценки и минимум данных: короче — шум воды и соли в весе сильнее реального тренда. */
export const ADAPTIVE_WINDOW_DAYS = 21;
export const ADAPTIVE_MIN_LOGGED_DAYS = 14;
export const ADAPTIVE_MIN_WEIGHTS = 4;
export const ADAPTIVE_MIN_SPAN_DAYS = 14;

export interface ActualBurn {
  loggedDays: number;
  avgIntakeKcal: number;
  /** Тренд массы по прямой (наименьшие квадраты), кг/нед. */
  weeklyTrendKg: number;
  /** Фактический расход: средний рацион минус энергия изменения массы. */
  tdee: number;
  /** Сколько есть, чтобы идти с нужным темпом (null — нет цели или темпа). */
  suggestedKcal: number | null;
}

/**
 * Оценка реального расхода по записям: если ел в среднем X ккал и масса менялась на Δ кг/нед,
 * расход ≈ X − Δ × 7700 / 7. Работает, только если питание записано почти полностью — иначе расход занижен.
 * Возвращает null, пока данных мало (меньше 14 дней питания или 4 взвешиваний за 14+ дней).
 */
export function estimateActualBurn(
  intakeByDay: ReadonlyMap<string, number>,
  weights: readonly { date: string; kg: number }[],
  todayKey: string,
  targetWeeklyKg: number | null,
): ActualBurn | null {
  const from = Date.parse(`${todayKey}T00:00:00Z`) - (ADAPTIVE_WINDOW_DAYS - 1) * 86_400_000;
  const inWindow = (d: string) => {
    const t = Date.parse(`${d}T00:00:00Z`);
    return t >= from && d <= todayKey;
  };
  const days = [...intakeByDay].filter(([d, k]) => inWindow(d) && k > 0);
  const pts = weights.filter((w) => inWindow(w.date)).map((w) => ({ x: (Date.parse(`${w.date}T00:00:00Z`) - from) / 86_400_000, y: w.kg }));
  if (days.length < ADAPTIVE_MIN_LOGGED_DAYS || pts.length < ADAPTIVE_MIN_WEIGHTS) return null;
  const span = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
  if (span < ADAPTIVE_MIN_SPAN_DAYS) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const slopePerDay = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const avgIntakeKcal = days.reduce((s, [, k]) => s + k, 0) / days.length;
  const tdee = avgIntakeKcal - slopePerDay * KCAL_PER_KG;
  return {
    loggedDays: days.length,
    avgIntakeKcal: Math.round(avgIntakeKcal),
    weeklyTrendKg: Math.round(slopePerDay * 7 * 100) / 100,
    tdee: Math.round(tdee),
    suggestedKcal: targetWeeklyKg === null ? null : Math.round(tdee + (targetWeeklyKg * KCAL_PER_KG) / 7),
  };
}
