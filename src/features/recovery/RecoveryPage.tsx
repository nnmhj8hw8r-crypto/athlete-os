import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity } from '../../data/repo.ts';
import type { SleepEntry } from '../../domain/schemas.ts';
import { estimatedSleepMinutes, RATING_FIELDS, RATING_META, recoveryAverages, timeInBedMinutes } from '../../domain/sleep.ts';
import { formatDateKey, formatDuration, formatTime, toDateKey } from '../../domain/time.ts';
import { Card, EmptyState, Page, RowActions } from '../../ui/components.tsx';
import { useConfirmDelete } from '../../ui/feedback.tsx';
import { clearParam, type Route } from '../../ui/router.ts';
import { SleepChart, SleepStrip, WellbeingChart } from './RecoveryCharts.tsx';
import { CheckinDialog } from './CheckinDialog.tsx';
import { MuscleFatigueCard } from './MuscleFatigueCard.tsx';
import { ReadinessCard } from './ReadinessCard.tsx';
import { ReadinessHistory } from './ReadinessHistory.tsx';
import { ReadinessSettingsDialog } from './ReadinessSettingsDialog.tsx';
import { SleepDialog } from './SleepDialog.tsx';
import { SleepHero } from './SleepHero.tsx';
import { useReadiness } from './useReadiness.ts';

export function RecoveryPage({ route }: { route: Route }) {
  const entries = useLiveQuery(() => db.sleep.orderBy('wakeTime').reverse().toArray(), []);

  const confirmDelete = useConfirmDelete();
  const readiness = useReadiness();
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dialog, setDialog] = useState<{ entry?: SleepEntry } | null>(null);

  useEffect(() => {
    if (route.params.get('add') === '1') {
      setDialog({});
      clearParam(route, 'add');
    }
    if (route.params.get('checkin') === '1') {
      setCheckinOpen(true);
      clearParam(route, 'checkin');
    }
  }, [route]);

  return (
    <Page title="Восстановление">
      {readiness ? (
        <>
          <ReadinessCard state={readiness} onCheckin={() => setCheckinOpen(true)} onSettings={() => setSettingsOpen(true)} />
          <MuscleFatigueCard state={readiness} />
          <ReadinessHistory state={readiness} />
        </>
      ) : (
        <p className="muted">Загрузка…</p>
      )}

      <h2 className="section-title">Сон</h2>
      <SleepHero />

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

      {checkinOpen && readiness && (
        <CheckinDialog date={readiness.today} existing={readiness.todayCheckin} onClose={() => setCheckinOpen(false)} onSaved={() => window.scrollTo({ top: 0 })} />
      )}
      {settingsOpen && readiness && <ReadinessSettingsDialog config={readiness.config} onClose={() => setSettingsOpen(false)} />}
      {dialog && (
        <SleepDialog entry={dialog.entry} onClose={() => setDialog(null)} />
      )}
    </Page>
  );
}

function Trends({ entries }: { entries: SleepEntry[] }) {
  const last = recoveryAverages(entries.slice(0, 7));
  const prev = recoveryAverages(entries.slice(7, 14));
  const fmt = (v: number | null, kind: 'min' | 'score') => (v === null ? '—' : kind === 'min' ? formatDuration(v) : `${v.toLocaleString('ru-RU')} из 5`);
  // Разница «сейчас минус раньше»: время — в минутах, оценки — в баллах. Без «лучше/хуже»: это описание.
  const diff = (a: number | null, b: number | null, kind: 'min' | 'score') => {
    if (a === null || b === null) return '';
    const d = a - b;
    if (Math.abs(d) < (kind === 'min' ? 5 : 0.1)) return 'без изменений';
    const sign = d > 0 ? '+' : '−';
    return kind === 'min' ? `${sign}${formatDuration(Math.abs(Math.round(d)))}` : `${sign}${(Math.round(Math.abs(d) * 10) / 10).toLocaleString('ru-RU')}`;
  };
  const rows: { label: string; a: string; b: string; d: string }[] = [
    { label: 'Время в постели', a: fmt(last.timeInBedMin, 'min'), b: fmt(prev.timeInBedMin, 'min'), d: diff(last.timeInBedMin, prev.timeInBedMin, 'min') },
    ...RATING_FIELDS.map((k) => ({ label: RATING_META[k].label, a: fmt(last[k], 'score'), b: fmt(prev[k], 'score'), d: diff(last[k], prev[k], 'score') })),
  ];
  return (
    <Card
      title="Тенденции"
      info={
        <>
          <p>
            «Сейчас» — средние за последние {last.count} {nightsWord(last.count)}, «Раньше» — за {prev.count ? `${prev.count} ${nightsWord(prev.count)} до них` : 'ночи до них (записей пока нет)'}. Оценки — ваши
            отметки от 1 до 5.
          </p>
          <p className="muted">Это описание, а не диагноз: одна-две записи не говорят о перетренированности, а совпадение двух показателей не доказывает причину.</p>
        </>
      }
    >
      <table className="set-table trends-table">
        <thead>
          <tr>
            <th scope="col">Показатель</th>
            <th scope="col">Сейчас</th>
            <th scope="col">Раньше</th>
            <th scope="col">Разница</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="num">{r.a}</td>
              <td className="num muted">{r.b}</td>
              <td className="num">{r.d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function nightsWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'ночь';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'ночи';
  return 'ночей';
}
