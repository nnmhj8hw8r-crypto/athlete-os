// Крупная карточка сна: «Лёг спать» или идущий сон с таймером и «Проснулся». Самостоятельная — с ней
// работают и «Восстановление», и виджет главной (v0.9). Начало сна хранится в settings.pendingSleepStart.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db.ts';
import { deleteSetting, setSetting } from '../../data/repo.ts';
import { formatDateTime, formatDuration } from '../../domain/time.ts';
import { useFeedback } from '../../ui/feedback.tsx';
import { SleepDialog } from './SleepDialog.tsx';

export const PENDING_SLEEP_KEY = 'pendingSleepStart';

export function usePendingSleep(): string | undefined {
  return useLiveQuery(async () => (await db.settings.get(PENDING_SLEEP_KEY))?.value as string | undefined, []);
}

export function SleepHero() {
  const pending = usePendingSleep();
  const { notify } = useFeedback();
  const [dialog, setDialog] = useState<{
    initial?: { bedtime: string; wakeTime: string };
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [pending]);

  async function start() {
    await setSetting(PENDING_SLEEP_KEY, new Date().toISOString());
    notify('Время отхода ко сну отмечено. Утром нажмите «Проснулся».');
  }

  const dialogEl = dialog && (
    <SleepDialog initial={dialog.initial} onClose={() => setDialog(null)} onSaved={dialog.initial ? () => void deleteSetting(PENDING_SLEEP_KEY) : undefined} />
  );

  if (pending) {
    const min = Math.max(0, Math.round((now - Date.parse(pending)) / 60_000));
    return (
      <>
        <section className="hero-card">
          <span className="hero-label">Сон идёт</span>
          <b className="hero-value num">{formatDuration(min)}</b>
          <span className="muted">с {formatDateTime(pending)}</span>
          <div className="row">
            <button
              type="button"
              className="btn primary big"
              onClick={() =>
                setDialog({
                  initial: {
                    bedtime: pending,
                    wakeTime: new Date().toISOString(),
                  },
                })
              }
            >
              Проснулся
            </button>
            <button type="button" className="btn ghost" onClick={() => deleteSetting(PENDING_SLEEP_KEY)}>
              Отменить отметку
            </button>
          </div>
        </section>
        {dialogEl}
      </>
    );
  }
  return (
    <>
      <section className="hero-card">
        <span className="hero-label">Сон</span>
        <span className="muted">Отметьте отход ко сну, утром — пробуждение и самочувствие.</span>
        <div className="row">
          <button type="button" className="btn primary big" onClick={start}>
            Лёг спать
          </button>
          <button type="button" className="btn ghost" onClick={() => setDialog({})}>
            Ввести вручную
          </button>
        </div>
      </section>
      {dialogEl}
    </>
  );
}
