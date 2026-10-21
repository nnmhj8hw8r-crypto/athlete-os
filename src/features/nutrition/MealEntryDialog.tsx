// Запись приёма пищи: выбор продукта (свой каталог, внешний поиск, штрихкод) и порции.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { filterFoods } from '../../data/foods.ts';
import { saveEntity } from '../../data/repo.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { MEAL_TYPE_LABEL, nutrientsForAmount, unitLabel } from '../../domain/nutrition.ts';
import { MEAL_TYPES, type Food, type MealEntry, type MealType } from '../../domain/schemas.ts';
import { getZonedParts } from '../../domain/time.ts';
import { Field, FormError, Modal, Tabs } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { FoodFormDialog, type FoodPrefill } from './FoodFormDialog.tsx';
import { BarcodeLookup, ExternalSearch } from './FoodLookup.tsx';
import { MacroGrid } from './MacroGrid.tsx';

/** Продукт для порции: из каталога или снимок из уже сохранённой записи. */
interface PortionFood {
  foodId?: string;
  name: string;
  brand?: string;
  basis: Food['basis'];
  per100: Food['per100'];
  sourceUrl?: string;
  source?: Food['source'];
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

function fromFood(f: Food): PortionFood {
  return { foodId: f.id, name: f.name, brand: f.brand, basis: f.basis, per100: f.per100, sourceUrl: f.sourceUrl, source: f.source };
}

export function defaultMealType(now = new Date()): MealType {
  const h = getZonedParts(now).hour;
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

interface Props {
  entry?: MealEntry;
  date: string;
  onClose: () => void;
}

type PickTab = 'catalog' | 'search' | 'barcode';

export function MealEntryDialog({ entry, date, onClose }: Props) {
  const { notify } = useFeedback();
  const [food, setFood] = useState<PortionFood | null>(
    entry
      ? { foodId: entry.foodId, name: entry.foodName, brand: entry.brand, basis: entry.basis, per100: entry.per100, sourceUrl: entry.sourceUrl }
      : null,
  );
  const [tab, setTab] = useState<PickTab>('catalog');
  const [query, setQuery] = useState('');
  const [newFood, setNewFood] = useState<FoodPrefill | null>(null);
  const [form, setForm] = useState({
    amount: numberToField(entry?.amount),
    mealType: entry?.mealType ?? defaultMealType(),
    date: entry?.date ?? date,
    notes: entry?.notes ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const foods = useLiveQuery(() => db.foods.toArray(), []);

  const amount = parseDecimal(form.amount);
  const preview = food && amount !== undefined && Number.isFinite(amount) && amount >= 0 ? nutrientsForAmount(food.per100, amount) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!food) return;
    const a = parseDecimal(form.amount);
    const r = await saveEntity(
      'meals',
      {
        date: form.date,
        mealType: form.mealType,
        foodId: food.foodId,
        foodName: food.name,
        brand: food.brand,
        basis: food.basis,
        amount: a as number,
        per100: food.per100,
        // Пересчёт выполняется только для корректной порции; иначе схема покажет ошибку поля amount.
        nutrients: a !== undefined && Number.isFinite(a) && a >= 0 ? nutrientsForAmount(food.per100, a) : food.per100,
        sourceUrl: food.sourceUrl,
        notes: emptyToUndefined(form.notes),
      },
      entry,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(entry ? 'Запись обновлена' : 'Приём пищи записан');
    onClose();
  }

  const pickFood = (f: Food) => {
    setFood(fromFood(f));
    setErrors({});
  };

  const list = foods ? filterFoods(foods, query).slice(0, 50) : [];

  return (
    <>
      <Modal
        title={entry ? 'Изменить запись' : food ? 'Порция' : 'Выберите продукт'}
        onClose={onClose}
        footer={
          food ? (
            <>
              {!entry && (
                <button type="button" className="btn" onClick={() => setFood(null)}>
                  Другой продукт
                </button>
              )}
              <button type="submit" form="meal-form" className="btn primary">
                Сохранить
              </button>
            </>
          ) : undefined
        }
      >
        {!food && (
          <div className="stack">
            <Tabs
              label="Источник продукта"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'catalog', label: 'Мой каталог' },
                { value: 'search', label: 'Поиск Perek.us' },
                { value: 'barcode', label: 'Штрихкод' },
              ]}
            />
            {tab === 'catalog' && (
              <div className="stack">
                <div className="row">
                  <label className="visually-hidden" htmlFor="food-q">
                    Поиск в каталоге
                  </label>
                  <input id="food-q" className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Поиск по названию" value={query} onChange={(e) => setQuery(e.target.value)} />
                  <button type="button" className="btn" onClick={() => setNewFood({ name: query })}>
                    Новый продукт
                  </button>
                </div>
                {foods === undefined ? (
                  <p className="muted">Загрузка…</p>
                ) : list.length === 0 ? (
                  <div className="empty">
                    <p>{foods.length === 0 ? 'Каталог пока пуст. Добавьте первый продукт вручную или найдите его в Perek.us.' : 'Ничего не найдено.'}</p>
                    <div className="row">
                      <button type="button" className="btn primary" onClick={() => setNewFood({ name: query })}>
                        Создать продукт
                      </button>
                      <button type="button" className="btn" onClick={() => setTab('search')}>
                        Искать в Perek.us
                      </button>
                    </div>
                  </div>
                ) : (
                  <ul className="list">
                    {list.map((f) => (
                      <li key={f.id}>
                        <button type="button" className="list-item selectable" onClick={() => pickFood(f)}>
                          <span className="grow">
                            <span className="title">{f.name}</span>
                            <span className="meta">
                              {f.brand ? `${f.brand} · ` : ''}
                              {Math.round(f.per100.kcal)} ккал / 100 {unitLabel(f.basis)}
                              {f.source === 'recipe' ? ' · рецепт' : f.source === 'perek' ? ' · Perek.us' : ''}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === 'search' && <ExternalSearch initialQuery={query} onSelected={pickFood} onManual={setNewFood} />}
            {tab === 'barcode' && <BarcodeLookup onSelected={pickFood} onManual={setNewFood} />}
          </div>
        )}

        {food && (
          <form id="meal-form" className="form" onSubmit={submit} noValidate>
            <FormError errors={errors} />
            <div className="card">
              <div className="title">
                <b>{food.name}</b>
                {food.brand && <span className="muted"> · {food.brand}</span>}
              </div>
              <p className="small muted">
                На 100 {unitLabel(food.basis)}: {Math.round(food.per100.kcal)} ккал, Б {r1(food.per100.protein)}, Ж {r1(food.per100.fat)}, У{' '}
                {r1(food.per100.carbs)}
              </p>
              {food.sourceUrl && (food.source === 'perek' || food.sourceUrl.includes('perek.us')) && (
                <a className="small" href={food.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Данные: perek.us
                </a>
              )}
              {entry && <p className="small muted">Пищевая ценность взята из записи и не меняется при правке продукта в каталоге.</p>}
            </div>
            <Field label={`Порция, ${unitLabel(food.basis)}`} error={errors.amount}>
              {(p) => (
                <input {...p} className="input" inputMode="decimal" autoComplete="off" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
              )}
            </Field>
            <div className="fields-2">
              <Field label="Приём пищи" error={errors.mealType}>
                {(p) => (
                  <select {...p} className="input" value={form.mealType} onChange={(e) => setForm({ ...form, mealType: e.target.value as MealType })}>
                    {MEAL_TYPES.map((m) => (
                      <option key={m} value={m}>
                        {MEAL_TYPE_LABEL[m]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Дата" error={errors.date}>
                {(p) => <input {...p} className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}
              </Field>
            </div>
            {preview && <MacroGrid n={preview} />}
            <Field label="Заметка" optional error={errors.notes}>
              {(p) => <input {...p} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
            </Field>
          </form>
        )}
      </Modal>
      {newFood && (
        <FoodFormDialog
          prefill={newFood}
          onClose={() => setNewFood(null)}
          onSaved={(f) => {
            setNewFood(null);
            pickFood(f);
          }}
        />
      )}
    </>
  );
}
