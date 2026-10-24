// «Сезон»: средняя готовность по неделям и «усталость / форма» по нагрузке тренировок (по мотивам
// Coach Watts и Training Today) — чтобы было видно накопление усталости. Оценка, не измерение.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db.ts';
import { readinessSeries } from '../../domain/readiness.ts';
import { addDays, todayKey, weekStart } from '../../domain/time.ts';
import { hasLoadData, trainingLoadSeries } from '../../domain/trainingLoad.ts';
import { useState } from 'react';
import { BarChart } from '../../ui/BarChart.tsx';
import { InfoButton, InfoPanel } from '../../ui/components.tsx';
import { MultiLineChart } from '../../ui/MultiLineChart.tsx';
import { href } from '../../ui/router.ts';
import { useReadinessConfig } from '../recovery/useReadiness.ts';

const WEEKS = 8;
const label = (d: string) => `${Number(d.slice(8))}.${d.slice(5, 7)}`;

export function WeeklyReadinessCard() {
  const config = useReadinessConfig();
  const [info, setInfo] = useState(false);
  const checkins = useLiveQuery(() => db.checkins.toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  if (!config || !checkins || !workouts) return null;
  const today = todayKey();
  const firstMonday = addDays(weekStart(today), -7 * (WEEKS - 1));
  const mondays = Array.from({ length: WEEKS }, (_, i) => addDays(firstMonday, 7 * i));
  const days = Array.from({ length: 7 * WEEKS }, (_, i) => addDays(firstMonday, i)).filter((d) => d <= today);
  const scores = readinessSeries(checkins, days, config);
  const weekly = mondays.map((m) => {
    const vals = days.flatMap((d, i) => (d >= m && d < addDays(m, 7) && scores[i] !== null ? [scores[i]!] : []));
    return { key: m, value: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, label: label(m) };
  });
  const load = trainingLoadSeries(workouts, firstMonday, today);
  const weekEnd = mondays.map((m) => load.filter((p) => p.date < addDays(m, 7)).pop()).filter((p) => !!p);
  const x = (d: string) => Date.parse(`${d}T12:00:00Z`);

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>
          <a href={href('/recovery')}>Готовность по неделям</a>
        </h3>
        <InfoButton open={info} onToggle={() => setInfo((o) => !o)} label="как считается" />
      </div>
      {info && (
        <InfoPanel>
          <p>Готовность — средняя за дни с оценкой. Нагрузка тренировки = минуты × тяжесть 1–10.</p>
          <p>Усталость — среднее за ~7 дней, форма — разница со средним за ~42 дня (упрощённая модель Банистера). Отрицательная форма — накоплена усталость.</p>
          <p className="muted">Окна условные; это оценка, не медицинская рекомендация.</p>
        </InfoPanel>
      )}
      <BarChart label="Средняя готовность по неделям" bars={weekly} formatValue={(v) => String(Math.round(v))} />
      <h4 className="chart-sub">Усталость и форма</h4>
      {hasLoadData(workouts) ? (
        <MultiLineChart
          label="Усталость и форма"
          formatX={(v) => label(new Date(v).toISOString().slice(0, 10))}
          series={[
            { label: 'усталость (7 дн)', dash: 'solid', points: weekEnd.map((p) => ({ x: x(p.date), y: p.fatigue })) },
            { label: 'форма', dash: 'dashed', points: weekEnd.map((p) => ({ x: x(p.date), y: p.form })) },
          ]}
        />
      ) : (
        <p className="muted small">Появится, когда в журнале будут тренировки с длительностью и тяжестью.</p>
      )}
    </div>
  );
}
