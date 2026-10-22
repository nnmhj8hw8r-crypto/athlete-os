// Вкладка «Питание» по образцу FatSecret: неделя, итоги дня с РСК, плашки приёмов пищи, вода.
// Справа — «Статистика» (сегодня / неделя) с расширенными нутриентами.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity } from '../../data/repo.ts';
import { QUICK_REF } from '../../domain/foodHistory.ts';
import { MEAL_TYPE_LABEL, sumNutrients, unitLabel } from '../../domain/nutrition.ts';
import { MEAL_TYPES, type MealEntry, type MealType } from '../../domain/schemas.ts';
import { addDays, formatDateKey, isValidDateKey, todayKey, weekStart } from '../../domain/time.ts';
import { Page, Tabs } from '../../ui/components.tsx';
import { useConfirmDelete } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { clearParam, href, type Route } from '../../ui/router.ts';
import { AddFlow, MEAL_ICON, type AddStart } from './AddFlow.tsx';
import { defaultMealType, MealEntryDialog } from './MealEntryDialog.tsx';
import { NutritionStats } from './NutritionStats.tsx';
import { PlanDialog } from './PlanDialog.tsx';
import { usePlanState } from './planData.ts';
import { WaterCard } from './WaterCard.tsx';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type View = 'diary' | 'stats';

