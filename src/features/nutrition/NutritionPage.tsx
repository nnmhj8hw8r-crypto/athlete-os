import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity } from '../../data/repo.ts';
import { MEAL_TYPE_LABEL, sumNutrients, unitLabel } from '../../domain/nutrition.ts';
import { MEAL_TYPES, type MealEntry, type MealType } from '../../domain/schemas.ts';
import { addDays, formatDateKey, isValidDateKey, todayKey } from '../../domain/time.ts';
import { Card, Page, RowActions } from '../../ui/components.tsx';
import { useConfirmDelete } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { clearParam, href, type Route } from '../../ui/router.ts';
import { MacroGrid } from './MacroGrid.tsx';
import { MealEntryDialog } from './MealEntryDialog.tsx';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function NutritionPage({ route }: { route: Route }) {
  const [date, setDate] = useState(() => {
    const d = route.params.get('date');
    return d && isValidDateKey(d) ? d : todayKey();
  });
  const [dialog, setDialog] = useState<{ entry?: MealEntry; mealType?: MealType } | null>(null);
  const confirmDelete = useConfirmDelete();
  const entries = useLiveQuery(() => db.meals.where('date').equals(date).sortBy('createdAt'), [date]);

  useEffect(() => {
    if (route.params.get('add') === '1') {
      setDialog({});
      clearParam(route, 'add');
    }
  }, [route]);

  const today = todayKey();
  const totals = entries ? sumNutrients(entries.map((e) => e.nutrients)) : null;

  return (
    <Page
      title="Питание"
      actions={
        <>
          <a className="btn" href={href('/nutrition/foods')}>
            Продукты и рецепты
          </a>
          <button type="button" className="btn primary" onClick={() => setDialog({})}>
            {Icons.plus} Добавить
          </button>
        </>
      }
    >
      <div className="row-between">
        <button type="button" className="icon-btn" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>
          {Icons.chevronLeft}
        </button>
        <div style={{ textAlign: 'center' }}>
          <b>{formatDateKey(date, true)}</b>
          {date !== today && (
            <div>
              <button type="button" className="btn ghost small" onClick={() => setDate(today)}>
                К сегодняшнему дню
              </button>
            </div>
          )}
        </div>
        <button type="button" className="icon-btn" aria-label="Следующий день" onClick={() => setDate(addDays(date, 1))}>
          {Icons.chevronRight}
        </button>
      </div>

      {entries === undefined ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <>
          <Card title="Итого за день">{totals && <MacroGrid n={totals} />}</Card>
          {/* Плашки приёмов пищи видны всегда, как в FatSecret: «+» сразу открывает добавление в нужный приём. */}
          {MEAL_TYPES.map((mt) => {
            const list = entries.filter((e) => e.mealType === mt);
            const t = sumNutrients(list.map((e) => e.nutrients));
            return (
              <section key={mt} className="card meal-card" aria-label={MEAL_TYPE_LABEL[mt]}>
                <div className="meal-head">
                  <div className="grow">
                    <h2>{MEAL_TYPE_LABEL[mt]}</h2>
                    <span className="muted small num">
                      {list.length === 0
                        ? 'Пока ничего'
                        : `${Math.round(t.kcal)} ккал · Б ${r1(t.protein)} · Ж ${r1(t.fat)} · У ${r1(t.carbs)}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn meal-add"
                    aria-label={`Добавить: ${MEAL_TYPE_LABEL[mt]}`}
                    onClick={() => setDialog({ mealType: mt })}
                  >
                    {Icons.plus}
                  </button>
                </div>
                {list.length > 0 && (
                <ul className="meal-items">
                  {list.map((e) => (
                    <li key={e.id} className="meal-item">
                      <div className="grow">
                        <div className="title">{e.foodName}</div>
                        <div className="meta num">
                          {r1(e.amount)} {unitLabel(e.basis)} · {Math.round(e.nutrients.kcal)} ккал · Б {r1(e.nutrients.protein)} · Ж {r1(e.nutrients.fat)} · У{' '}
                          {r1(e.nutrients.carbs)}
                        </div>
                        {e.notes && <div className="meta">{e.notes}</div>}
                      </div>
                      <RowActions
                        label={e.foodName}
                        onEdit={() => setDialog({ entry: e })}
                        onDelete={() => confirmDelete(e.foodName, () => deleteEntity('meals', e.id))}
                      />
                    </li>
                  ))}
                </ul>
                )}
              </section>
            );
          })}
        </>
      )}

      {dialog && <MealEntryDialog entry={dialog.entry} mealType={dialog.mealType} date={date} onClose={() => setDialog(null)} />}
    </Page>
  );
}
