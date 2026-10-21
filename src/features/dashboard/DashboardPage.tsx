// Главная: обзор текущего дня только по реальным локальным записям.
import { useLiveQuery } from 'dexie-react-hooks';
import { SPORT_LABEL } from '../../config.ts';
import { db } from '../../data/db.ts';
import { daysUntil, formatCountdown, nextCompetition } from '../../domain/competition.ts';
import { sumNutrients } from '../../domain/nutrition.ts';
import { estimatedSleepMinutes, RATING_FIELDS, RATING_META, timeInBedMinutes } from '../../domain/sleep.ts';
import { WORKOUT_TYPE_LABEL } from '../../domain/training.ts';
import { formatDateKey, formatDateTime, formatDuration, todayKey } from '../../domain/time.ts';
import { Card, Page } from '../../ui/components.tsx';
import { href } from '../../ui/router.ts';
import { MacroGrid } from '../nutrition/MacroGrid.tsx';
import { usePendingSleep } from '../recovery/RecoveryPage.tsx';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function DashboardPage() {
  const today = todayKey();
  const meals = useLiveQuery(() => db.meals.where('date').equals(today).toArray(), [today]);
  const competitions = useLiveQuery(() => db.competitions.toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.orderBy('startAt').reverse().limit(3).toArray(), []);
  const lastSleep = useLiveQuery(() => db.sleep.orderBy('wakeTime').last(), []);
  const lastWeight = useLiveQuery(() => db.bodyWeights.orderBy('measuredAt').last(), []);
  const pendingSleep = usePendingSleep();

  const next = competitions ? nextCompetition(competitions) : undefined;
  const loading = meals === undefined || competitions === undefined || workouts === undefined;

  return (
    <Page title="Сегодня" subtitle={formatDateKey(today, true)}>
      <div className="quick-actions">
        <a className="btn primary" href={href('/nutrition?add=1')}>
          + Еда
        </a>
        <a className="btn" href={href('/training?add=1')}>
          + Тренировка
        </a>
        <a className="btn" href={href('/recovery?add=1')}>
          + Сон и самочувствие
        </a>
        <a className="btn" href={href('/season?add=weight')}>
          + Масса тела
        </a>
      </div>

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
              <p className="muted">Сегодня ещё ничего не записано. Нажмите «+ Еда», чтобы добавить приём пищи.</p>
            )}
          </Card>

          <Card title="Ближайшее соревнование" aside={<a className="small" href={href('/season')}>Сезон</a>}>
            {next ? (
              <>
                <div className="stat">
                  <span className="value">{formatCountdown(daysUntil(next.startAt))}</span>
                  <span className="label">{next.name}</span>
                </div>
                <p className="small">
                  <span className={`badge ${next.sport}`}>
                    {SPORT_LABEL[next.sport]} {next.weightCategory} кг
                  </span>{' '}
                  старт {formatDateTime(next.startAt)}
                </p>
                <p className="small muted">Взвешивание: {formatDateTime(next.weighInAt)}</p>
              </>
            ) : (
              <div className="stack">
                <p className="muted">Предстоящих соревнований нет.</p>
                <a className="btn small" href={href('/season?add=competition')}>
                  Добавить соревнование
                </a>
              </div>
            )}
          </Card>

          <Card title="Последние тренировки" aside={<a className="small" href={href('/training')}>Журнал</a>}>
            {workouts.length ? (
              <ul className="list">
                {workouts.map((w) => (
                  <li key={w.id}>
                    <b>{w.title}</b>
                    <div className="small muted">
                      {formatDateTime(w.startAt)} · {WORKOUT_TYPE_LABEL[w.type]}
                      {w.durationMin !== undefined && ` · ${formatDuration(w.durationMin)}`}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Тренировок пока нет. Нажмите «+ Тренировка».</p>
            )}
          </Card>

          <Card title="Сон и восстановление" aside={<a className="small" href={href('/recovery')}>Подробнее</a>}>
            {pendingSleep && <p className="notice info small">Сон начат {formatDateTime(pendingSleep)}. Отметьте пробуждение в разделе «Восстановление».</p>}
            {lastSleep ? (
              <>
                <p>
                  {formatDateTime(lastSleep.wakeTime)}: в постели{' '}
                  <b>{formatDuration(timeInBedMinutes(lastSleep.bedtime, lastSleep.wakeTime) ?? 0)}</b>
                  {estimatedSleepMinutes(lastSleep) !== null && <>, оценка сна {formatDuration(estimatedSleepMinutes(lastSleep)!)}</>}
                </p>
                <p className="small muted">
                  {RATING_FIELDS.filter((k) => lastSleep[k] !== undefined)
                    .map((k) => `${RATING_META[k].label}: ${lastSleep[k]}/5`)
                    .join(' · ') || 'Самочувствие не отмечено'}
                </p>
              </>
            ) : (
              !pendingSleep && <p className="muted">Записей сна пока нет.</p>
            )}
          </Card>

          <Card title="Масса тела" aside={<a className="small" href={href('/season?tab=weight')}>История</a>}>
            {lastWeight ? (
              <div className="stat">
                <span className="value">{r1(lastWeight.weightKg)} кг</span>
                <span className="label">{formatDateTime(lastWeight.measuredAt)}</span>
              </div>
            ) : (
              <p className="muted">Массу ещё не записывали.</p>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}
