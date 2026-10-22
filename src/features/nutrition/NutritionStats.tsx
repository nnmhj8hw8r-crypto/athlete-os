// Статистика питания: «Сегодня» и «Неделя». Расширенные нутриенты показываются с покрытием данных:
// отсутствие сведений не считается нулём, а при малом покрытии значение помечается «мало данных».
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { EXTRA_KEYS } from '../../../shared/catalog.ts';
import { db } from '../../data/db.ts';
import { formatNutrient, LOW_COVERAGE, NUTRIENT_GROUPS, NUTRIENT_META, saltFromSodiumMg, sumExtra, type NutrientTotal } from '../../domain/nutrients.ts';
import { MEAL_TYPE_LABEL, sumNutrients } from '../../domain/nutrition.ts';
import { waterTargetFor, type PlanTargets } from '../../domain/plan.ts';
import { MEAL_TYPES, type MealEntry } from '../../domain/schemas.ts';
import { addDays, formatDateKey, weekStart } from '../../domain/time.ts';
import { Tabs } from '../../ui/components.tsx';
import { usePlanState } from './planData.ts';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface Props {
  date: string;
  targets?: PlanTargets;
  weightKg?: number;
  onOpenPlan: () => void;
}

export function NutritionStats({ date, targets, weightKg, onOpenPlan }: Props) {
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const monday = weekStart(date);
  const sunday = addDays(monday, 6);
  const meals = useLiveQuery(() => db.meals.where('date').between(monday, sunday, true, true).toArray(), [monday]);
  const water = useLiveQuery(() => db.water.where('date').between(monday, sunday, true, true).toArray(), [monday]);
  if (!meals || !water) return <p className="muted">Загрузка…</p>;

  return (
    <div className="stack">
      <Tabs
        label="Период"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'day', label: 'Что я съел сегодня' },
          { value: 'week', label: 'За неделю' },
        ]}
      />
      {!targets && (
        <button type="button" className="notice info plan-hint" onClick={onOpenPlan}>
          Без личного плана нет целей: показываю только фактические значения. Составить план →
        </button>
      )}
      {period === 'day' ? (
        <DayStats entries={meals.filter((m) => m.date === date)} waterMl={water.filter((w) => w.date === date).reduce((s, w) => s + w.ml, 0)} date={date} targets={targets} weightKg={weightKg} />
      ) : (
        <WeekStats monday={monday} meals={meals} water={water} targets={targets} weightKg={weightKg} />
      )}
    </div>
  );
}

