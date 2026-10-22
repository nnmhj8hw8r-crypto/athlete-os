// Карточки сезона: ближайший старт (крупный отсчёт) и масса тела с графиком и сводкой.
// Используются во вкладке «Сезон» и на главном экране.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { SPORT_LABEL } from '../../config.ts';
import { db } from '../../data/db.ts';
import { weightSummary, weightsInPeriod } from '../../domain/bodyWeight.ts';
import { daysUntil, formatCountdown, nextCompetition } from '../../domain/competition.ts';
import { formatDateKey, formatDateTime, plural, toDateKey } from '../../domain/time.ts';
import { Segmented } from '../../ui/components.tsx';
import { LineChart } from '../../ui/LineChart.tsx';
import { href } from '../../ui/router.ts';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');
const signed = (n: number) => `${n > 0 ? '+' : ''}${r1(n)}`;

export function NextCompetitionCard({ link = false }: { link?: boolean }) {
  const competitions = useLiveQuery(() => db.competitions.toArray(), []);
  const last = useLiveQuery(() => db.bodyWeights.orderBy('measuredAt').last(), []);
  if (competitions === undefined) return null;
  const next = nextCompetition(competitions);
  if (!next) {
    return (
      <section className="hero-card">
        <span className="hero-label">Ближайший старт</span>
        <span className="muted">Предстоящих соревнований нет.</span>
        <a className="btn" href={href('/season?add=competition')}>
          Добавить соревнование
        </a>
      </section>
    );
  }
  const days = daysUntil(next.startAt);
  const weighDays = daysUntil(next.weighInAt);
  const body = (
    <>
      <span className="hero-label">
        Ближайший старт · {SPORT_LABEL[next.sport]} {next.weightCategory} кг
      </span>
      <b className="hero-value">{days > 0 ? `${days} ${plural(days, ['день', 'дня', 'дней'])}` : formatCountdown(days)}</b>
      <span className="hero-title">{next.name}</span>
      <span className="muted small">
        Старт {formatDateTime(next.startAt)}
        {next.location ? ` · ${next.location}` : ''}
      </span>
      <span className="muted small">
        Взвешивание {formatDateTime(next.weighInAt)} ({formatCountdown(weighDays)})
      </span>
      {next.targetWeightKg !== undefined && (
        <div className="stat-row">
          <div>
            <b className="num">{r1(next.targetWeightKg)}</b>
            <span>цель, кг</span>
          </div>
          {last && (
            <>
              <div>
                <b className="num">{r1(last.weightKg)}</b>
                <span>сейчас, кг</span>
              </div>
              <div>
                <b className="num">{signed(last.weightKg - next.targetWeightKg)}</b>
                <span>до цели, кг</span>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
  return link ? (
    <a className="hero-card link" href={href('/season')}>
      {body}
    </a>
  ) : (
    <section className="hero-card">{body}</section>
  );
}

type WPeriod = '30' | '90' | 'all';

export function WeightChartCard({ initial = '30', link = false }: { initial?: WPeriod; link?: boolean }) {
  const [period, setPeriod] = useState<WPeriod>(initial);
  const weights = useLiveQuery(() => db.bodyWeights.toArray(), []);
  const competitions = useLiveQuery(() => db.competitions.toArray(), []);
  if (weights === undefined || competitions === undefined) return null;
  const next = nextCompetition(competitions);
  const target = next?.targetWeightKg;
  const s = weightSummary(weights, target);
  const shown = weightsInPeriod(weights, period === 'all' ? null : Number(period));
  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>{link ? <a href={href('/season?tab=weight')}>Масса тела</a> : 'Масса тела'}</h3>
        <Segmented
          label="Период"
          value={period}
          onChange={setPeriod}
          options={[
            { value: '30', label: '30 дн' },
            { value: '90', label: '90 дн' },
            { value: 'all', label: 'Всё' },
          ]}
        />
      </div>
      {!s ? (
        <p className="muted small">
          Записей массы тела нет. <a href={href('/season?add=weight')}>Записать</a>
        </p>
      ) : (
        <>
          <div className="stat-row">
            <div>
              <b className="num">{r1(s.last.weightKg)}</b>
              <span>кг · {formatDateKey(toDateKey(s.last.measuredAt))}</span>
            </div>
            {s.change7 !== null && (
              <div>
                <b className="num">{signed(s.change7)}</b>
                <span>за неделю</span>
              </div>
            )}
            {s.toTarget !== null && (
              <div>
                <b className="num">{signed(s.toTarget)}</b>
                <span>до цели {r1(target!)}</span>
              </div>
            )}
          </div>
          <LineChart
            label="Масса тела"
            unit="кг"
            points={shown.map((w) => ({ x: Date.parse(w.measuredAt), y: w.weightKg }))}
            reference={target !== undefined ? { y: target, label: `цель ${r1(target)} кг` } : undefined}
            formatX={(x) => formatDateKey(toDateKey(new Date(x)))}
          />
        </>
      )}
    </div>
  );
}
