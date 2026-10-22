import { describe, expect, it } from 'vitest';
import { bmrMifflin, computePlan, daysBetween, nutritionPlanSchema, waterTargetFor, type NutritionPlan } from './plan.ts';

const base: NutritionPlan = nutritionPlanSchema.parse({
  sex: 'male',
  birthYear: 2000,
  heightCm: 178,
  activity: 'high',
  goal: 'maintain',
  proteinPerKg: 1.8,
  fatPct: 25,
});

describe('личный план', () => {
  it('Миффлин — Сан Жеор', () => {
    // 10·75 + 6,25·178 − 5·26 + 5 = 1737,5
    expect(bmrMifflin('male', 75, 178, 26)).toBe(1737.5);
  });

  it('поддержание: калории = расход, белок по г/кг, жиры по доле', () => {
    const t = computePlan(base, 75, '2026-10-22', 2026);
    expect(t.bmr).toBe(1738);
    expect(t.tdee).toBe(Math.round(1737.5 * 1.725));
    expect(t.kcal).toBe(t.tdee);
    expect(t.protein).toBe(135);
    expect(t.fat).toBe(Math.round((t.kcal * 0.25) / 9));
    expect(t.weeklyChangeKg).toBeNull();
    expect(t.waterMl).toBe(2000);
  });

  it('цель к дате: темп и дефицит, предупреждение о темпе > 1%/нед', () => {
    const slow = computePlan({ ...base, goal: 'target', targetWeightKg: 73, targetDate: '2026-12-03' }, 75, '2026-10-22', 2026);
    expect(slow.daysLeft).toBe(42);
    expect(slow.weeklyChangeKg).toBeCloseTo(-0.33, 2);
    expect(slow.warnings.some((w) => w.includes('1%/нед'))).toBe(false);

    const fast = computePlan({ ...base, goal: 'target', targetWeightKg: 71, targetDate: '2026-10-29' }, 75, '2026-10-22', 2026);
    expect(fast.weeklyChangePct).toBeLessThan(-1);
    expect(fast.warnings.some((w) => w.includes('1%/нед'))).toBe(true);
    // калорийность не опускается ниже основного обмена, показан реалистичный прогноз
    expect(fast.kcal).toBe(fast.bmr);
    expect(fast.warnings.some((w) => w.includes('ограничена основным обменом'))).toBe(true);
  });

  it('прошедшая дата цели — предупреждение без деления на ноль', () => {
    const t = computePlan({ ...base, goal: 'target', targetWeightKg: 73, targetDate: '2026-10-01' }, 75, '2026-10-22', 2026);
    expect(t.weeklyChangeKg).toBeNull();
    expect(t.warnings[0]).toMatch(/прошла/);
  });

  it('вода: своя цель на дату важнее общей', () => {
    const plan = { ...base, waterOverrides: { '2026-11-10': 4000 } };
    expect(waterTargetFor(plan, '2026-11-10', 2000)).toEqual({ ml: 4000, custom: true });
    expect(waterTargetFor(plan, '2026-11-11', 2000)).toEqual({ ml: 2000, custom: false });
  });

  it('дни между датами', () => {
    expect(daysBetween('2026-10-22', '2026-10-29')).toBe(7);
  });
});