function Bar({ value, target, label, unit }: { value: number; target?: number; label: string; unit: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target !== undefined && value > target * 1.05;
  return (
    <div className="stat-bar">
      <div className="row-between">
        <span>{label}</span>
        <span className="num">
          <b>{r1(value)}</b>
          {target !== undefined ? ` / ${Math.round(target).toLocaleString('ru-RU')}` : ''} {unit}
        </span>
      </div>
      {target !== undefined && (
        <div className={`progress${over ? ' over' : ''}`}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function coverageNote(t: NutrientTotal): string {
  if (t.known === 0) return 'нет данных';
  if (t.coverage >= 0.95) return 'данные по всем продуктам';
  return `данные по ${Math.round(t.coverage * 100)}% калорий`;
}

function ExtendedNutrients({ entries, days = 1 }: { entries: MealEntry[]; days?: number }) {
  const totals = sumExtra(entries.map((e) => ({ kcal: e.nutrients.kcal, extra: e.extra })));
  const keys = EXTRA_KEYS.filter((k) => k !== 'water' && totals[k].known > 0);
  const missing = EXTRA_KEYS.filter((k) => k !== 'water' && totals[k].known === 0);
  return (
    <section className="card stack">
      <h2>Нутриенты{days > 1 ? ' (в среднем за день с записями)' : ''}</h2>
      {keys.length === 0 ? (
        <p className="small muted">
          Для съеденных продуктов нет расширенных данных. Они есть у продуктов встроенной базы и у многих товаров по штрихкоду; для своих
          продуктов их можно внести с этикетки.
        </p>
      ) : (
        NUTRIENT_GROUPS.map((g) => {
          const list = keys.filter((k) => NUTRIENT_META[k].group === g.id);
          if (!list.length) return null;
          return (
            <div key={g.id}>
              <p className="search-group">{g.label}</p>
              <dl className="nutrient-list">
                {list.map((k) => {
                  const t = totals[k];
                  const low = t.coverage < LOW_COVERAGE;
                  const value = t.value / days;
                  return (
                    <div key={k} className={low ? 'low' : ''}>
                      <dt>
                        {NUTRIENT_META[k].label}
                        <small>{low ? `мало данных · ${coverageNote(t)}` : coverageNote(t)}</small>
                      </dt>
                      <dd className="num">
                        {t.coverage < 0.95 ? '≥ ' : ''}
                        {formatNutrient(value, NUTRIENT_META[k].unit)}
                        {k === 'sodium' && <small> соль ≈ {formatNutrient(saltFromSodiumMg(value), 'г')}</small>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })
      )}
      {missing.length > 0 && keys.length > 0 && (
        <p className="small muted">Нет данных: {missing.map((k) => NUTRIENT_META[k].label.toLowerCase()).join(', ')}.</p>
      )}
      <p className="small muted">
        «≥» — часть продуктов без сведений, реальное значение может быть выше. «Сахара (всего)» включают и природные сахара (фрукты,
        молоко), и добавленные; добавленный сахар показывается, только если источник его указывает.
      </p>
    </section>
  );
}

function DayStats({ entries, waterMl, date, targets, weightKg }: { entries: MealEntry[]; waterMl: number; date: string; targets?: PlanTargets; weightKg?: number }) {
  const { plan } = usePlanState();
  const t = sumNutrients(entries.map((e) => e.nutrients));
  const waterTarget = waterTargetFor(plan, date, targets?.waterMl ?? 0);
  if (entries.length === 0 && waterMl === 0) return <p className="muted">За этот день записей нет.</p>;
  const perMeal = MEAL_TYPES.map((m) => ({ m, p: sumNutrients(entries.filter((e) => e.mealType === m).map((e) => e.nutrients)).protein }));
  const maxP = Math.max(1, ...perMeal.map((x) => x.p));
  return (
    <div className="stack">
      <section className="card stack">
        <h2>Калории и БЖУ</h2>
        <Bar label="Калории" value={t.kcal} target={targets?.kcal} unit="ккал" />
        <Bar label="Белки" value={t.protein} target={targets?.protein} unit="г" />
        <Bar label="Жиры" value={t.fat} target={targets?.fat} unit="г" />
        <Bar label="Углеводы" value={t.carbs} target={targets?.carbs} unit="г" />
        {weightKg && (
          <p className="small">
            На кг веса ({r1(weightKg)} кг): белок <b>{r1(t.protein / weightKg)} г/кг</b>, углеводы <b>{r1(t.carbs / weightKg)} г/кг</b>.
          </p>
        )}
      </section>
      <section className="card stack">
        <h2>Белок по приёмам пищи</h2>
        <p className="small muted">Равномерное распределение белка по приёмам пищи обсуждается в позиции ISSN (2017) как полезное для восстановления.</p>
        {perMeal.map(({ m, p }) => (
          <div key={m} className="meal-bar">
            <span>{MEAL_TYPE_LABEL[m]}</span>
            <div className="hbar">
              <span style={{ width: `${(p / maxP) * 100}%` }} />
            </div>
            <span className="num">{r1(p)} г</span>
          </div>
        ))}
      </section>
      <section className="card stack">
        <h2>Вода</h2>
        <Bar label={waterTarget.custom ? 'Выпито (особая цель на день)' : 'Выпито'} value={waterMl / 1000} target={waterTarget.ml ? waterTarget.ml / 1000 : undefined} unit="л" />
      </section>
      <ExtendedNutrients entries={entries} />
    </div>
  );
}

function WeekStats({
  monday,
  meals,
  water,
  targets,
  weightKg,
}: {
  monday: string;
  meals: MealEntry[];
  water: { date: string; ml: number }[];
  targets?: PlanTargets;
  weightKg?: number;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const perDay = days.map((d) => ({
    d,
    n: sumNutrients(meals.filter((m) => m.date === d).map((m) => m.nutrients)),
    logged: meals.some((m) => m.date === d),
    water: water.filter((w) => w.date === d).reduce((s, w) => s + w.ml, 0),
  }));
  const logged = perDay.filter((x) => x.logged);
  const avg = logged.length ? sumNutrients(logged.map((x) => x.n)) : null;
  const k = logged.length || 1;
  const maxKcal = Math.max(targets?.kcal ?? 0, ...perDay.map((x) => x.n.kcal), 1);
  if (!logged.length) return <p className="muted">На этой неделе записей питания нет.</p>;
  return (
    <div className="stack">
      <section className="card stack">
        <h2>
          Неделя {formatDateKey(monday)} — {formatDateKey(days[6]!)}
        </h2>
        <p className="small muted">Дней с записями: {logged.length} из 7. Средние считаются только по дням с записями.</p>
        <div className="week-chart" role="img" aria-label="Калории по дням недели">
          {perDay.map((x, i) => (
            <div key={x.d} className="week-col">
              <div className="col-track">
                {targets && <span className="target-line" style={{ bottom: `${(targets.kcal / maxKcal) * 100}%` }} />}
                <span className="col" style={{ height: `${(x.n.kcal / maxKcal) * 100}%` }} />
              </div>
              <small className="num">{x.logged ? Math.round(x.n.kcal) : '—'}</small>
              <small>{WEEKDAYS[i]}</small>
            </div>
          ))}
        </div>
        {targets && <p className="small muted">Линия — цель {targets.kcal.toLocaleString('ru-RU')} ккал.</p>}
      </section>
      {avg && (
        <section className="card stack">
          <h2>В среднем за день</h2>
          <Bar label="Калории" value={avg.kcal / k} target={targets?.kcal} unit="ккал" />
          <Bar label="Белки" value={avg.protein / k} target={targets?.protein} unit="г" />
          <Bar label="Жиры" value={avg.fat / k} target={targets?.fat} unit="г" />
          <Bar label="Углеводы" value={avg.carbs / k} target={targets?.carbs} unit="г" />
          {weightKg && (
            <p className="small">
              Белок {r1(avg.protein / k / weightKg)} г/кг · углеводы {r1(avg.carbs / k / weightKg)} г/кг в среднем.
            </p>
          )}
          {perDay.some((x) => x.water > 0) && (
            <p className="small">
              Вода: в среднем {r1(perDay.reduce((s, x) => s + x.water, 0) / perDay.filter((x) => x.water > 0).length / 1000)} л в день
              (по {perDay.filter((x) => x.water > 0).length} дн. с записями).
            </p>
          )}
        </section>
      )}
      <ExtendedNutrients entries={meals} days={k} />
    </div>
  );
}
