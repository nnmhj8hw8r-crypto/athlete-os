// Нагрузка, «усталость» и «форма» по журналу тренировок (для «Сезона», по мотивам Coach Watts).
// Нагрузка тренировки — длительность (мин) × тяжесть 1–10 (метод session-RPE, Foster и соавт., 2001).
// «Усталость» — экспоненциальное среднее нагрузки за ~7 дней, «готовность к нагрузке» (fitness) — за ~42 дня,
// «форма» = fitness − усталость (модель «импульс — ответ» Банистера в упрощённом виде). Окна 7 и 42 дня —
// условные значения, принятые в тренерских сервисах (ATL/CTL), а не из первоисточника.
// Учитываются только тренировки, где указаны и длительность, и тяжесть; это оценка, а не измерение.
import type { Workout } from './schemas.ts';
import { addDays, toDateKey } from './time.ts';

export interface LoadPoint {
  date: string;
  load: number;
  fatigue: number;
  fitness: number;
  form: number;
}

export function sessionLoad(w: Pick<Workout, 'durationMin' | 'rpe'>): number | null {
  return w.durationMin !== undefined && w.rpe !== undefined ? w.durationMin * w.rpe : null;
}

/** Ряд по дням [from, to]; расчёт начинается с первой тренировки (или с from), чтобы средние «разогрелись». */
export function trainingLoadSeries(workouts: readonly Workout[], from: string, to: string): LoadPoint[] {
  const byDay = new Map<string, number>();
  let first = from;
  for (const w of workouts) {
    const l = sessionLoad(w);
    if (l === null) continue;
    const d = toDateKey(w.startAt);
    byDay.set(d, (byDay.get(d) ?? 0) + l);
    if (d < first) first = d;
  }
  const out: LoadPoint[] = [];
  let atl = 0;
  let ctl = 0;
  for (let d = first; d <= to; d = addDays(d, 1)) {
    const load = byDay.get(d) ?? 0;
    atl += (load - atl) / 7;
    ctl += (load - ctl) / 42;
    if (d >= from) out.push({ date: d, load, fatigue: Math.round(atl), fitness: Math.round(ctl), form: Math.round(ctl - atl) });
  }
  return out;
}

export function hasLoadData(workouts: readonly Workout[]): boolean {
  return workouts.some((w) => sessionLoad(w) !== null);
}