export function NutritionPage({ route }: { route: Route }) {
  const [date, setDate] = useState(() => {
    const d = route.params.get('date');
    return d && isValidDateKey(d) ? d : todayKey();
  });
  const [view, setView] = useState<View>('diary');
  const [flow, setFlow] = useState<{ meal: MealType; start: AddStart } | null>(null);
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const confirmDelete = useConfirmDelete();
  const planState = usePlanState();
  const targets = planState.targets;

  const monday = weekStart(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekEntries = useLiveQuery(() => db.meals.where('date').between(monday, weekDays[6]!, true, true).toArray(), [monday]);
  const entries = weekEntries?.filter((e) => e.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const loggedDays = new Set(weekEntries?.map((e) => e.date));

  useEffect(() => {
    if (route.params.get('add') === '1') {
      setFlow({ meal: defaultMealType(), start: 'sheet' });
      clearParam(route, 'add');
    }
  }, [route]);

  const today = todayKey();
  const totals = sumNutrients((entries ?? []).map((e) => e.nutrients));
  const rsk = targets ? Math.round((totals.kcal / targets.kcal) * 100) : null;

  return (
    <Page
      title="Питание"
      actions={
        <>
          <button type="button" className={`btn${planState.plan ? '' : ' primary'}`} onClick={() => setPlanOpen(true)}>
            {planState.plan ? 'Мой план' : 'Составить личный план'}
          </button>
          <a className="btn ghost" href={href('/nutrition/foods')}>
            Продукты
          </a>
        </>
      }
    >
      <Tabs
        label="Раздел питания"
        value={view}
        onChange={setView}
        options={[
          { value: 'diary', label: 'Дневник' },
          { value: 'stats', label: 'Статистика' },
        ]}
      />

      <div className="week-strip">
        <button type="button" className="icon-btn" aria-label="Предыдущая неделя" onClick={() => setDate(addDays(date, -7))}>
          {Icons.chevronLeft}
        </button>
        <div className="week-days" role="group" aria-label="Дни недели">
          {weekDays.map((d, i) => (
            <button
              key={d}
              type="button"
              className={`week-day${d === date ? ' selected' : ''}${loggedDays.has(d) ? ' logged' : ''}${d === today ? ' today' : ''}`}
              aria-pressed={d === date}
              aria-label={`${formatDateKey(d)}${loggedDays.has(d) ? ', есть записи' : ''}`}
              onClick={() => setDate(d)}
            >
              <span className="dot" />
              <span>{WEEKDAYS[i]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" aria-label="Следующая неделя" onClick={() => setDate(addDays(date, 7))}>
          {Icons.chevronRight}
        </button>
      </div>
      <div className="row-between">
        <b>{date === today ? 'Сегодня' : formatDateKey(date, true)}</b>
        {date !== today && (
          <button type="button" className="btn ghost small" onClick={() => setDate(today)}>
            К сегодняшнему дню
          </button>
        )}
      </div>

      {view === 'stats' ? (
        <NutritionStats date={date} targets={targets} weightKg={planState.latestWeight?.weightKg} onOpenPlan={() => setPlanOpen(true)} />
      ) : entries === undefined ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <>
          <div className="totals-row" aria-label="Итого за день">
            <div>
              <span>Жиры</span>
              <b className="num">{r1(totals.fat)}</b>
              {targets && <small>из {targets.fat}</small>}
            </div>
            <div>
              <span>Углев</span>
              <b className="num">{r1(totals.carbs)}</b>
              {targets && <small>из {targets.carbs}</small>}
            </div>
            <div>
              <span>Белк</span>
              <b className="num">{r1(totals.protein)}</b>
              {targets && <small>из {targets.protein}</small>}
            </div>
            <div title="Рекомендуемая суточная калорийность из личного плана">
              <span>РСК</span>
              <b className="num">{rsk === null ? '—' : `${rsk}%`}</b>
            </div>
            <div>
              <span>Калории</span>
              <b className="num">{Math.round(totals.kcal)}</b>
              {targets && <small>из {targets.kcal.toLocaleString('ru-RU')}</small>}
            </div>
          </div>
          {!planState.plan && (
            <button type="button" className="notice info plan-hint" onClick={() => setPlanOpen(true)}>
              Составьте личный план — появятся цели по калориям, БЖУ и воде с учётом веса и соревнований.
            </button>
          )}

          {MEAL_TYPES.map((mt) => {
            const list = entries.filter((e) => e.mealType === mt);
            const t = sumNutrients(list.map((e) => e.nutrients));
            return (
              <section key={mt} className="card meal-card" aria-label={MEAL_TYPE_LABEL[mt]}>
                <button type="button" className="meal-head" onClick={() => setFlow({ meal: mt, start: 'sheet' })} aria-label={`${MEAL_TYPE_LABEL[mt]}: добавить еду`}>
                  <span className="meal-icon" aria-hidden="true">
                    {MEAL_ICON[mt]}
                  </span>
                  <span className="grow">
                    <span className="meal-name">{MEAL_TYPE_LABEL[mt]}</span>
                    {list.length > 0 && (
                      <span className="muted small num">
                        {Math.round(t.kcal)} ккал · Б {r1(t.protein)} · Ж {r1(t.fat)} · У {r1(t.carbs)}
                      </span>
                    )}
                  </span>
                  <span className="meal-plus" aria-hidden="true">
                    {Icons.plus}
                  </span>
                </button>
                {list.length > 0 && (
                  <ul className="meal-items">
                    {list.map((e) => (
                      <li key={e.id} className="meal-item">
                        <button type="button" className="grow meal-entry" onClick={() => setEditing(e)}>
                          <span className="title">
                            {e.foodName}
                            {e.brand && <span className="muted"> ({e.brand})</span>}
                          </span>
                          <span className="meta num">
                            {e.refId === QUICK_REF ? 'быстрый ввод' : `${r1(e.amount)} ${unitLabel(e.basis)}`} · {Math.round(e.nutrients.kcal)} ккал · Б {r1(e.nutrients.protein)} · Ж{' '}
                            {r1(e.nutrients.fat)} · У {r1(e.nutrients.carbs)}
                          </span>
                        </button>
                        <button type="button" className="icon-btn" aria-label={`Удалить: ${e.foodName}`} onClick={() => confirmDelete(e.foodName, () => deleteEntity('meals', e.id))}>
                          {Icons.trash}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <WaterCard date={date} plan={planState.plan} defaultMl={targets?.waterMl} onOpenPlan={() => setPlanOpen(true)} />
        </>
      )}

      {flow && <AddFlow mealType={flow.meal} start={flow.start} date={date} targetKcal={targets?.kcal} onClose={() => setFlow(null)} />}
      {editing && <MealEntryDialog entry={editing} date={date} onClose={() => setEditing(null)} />}
      {planOpen && <PlanDialog onClose={() => setPlanOpen(false)} />}
    </Page>
  );
}
