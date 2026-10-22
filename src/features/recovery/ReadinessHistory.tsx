// История готовности (по мотивам Athlytic Recovery Trend / mainspring Trends): период 7 / 30 дней,
// графики готовности, сна и мышечной боли; нажатие на день — записи этого дня.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../data/db.ts';
import { MUSCLE_LABEL } from '../../domain/muscles.ts';
import { readinessBand, readinessSeries } from '../../domain/readiness.ts';
import { timeInBedMinutes } from '../../domain/sleep.ts';
import { addDays, formatDateKey, formatDuration, formatTime, toDateKey } from '../../domain/time.ts';
import { WORKOUT_FORMAT_LABEL, WORKOUT_TYPE_LABEL } from '../../domain/training.ts';
import { BarChart } from '../../ui/BarChart.tsx';
import { Modal, Segmented } from '../../ui/components.tsx';
import { LineChart } from '../../ui/LineChart.tsx';
import type { ReadinessState } from './useReadiness.ts';

type Period = '7' | '30';
const dayLabel = (d: string) => `${Number(d.slice(8))}.${d.slice(5, 7)}`;
const noon = (d: string) => Date.parse(`${d}T12:00:00Z`);
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function ReadinessHistory({ state }: { state: ReadinessState }) {
  const [period, setPeriod] = useState<Period>('7');
  const [day, setDay] = useState<string | null>(null);
  const n = Number(period);
  const dates = Array.from({ length: n }, (_, i) => addDays(state.today, i - n + 1));
  const scores = readinessSeries(state.checkins, dates, state.config);
  const byDate = new Map(state.checkins.map((c) => [c.date, c]));
  const points = dates.flatMap((d, i) => (scores[i] === null ? [] : [{ x: noon(d), y: scores[i]! }]));
  const pick = (d: string) => setDay(d);

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>История</h3>
        <Segmented
          label="Период"
          value={period}
          onChange={setPeriod}
          options={[
            { value: '7', label: '7 дней' },
            { value: '30', label: '30 дней' },
          ]}
        />
      </div>
      <h4 className="chart-sub">Готовность</h4>
      {points.length >= 2 ? (
        <LineChart label="Готовность" unit="" points={points} formatX={(x) => dayLabel(new Date(x).toISOString().slice(0, 10))} onPick={(x) => pick(new Date(x).toISOString().slice(0, 10))} selected={day ? noon(day) : undefined} />
      ) : (
        <p className="muted small">{points.length ? 'Пока одна оценка — график появится со второй.' : 'Оценок за период нет: идёт калибровка или не было чек-инов.'}</p>
      )}
      <h4 className="chart-sub">Сон, часов</h4>
      <BarChart
        label="Сон"
        bars={dates.map((d) => ({ key: d, value: byDate.get(d)?.sleepHours ?? null, label: dayLabel(d) }))}
        formatValue={(v) => `${r1(v)} ч`}
        onPick={pick}
        selected={day ?? undefined}
      />
      <h4 className="chart-sub">Мышечная боль, групп</h4>
      <BarChart
        label="Мышечная боль"
        bars={dates.map((d) => ({ key: d, value: byDate.has(d) ? byDate.get(d)!.soreMuscles.length : null, label: dayLabel(d) }))}
        formatValue={(v) => r1(v)}
        onPick={pick}
        selected={day ?? undefined}
      />
      <p className="small muted">Нажмите на день, чтобы увидеть записи. Оценка по вашим записям, не медицинская рекомендация.</p>
      {day && <DayDialog date={day} state={state} score={scores[dates.indexOf(day)] ?? null} onClose={() => setDay(null)} />}
    </div>
  );
}

function DayDialog({ date, state, score, onClose }: { date: string; state: ReadinessState; score: number | null; onClose: () => void }) {
  const c = state.checkins.find((x) => x.date === date);
  const sleep = useLiveQuery(async () => (await db.sleep.toArray()).filter((s) => toDateKey(s.wakeTime) === date), [date]);
  const workouts = useLiveQuery(async () => (await db.workouts.toArray()).filter((w) => toDateKey(w.startAt) === date), [date]);
  return (
    <Modal title={formatDateKey(date, true)} onClose={onClose} size="sheet">
      <div className="stat-row">
        <div>
          <b className="num">{score ?? '—'}</b>
          <span>{score !== null ? readinessBand(score).title.toLowerCase() : 'оценки нет'}</span>
        </div>
      </div>
      {c ? (
        <ul className="list">
          <li className="list-item">
            <div className="grow">
              <div className="title">Чек-ин</div>
              <div className="meta">
                {[
                  c.sleepHours !== undefined && `сон ${r1(c.sleepHours)} ч`,
                  c.sleepQuality && `качество ${c.sleepQuality}/5`,
                  c.energy && `энергия ${c.energy}/5`,
                  c.mood && `настроение ${c.mood}/5`,
                  c.stress && `стресс ${c.stress}/5`,
                  c.restingHr && `пульс ${c.restingHr}`,
                  c.hrvRmssd && `HRV ${Math.round(c.hrvRmssd)} мс (ln ${r1(Math.log(c.hrvRmssd))})`,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'без оценок'}
              </div>
              <div className="meta">Болело: {c.soreMuscles.length ? c.soreMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') : 'ничего'}</div>
              {c.notes && <div className="meta">{c.notes}</div>}
            </div>
          </li>
        </ul>
      ) : (
        <p className="muted">Чек-ина в этот день нет.</p>
      )}
      {sleep && sleep.length > 0 && (
        <p className="small">
          Сон по отметкам:{' '}
          {sleep.map((s) => `${formatTime(s.bedtime)}–${formatTime(s.wakeTime)} (${formatDuration(timeInBedMinutes(s.bedtime, s.wakeTime) ?? 0)})`).join(', ')}
        </p>
      )}
      {workouts && workouts.length > 0 ? (
        <p className="small">
          Тренировки: {workouts.map((w) => `${w.title} — ${w.format ? WORKOUT_FORMAT_LABEL[w.format] : WORKOUT_TYPE_LABEL[w.type]}${w.rpe ? `, тяжесть ${w.rpe}/10` : ''}`).join('; ')}
        </p>
      ) : (
        <p className="small muted">Тренировок в этот день нет.</p>
      )}
    </Modal>
  );
}
