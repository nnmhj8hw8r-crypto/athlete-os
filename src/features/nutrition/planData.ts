// Личный план питания: хранение в настройках и расчёт целей на день по последнему весу.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db.ts';
import { setSetting } from '../../data/repo.ts';
import { computePlan, nutritionPlanSchema, PLAN_SETTING_KEY, type NutritionPlan, type PlanTargets } from '../../domain/plan.ts';
import type { BodyWeight } from '../../domain/schemas.ts';
import { getZonedParts, todayKey } from '../../domain/time.ts';

export interface PlanState {
  loading: boolean;
  plan?: NutritionPlan;
  /** Последняя запись веса (из общей таблицы массы тела). */
  latestWeight?: BodyWeight;
  targets?: PlanTargets;
}

export function usePlanState(): PlanState {
  // Результат обёрнут в объект: useLiveQuery возвращает undefined и пока идёт загрузка, и когда записи нет —
  // без обёртки «плана ещё нет» нельзя отличить от «ещё загружается».
  const data = useLiveQuery(
    async () => ({
      raw: await db.settings.get(PLAN_SETTING_KEY),
      latestWeight: await db.bodyWeights.orderBy('measuredAt').last(),
    }),
    [],
  );
  if (!data) return { loading: true };
  const { raw, latestWeight } = data;
  const parsed = raw ? nutritionPlanSchema.safeParse(raw.value) : null;
  const plan = parsed?.success ? parsed.data : undefined;
  const targets =
    plan && latestWeight ? computePlan(plan, latestWeight.weightKg, todayKey(), getZonedParts(new Date()).year) : undefined;
  return { loading: false, plan, latestWeight: latestWeight ?? undefined, targets };
}

export async function savePlan(plan: NutritionPlan): Promise<void> {
  await setSetting(PLAN_SETTING_KEY, nutritionPlanSchema.parse(plan));
}
