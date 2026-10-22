import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity, deleteSetting, setSetting } from '../../data/repo.ts';
import type { SleepEntry } from '../../domain/schemas.ts';
import { estimatedSleepMinutes, RATING_FIELDS, RATING_META, recoveryAverages, timeInBedMinutes } from '../../domain/sleep.ts';
import { formatDateKey, formatDateTime, formatDuration, formatTime, toDateKey } from '../../domain/time.ts';
import { Card, EmptyState, Page, RowActions } from '../../ui/components.tsx';
import { useConfirmDelete, useFeedback } from '../../ui/feedback.tsx';
import { clearParam, type Route } from '../../ui/router.ts';
import { SleepChart, SleepStrip, WellbeingChart } from './RecoveryCharts.tsx';
import { SleepDialog } from './SleepDialog.tsx';

export const PENDING_SLEEP_KEY = 'pendingSleepStart';

export function usePendingSleep(): string | undefined {
  return useLiveQuery(async () => (await db.settings.get(PENDING_SLEEP_KEY))?.value as string | undefined, []);
}

export function RecoveryPage({ route }: { route: Route }) {
  const entries = useLiveQuery(() => db.sleep.orderBy('wakeTime').reverse().toArray(), []);
  const pending = usePendingSleep();
  const { notify } = useFeedback();
  const confirmDelete = useConfirmDelete();
  const [dialog, setDialog] = useState<{ entry?: SleepEntry; initial?: { bedtime?: string; wakeTime?: string }; fromPending?: boolean } | null>(null);

  useEffect(() => {
    if (route.params.get('add') === '1') {
      setDialog({});
      clearParam(route, 'add');
    }
  }, [route]);

  async function startSleep() {
    await setSetting(PENDING_SLEEP_KEY, new Date().toISOString());
    notify('Время отхода ко сну отмечено. Утром нажмите «Проснулся».');
  }

  return (
    <Page title="Восстановление" subtitle="Сон и субъективное самочувствие">
      <SleepHero pending={pending} onStart={startSleep} onWake={() => pending && setDialog({ initial: { bedtime: pending, wakeTime: new Date().toISOString() }, fromPending: true })} onManual={() => setDialog({})} />

      {entries && entries.length > 0 && (
        <>
          <SleepStrip />
          <SleepChart />
          <WellbeingChart />
          <Trends entries={entries} />
        </>
      )}

      <section className="section">
        <h2>История</h2>
        {entries === undefined ? (
          <p className="muted">Загрузка…</p>
        ) : entries.length === 0 ? (
          <EmptyState>Записей пока нет. Отметьте отход ко сну кнопкой «Лёг спать» или введите время вручную.</EmptyState>
        ) : (
          <ul className="list">
            {entries.map((s) => {
              const inBed = timeInBedMinutes(s.bedtime, s.wakeTime);
              const est = estimatedSleepMinutes(s);
              const ratings = RATING_FIELDS.filter((k) => s[k] !== undefined).map((k) => `${RATING_META[k].label}: ${s[k]}/5`);
              const label = formatDateKey(toDateKey(s.wakeTime));
              return (
                <li key={s.id} className="list-item">
                  <div className="grow">
                    <div className="title">{label}</div>
                    <div className="meta">
                      {formatTime(s.bedtime)}–{formatTime(s.wakeTime)}
                      {inBed !== null && ` · в постели ${formatDuration(inBed)}`}
                      {est !== null && ` · оценка сна ${formatDuration(est)}`}
                    </div>
                    {ratings.length > 0 && <div className="meta">{ratings.join(' · ')}</div>}
                    {s.notes && <div className="meta">{s.notes}</div>}
                  </div>
                  <RowActions label={`запись за ${label}`} onEdit={() => setDialog({ entry: s })} onDelete={() => confirmDelete(`Запись за ${label}`, () => deleteEntity('sleep', s.id))} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dialog && (
        <SleepDialog
          entry={dialog.entry}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSaved={dialog.fromPending ? () => void deleteSetting(PENDING_SLEEP_KEY) : undefined}
        />
      )}
    </Page>
  );
}

/** Крупная карточка сна: «Лёг спать» или идущий сон с таймером и «Проснулся». */
function SleepHero({ pending, onStart, onWake, onManual }: { pending: string | undefined; onStart: () => void; onWake: () => void; onManual: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [pending]);
  if (pending) {
    const min = Math.max(0, Math.round((now - Date.parse(pending)) / 60_000));
    return (
      <section className="hero-card">
        <span className="hero-label">Сон идёт</span>
        <b className="hero-value num">{formatDuration(min)}</b>
        <span className="muted">с {formatDateTime(pending)}</span>
        <div className="row">
          <button type="button" className="btn primary big" onClick={onWake}>
            Проснулся
          </button>
          <button type="button" className="btn ghost" onClick={() => deleteSetting(PENDING_SLEEP_KEY)}>
            Отменить отметку
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="hero-card">
      <span className="hero-label">Сон</span>
      <span className="muted">Отметьте отход ко сну, утром — пробуждение и самочувствие.</span>
      <div className="row">
        <button type="button" className="btn primary big" onClick={onStart}>
          Лёг спать
        </button>
        <button type="button" className="btn ghost" onClick={onManual}>
          Ввести вручную
        </button>
      </div>
    </section>
  );
}

function Trends({ entries }: { entries: SleepEntry[] }) {
  const last = recoveryAverages(entries.slice(0, 7));
  const prev = recoveryAverages(entries.slice(7, 14));
  const fmt = (v: number | null, kind: 'min' | 'score') => (v === null ? '—' : kind === 'min' ? formatDuration(v) : `${v.toLocaleString('ru-RU')}/5`);
  const rows: { label: string; a: string; b: string }[] = [
    { label: 'Время в постели', a: fmt(last.timeInBedMin, 'min'), b: fmt(prev.timeInBedMin, 'min') },
    ...RATING_FIELDS.map((k) => ({ label: RATING_META[k].label, a: fmt(last[k], 'score'), b: fmt(prev[k], 'score') })),
  ];
  return (
    <Card title="Тенденции">
      <table className="set-table">
        <thead>
          <tr>
            <th>Показатель</th>
            <th>Последние {last.count}</th>
            <th>{prev.count ? `Предыдущие ${prev.count}` : 'Предыдущие'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="num">{r.a}</td>
              <td className="num">{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">
        Средние по вашим записям — описание, а не диагноз. Одна-две записи не говорят о перетренированности, а совпадение двух показателей не доказывает причину.
      </p>
    </Card>
  );
}
