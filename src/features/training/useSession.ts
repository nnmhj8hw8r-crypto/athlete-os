// Запуск и чтение текущей тренировки из любого экрана вкладки.
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { db } from '../../data/db.ts';
import { withoutMeta } from '../../data/repo.ts';
import { ACTIVE_SESSION_KEY, loadActiveSession, saveActiveSession, type ActiveSession } from '../../data/training.ts';
import type { Workout } from '../../domain/schemas.ts';
import { markRecordedDone, type WorkoutDraft } from '../../domain/training.ts';
import { useFeedback } from '../../ui/feedback.tsx';
import { navigate } from '../../ui/router.ts';

/** Текущая тренировка (null — нет, undefined — загрузка). */
export function useActiveSession(): ActiveSession | null | undefined {
  return useLiveQuery(async () => {
    await db.settings.get(ACTIVE_SESSION_KEY); // подписка на изменения ключа
    return loadActiveSession();
  }, []);
}

/** Начать новую тренировку или открыть сохранённую для правки. Спрашивает, если другая уже идёт. */
export function useStartSession() {
  const { confirm } = useFeedback();
  return useCallback(
    async (draft: WorkoutDraft, editing?: Workout) => {
      const current = await loadActiveSession();
      if (current) {
        const ok = await confirm({
          title: 'Уже идёт тренировка',
          message: `«${current.draft.title}» ещё не сохранена. Закрыть её без сохранения и начать новую?`,
          confirmLabel: 'Закрыть и начать',
          danger: true,
        });
        if (!ok) {
          navigate('/training/session');
          return;
        }
      }
      await saveActiveSession({
        draft,
        editing: editing ? { id: editing.id, createdAt: editing.createdAt } : undefined,
        startedAtMs: editing ? Date.parse(editing.startAt) : Date.now(),
      });
      navigate('/training/session');
    },
    [confirm],
  );
}

/** Тренировка из журнала → черновик для правки (служебные поля убираются). */
export function draftOf(w: Workout): WorkoutDraft {
  return markRecordedDone(withoutMeta(w));
}
