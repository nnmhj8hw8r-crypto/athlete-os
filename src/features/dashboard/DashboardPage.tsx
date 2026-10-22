// Главная: самая важная сводка по реальным локальным записям (по образцу Lift Card).
// Ближайший старт, масса тела, сон и самочувствие, питание сегодня, последние тренировки.
// Кнопок добавления нет — для этого есть вкладки разделов.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db.ts';
import { sumNutrients } from '../../domain/nutrition.ts';
import { estimatedSleepMinutes, RATING_FIELDS, RATING_META, timeInBedMinutes } from '../../domain/sleep.ts';
import { WORKOUT_FORMAT_LABEL, WORKOUT_TYPE_LABEL } from '../../domain/training.ts';
import { formatDateKey, formatDateTime, formatDuration, toDateKey, todayKey } from '../../domain/time.ts';
import { Card, Page } from '../../ui/components.tsx';
import { href } from '../../ui/router.ts';
import { MacroGrid } from '../nutrition/MacroGrid.tsx';
import { SleepChart, WellbeingChart } from '../recovery/RecoveryCharts.tsx';
import { usePendingSleep } from '../recovery/RecoveryPage.tsx';
import { NextCompetitionCard, WeightChartCard } from '../season/SeasonCards.tsx';

export function DashboardPage() {
  const today = todayKey();
  const meals = useLiveQuery(() => db.meals.where('date').equals(today).toArray(), [today]);
  const workouts = useLiveQuery(() => db.workouts.orderBy('startAt').reverse().limit(3).toArray(), []);
  const lastSleep = useLiveQuery(() => db.sleep.orderBy('wakeTime').last(), []);
  const pendingSleep = usePendingSleep();
  const loading = meals === undefined || workouts === undefined;

  return (
    <Page title="Сегодня" subtitle={formatDateKey(today, true)}>
      <NextCompetitionCard link />
      <WeightChartCard link />

      <section className="section">
        <div className="section-head">
          <h2>Сон и самочувствие</h2>
          <a className="small" href={href('/recovery')}>
            Подробнее
          </a>
        </div>
        {pendingSleep && (
          <a className="notice info small" href={href('/recovery')}>
            Сон начат {formatDateTime(pendingSleep)} — отметьте пробуждение.
          </a>
        )}
        {lastSleep && (
          <p className="small muted">
            Последняя ночь ({toDateKey(lastSleep.wakeTime) === today ? 'сегодня' : formatDateTime(lastSleep.wakeTime)}): в постели{' '}
            <b>{formatDuration(timeInBedMinutes(lastSleep.bedtime, lastSleep.wakeTime) ?? 0)}</b>
            {estimatedSleepMinutes(lastSleep) !== null && <>, оценка сна {formatDuration(estimatedSleepMinutes(lastSleep)!)}</>}
            {RATING_FIELDS.some((k) => lastSleep[k] !== undefined) &&
              ` · ${RATING_FIELDS.filter((k) => lastSleep[k] !== undefined)
                .map((k) => `${RATING_META[k].label.toLowerCase()} ${lastSleep[k]}/5`)
                .join(', ')}`}
          </p>
        )}
        <SleepChart />
        <WellbeingChart />
      </section>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <div className="grid-2">
          <Card title="Питание сегодня" aside={<a className="small" href={href('/nutrition')}>Дневник</a>}>
            {meals.length ? (
              <>
                <MacroGrid n={sumNutrients(meals.map((m) => m.nutrients))} />
                <p className="small muted">Записей: {meals.length}</p>
              </>
            ) : (
              <p className="muted">Сегодня ещё ничего не записано. Добавьте еду во вкладке «Питание».</p>
            )}
          </Card>

          <Card title="Последние тренировки" aside={<a className="small" href={href('/training?tab=journal')}>Журнал</a>}>
            {workouts.length ? (
              <ul className="list">
                {workouts.map((w) => (
                  <li key={w.id}>
                    <b>{w.title}</b>
                    <div className="small muted">
                      {formatDateTime(w.startAt)} · {w.format ? WORKOUT_FORMAT_LABEL[w.format] : WORKOUT_TYPE_LABEL[w.type]}
                      {w.durationMin !== undefined && ` · ${formatDuration(w.durationMin)}`}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Тренировок пока нет. Начните во вкладке «Тренировки».</p>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}
