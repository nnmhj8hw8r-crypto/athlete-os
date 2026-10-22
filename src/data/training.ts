// Данные вкладки «Тренировки»: текущая (незавершённая) тренировка, заметки о технике,
// копирование плана недели. Запись — только через функции этого файла и repo.ts.
import { type WorkoutDraft } from '../domain/training.ts';
import { workoutSchema } from '../domain/schemas.ts';
import { addDays } from '../domain/time.ts';
import { db } from './db.ts';
import { deleteSetting, getSetting, saveEntity, setSetting } from './repo.ts';

const ACTIVE_KEY = 'activeWorkout';
const NOTES_KEY = 'exerciseNotes';

/** Незавершённая тренировка: переживает перезагрузку страницы и закрытие приложения. */
export interface ActiveSession {
  draft: WorkoutDraft;
  /** Редактирование уже сохранённой тренировки. */
  editing?: { id: string; createdAt: string };
  /** Когда нажали «Начать» (мс), для таймера длительности. */
  startedAtMs: number;
}

const draftSchema = workoutSchema.omit({ id: true, createdAt: true, updatedAt: true });

export async function loadActiveSession(): Promise<ActiveSession | null> {
  const raw = await getSetting<ActiveSession>(ACTIVE_KEY);
  if (!raw || typeof raw !== 'object' || typeof raw.startedAtMs !== 'number') return null;
  const parsed = draftSchema.safeParse(raw.draft);
  if (!parsed.success) return null;
  return { draft: parsed.data, editing: raw.editing, startedAtMs: raw.startedAtMs };
}

export async function saveActiveSession(s: ActiveSession): Promise<void> {
  await setSetting(ACTIVE_KEY, s);
}

export async function clearActiveSession(): Promise<void> {
  await deleteSetting(ACTIVE_KEY);
}

export const ACTIVE_SESSION_KEY = ACTIVE_KEY;

/** Сохраняет тренировку (новую или редактируемую) и закрывает текущую сессию. */
export async function finishSession(s: ActiveSession, draft: WorkoutDraft) {
  const r = await saveEntity('workouts', draft, s.editing);
  if (r.ok) await clearActiveSession();
  return r;
}

/** Заметки о технике по id упражнения (и для встроенных, и для своих). */
export async function getExerciseNotes(): Promise<Record<string, string>> {
  return (await getSetting<Record<string, string>>(NOTES_KEY)) ?? {};
}

export async function setExerciseNote(exerciseId: string, text: string): Promise<void> {
  const all = await getExerciseNotes();
  const clean = text.trim();
  if (clean) all[exerciseId] = clean.slice(0, 2000);
  else delete all[exerciseId];
  await setSetting(NOTES_KEY, all);
}

export const EXERCISE_NOTES_KEY = NOTES_KEY;

/** Копирует план недели (7 дней с fromMonday) на неделю toMonday. Уже запланированное не дублируется. */
export async function copyWeekPlan(fromMonday: string, toMonday: string): Promise<number> {
  const src = await db.schedule.where('date').between(fromMonday, addDays(fromMonday, 6), true, true).toArray();
  const existing = await db.schedule.where('date').between(toMonday, addDays(toMonday, 6), true, true).toArray();
  const key = (date: string, slot: string, programId: string) => `${date}|${slot}|${programId}`;
  const have = new Set(existing.map((e) => key(e.date, e.slot, e.programId)));
  let added = 0;
  for (const e of src) {
    const offset = Math.round((Date.parse(`${e.date}T00:00:00Z`) - Date.parse(`${fromMonday}T00:00:00Z`)) / 86400000);
    const date = addDays(toMonday, offset);
    if (have.has(key(date, e.slot, e.programId))) continue;
    const r = await saveEntity('schedule', { date, slot: e.slot, programId: e.programId, notes: e.notes });
    if (r.ok) added++;
  }
  return added;
}
