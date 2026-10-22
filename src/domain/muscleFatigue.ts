// Усталость групп мышц по журналу тренировок (v0.8, по мотивам openGym).
// Каждый выполненный подход даёт вклад: основным мышцам упражнения — 1, вспомогательным — 0,5,
// умноженный на «близость к отказу» по RPE подхода (или тяжести всей тренировки). Вклад линейно
// спадает до нуля за время восстановления группы (по умолчанию 48 ч малые, 72 ч крупные).
// Грубое правило для подсказки, а не измерение; пороги и время восстановления — стартовые.
import { LARGE_MUSCLES } from './muscles.ts';
import { MUSCLES, type Muscle, type Workout, type WorkoutSet } from './schemas.ts';
import { isSetFilled } from './training.ts';

export type FatigueStatus = 'fresh' | 'recovering' | 'fatigued';

export const FATIGUE_LABEL: Record<FatigueStatus, string> = {
  fresh: 'свежая',
  recovering: 'восстанавливается',
  fatigued: 'утомлена',
};

/** Порог «восстанавливается» и «утомлена» в единицах вклада (≈ число тяжёлых подходов). */
export const FATIGUE_THRESHOLDS = { recovering: 1, fatigued: 3.5 } as const;

export interface MuscleLoad {
  muscle: Muscle;
  fatigue: number;
  status: FatigueStatus;
  lastTrainedAt: string | null;
  /** Подходы за 7 дней (вспомогательные — с весом 0,5). */
  weeklySets: number;
}

export interface ExerciseMuscles {
  muscles: readonly Muscle[];
  musclesSecondary: readonly Muscle[];
}

/** Близость к отказу: RPE 10 → 1, 9 → 0,9, 8 → 0,75, 7 → 0,6, ниже — 0,45; без RPE — 0,65. */
export function effortFactor(rpe: number | undefined): number {
  if (rpe === undefined) return 0.65;
  if (rpe >= 9.5) return 1;
  if (rpe >= 9) return 0.9;
  if (rpe >= 8) return 0.75;
  if (rpe >= 7) return 0.6;
  return 0.45;
}

export function statusOf(fatigue: number): FatigueStatus {
  if (fatigue >= FATIGUE_THRESHOLDS.fatigued) return 'fatigued';
  if (fatigue >= FATIGUE_THRESHOLDS.recovering) return 'recovering';
  return 'fresh';
}

export function muscleLoads(
  workouts: readonly Workout[],
  lookup: (exerciseId: string) => ExerciseMuscles | undefined,
  now: Date,
  hours: { small: number; large: number },
): Record<Muscle, MuscleLoad> {
  const out = Object.fromEntries(
    MUSCLES.map((m) => [m, { muscle: m, fatigue: 0, status: 'fresh' as FatigueStatus, lastTrainedAt: null as string | null, weeklySets: 0 }]),
  ) as Record<Muscle, MuscleLoad>;
  const t = now.getTime();
  for (const w of workouts) {
    const ago = (t - Date.parse(w.startAt)) / 3_600_000;
    if (ago < 0 || Number.isNaN(ago)) continue;
    for (const e of w.exercises) {
      if (e.metric === 'check') continue;
      const ex = lookup(e.exerciseId);
      if (!ex) continue;
      const sets = e.sets.filter((s: WorkoutSet) => isSetFilled(s));
      if (!sets.length) continue;
      const add = (m: Muscle, k: number) => {
        const L = out[m];
        const recovery = LARGE_MUSCLES.has(m) ? hours.large : hours.small;
        const decay = Math.max(0, 1 - ago / recovery);
        for (const s of sets) L.fatigue += k * effortFactor(s.rpe ?? w.rpe) * decay;
        if (ago <= 7 * 24) L.weeklySets += k * sets.length;
        if (!L.lastTrainedAt || w.startAt > L.lastTrainedAt) L.lastTrainedAt = w.startAt;
      };
      ex.muscles.forEach((m) => add(m, 1));
      ex.musclesSecondary.filter((m) => !ex.muscles.includes(m)).forEach((m) => add(m, 0.5));
    }
  }
  for (const m of MUSCLES) {
    out[m].fatigue = Math.round(out[m].fatigue * 100) / 100;
    out[m].weeklySets = Math.round(out[m].weeklySets * 10) / 10;
    out[m].status = statusOf(out[m].fatigue);
  }
  return out;
}

/** Группы, которые ещё восстанавливаются или утомлены, — самые уставшие первыми. */
export function recoveringMuscles(loads: Record<Muscle, MuscleLoad>): Muscle[] {
  return MUSCLES.filter((m) => loads[m].status !== 'fresh').sort((a, b) => loads[b].fatigue - loads[a].fatigue);
}
