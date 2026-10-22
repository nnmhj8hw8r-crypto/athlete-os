// Графики восстановления: время в постели и самооценки по дням. Используются во вкладке
// «Восстановление» и на главном экране. Только описание своих записей, без норм и диагнозов.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../data/db.ts';
import { RATING_FIELDS, RATING_META, sleepDays, type RatingField } from '../../domain/sleep.ts';
import { addDays, formatDuration, todayKey } from '../../domain/time.ts';
import { BarChart } from '../../ui/BarChart.tsx';
import { Segmented } from '../../ui/components.tsx';
import { LineChart } from '../../ui/LineChart.tsx';

export type Period = '14' | '30' | '90';
export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '14', label: '2 нед' },
  { value: '30', label: '30 дн' },
  { value: '90', label: '90 дн' },
];

const dayLabel = (d: string) => `${Number(d.slice(8))}.${d.slice(5, 7)}`;

function useDays(period: Period) {
  const to = todayKey();
  const from = addDays(to, -(Number(period) - 1));
  const entries = useLiveQuery(() => db.sleep.toArray(), []);
  return entries === undefined ? undefined : sleepDays(entries, from, to);
}

/** Полоса последних 14 дней: закрашены дни с записью сна (как календарь активности). */
export function SleepStrip() {
  const days = useDays('14');
  if (!days) return null;
  return (
    <div className="day-strip" aria-label="Записи сна за 14 дней">
      {days.map((d) => (
        <span key={d.date} className={`day-cell${d.inBedMin !== null ? ' on' : ''}`} title={dayLabel(d.date)}>
          {Number(d.date.slice(8))}
        </span>
      ))}
    </div>
  );
}

export function SleepChart({ initial = '14', period: controlled, onPeriodChange }: { initial?: Period; period?: Period; onPeriodChange?: (p: Period) => void }) {
  const [local, setLocal] = useState<Period>(initial);
  const period = controlled ?? local;
  const setPeriod = (p: Period) => {
    setLocal(p);
    onPeriodChange?.(p);
  };
  const days = useDays(period);
  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>Время в постели</h3>
        <Segmented label="Период" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
      </div>
      {days && (
        <BarChart
          label="Время в постели"
          bars={days.map((d) => ({ key: d.date, value: d.inBedMin, label: dayLabel(d.date) }))}
          formatValue={(v) => formatDuration(Math.round(v))}
        />
      )}
      <p className="small muted">Промежуток между «лёг» и «проснулся», а не измеренный сон.</p>
    </div>
  );
}

export function WellbeingChart({ initial = '14', period: controlled, onPeriodChange }: { initial?: Period; period?: Period; onPeriodChange?: (p: Period) => void }) {
  const [local, setLocal] = useState<Period>(initial);
  const period = controlled ?? local;
  const setPeriod = (p: Period) => {
    setLocal(p);
    onPeriodChange?.(p);
  };
  const [field, setField] = useState<RatingField>('wellbeing');
  const days = useDays(period);
  const points = (days ?? []).flatMap((d) => {
    const v = d[field];
    return v === null ? [] : [{ x: Date.parse(`${d.date}T12:00:00Z`), y: v }];
  });
  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>Самочувствие</h3>
        <Segmented label="Период" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
      </div>
      <div className="chip-scroll no-swipe" role="group" aria-label="Показатель">
        {RATING_FIELDS.map((k) => (
          <button key={k} type="button" className={`chip${field === k ? ' chip-selected' : ''}`} aria-pressed={field === k} onClick={() => setField(k)}>
            {RATING_META[k].label}
          </button>
        ))}
      </div>
      {days && (
        <LineChart
          label={RATING_META[field].label}
          unit="из 5"
          points={points}
          formatX={(x) => dayLabel(new Date(x).toISOString().slice(0, 10))}
        />
      )}
      <p className="small muted">
        Шкала 1–5: 1 — {RATING_META[field].low}, 5 — {RATING_META[field].high}. Ваши оценки, не диагноз.
      </p>
    </div>
  );
}
