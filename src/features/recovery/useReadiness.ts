// Готовность на сегодня и усталость мышц — одна точка расчёта для «Восстановления», «Тренировок»,
// «Питания» и «Сезона», чтобы цифры везде совпадали.
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { READINESS_CONFIG_KEY } from '../../data/checkins.ts';
import { db } from '../../data/db.ts';
import { muscleLoads, recoveringMuscles, type MuscleLoad } from '../../domain/muscleFatigue.ts';
import { computeReadiness, normalizeReadinessConfig, type ReadinessConfig, type ReadinessResult } from '../../domain/readiness.ts';
import type { Checkin, Muscle } from '../../domain/schemas.ts';
import { todayKey } from '../../domain/time.ts';
import { useCatalogMap } from '../training/catalog.tsx';

export interface ReadinessState {
  today: string;
  config: ReadinessConfig;
  checkins: Checkin[];
  todayCheckin: Checkin | undefined;
  result: ReadinessResult;
  loads: Record<Muscle, MuscleLoad>;
  recovering: Muscle[];
}

export function useReadinessConfig(): ReadinessConfig | undefined {
  const raw = useLiveQuery(async () => (await db.settings.get(READINESS_CONFIG_KEY)) ?? null, []);
  return raw === undefined ? undefined : normalizeReadinessConfig(raw?.value);
}

export function useReadiness(): ReadinessState | undefined {
  const config = useReadinessConfig();
  const checkins = useLiveQuery(() => db.checkins.orderBy('date').toArray(), []);
  const since = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const workouts = useLiveQuery(() => db.workouts.where('startAt').above(since).toArray(), []);
  const catalog = useCatalogMap();
  return useMemo(() => {
    if (!config || !checkins || !workouts) return undefined;
    const today = todayKey();
    const loads = muscleLoads(workouts, (id) => catalog.get(id), new Date(), { small: config.recoveryHoursSmall, large: config.recoveryHoursLarge });
    return {
      today,
      config,
      checkins,
      todayCheckin: checkins.find((c) => c.date === today),
      result: computeReadiness(checkins, today, config),
      loads,
      recovering: recoveringMuscles(loads),
    };
  }, [config, checkins, workouts, catalog]);
}
