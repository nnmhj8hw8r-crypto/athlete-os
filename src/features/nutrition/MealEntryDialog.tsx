// Запись приёма пищи: выбор продукта (свой каталог + встроенный справочник, штрихкод, Perek.us) и порции.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { filterFoods } from '../../data/foods.ts';
import { REFERENCE_FOODS, type ReferenceFood } from '../../data/referenceFoods.ts';
import { saveEntity } from '../../data/repo.ts';
import { rankByQuery } from '../../domain/foodSearch.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { MEAL_TYPE_LABEL, nutrientsForAmount, unitLabel } from '../../domain/nutrition.ts';
import { MEAL_TYPES, type Food, type MealEntry, type MealType } from '../../domain/schemas.ts';
import { getZonedParts } from '../../domain/time.ts';
import { Field, FormError, Modal, Tabs } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { perekProvider, PROVIDER_ATTRIBUTION } from './catalogProvider.ts';
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
  /** 'usda' — продукт из встроенного справочника: в каталог не сохраняется, в записи остаётся снимок. */
  source?: Food['source'] | 'usda';
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

const QUICK_AMOUNTS = [50, 100, 150, 200, 250];
const USDA_ATTRIBUTION = 'Данные: USDA FoodData Central';
const usdaUrl = (r: ReferenceFood) => `https://fdc.nal.usda.gov/food-details/${r.id.replace('usda:', '')}/nutrients`;
const isUsdaUrl = (url: string | undefined) => Boolean(url?.startsWith('https://fdc.nal.usda.gov/'));

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
  /** Приём пищи, в плашке которого нажали «+». */
  mealType?: MealType;
  date: string;
  onClose: () => void;
}

type PickTab = 'catalog' | 'search' | 'barcode';

export function MealEntryDialog({ entry, mealType, date, onClose }: Props) {
  const { notify } = useFeedback();
  const [food, setFood] = useState<PortionFood | null>(
    entry
      ? {
          foodId: entry.foodId,
          name: entry.foodName,
          brand: entry.brand,
          basis: entry.basis,
          per100: entry.per100,
          sourceUrl: entry.sourceUrl,
          source: isUsdaUrl(entry.sourceUrl) ? 'usda' : undefined,
        }
      : null,
  );
  const [perekOn, setPerekOn] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    perekProvider.checkAvailability(ctrl.signal).then((s) => setPerekOn(s.available), () => undefined);
    return () => ctrl.abort();
  }, []);
  const [tab, setTab] = useState<PickTab>('catalog');
  const [query, setQuery] = useState('');
  const [newFood, setNewFood] = useState<FoodPrefill | null>(null);
  const [form, setForm] = useState({
    amount: numberToField(entry?.amount),
    mealType: entry?.mealType ?? mealType ?? defaultMealType(),
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

  const pickReference = (r: ReferenceFood) => {
    setFood({ name: r.name, basis: 'g', per100: r.per100, sourceUrl: usdaUrl(r), source: 'usda' });
    setErrors({});
  };

  const hasQuery = query.trim().length > 0;
  const list = foods ? (hasQuery ? rankByQuery(foods, query, (f) => `${f.name} ${f.brand ?? ''}`) : filterFoods(foods, '').slice(0, 30)) : [];
  // Справочник показываем только по запросу, чтобы не засорять список своих продуктов.
  const refList = query.trim().length >= 2 ? rankByQuery(REFERENCE_FOODS, query, (f) => f.name, 30) : [];

  const tabs: { value: PickTab; label: string }[] = [
    { value: 'catalog', label: 'Поиск' },
    { value: 'barcode', label: 'Штрихкод' },
  ];
  if (perekOn) tabs.push({ value: 'search', label: 'Perek.us' });

  const modalTitle = entry ? 'Изменить запись' : `${MEAL_TYPE_LABEL[form.mealType]}: ${food ? 'порция' : 'добавить продукт'}`;

  return (
    <>
      <Modal
        title={modalTitle}
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
            <Tabs label="Источник продукта" value={tab} onChange={setTab} options={tabs} />
            {tab === 'catalog' && (
              <div className="stack">
                <label className="visually-hidden" htmlFor="food-q">
                  Поиск продукта
                </label>
                <input
                  id="food-q"
                  className="input"
                  type="search"
                  placeholder="Например: греческий йогурт, гречка, форель"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
                {foods === undefined ? (
                  <p className="muted">Загрузка…</p>
                ) : (
                  <>
                    {list.length > 0 && (
                      <>
                        <p className="search-group">{hasQuery ? 'Мои продукты' : 'Мои продукты — недавние'}</p>
                        <ul className="list">
                          {list.map((f) => (
                            <li key={f.id}>
                              <button type="button" className="list-item selectable" onClick={() => pickFood(f)}>
                                <span className="grow">
                                  <span className="title">{f.name}</span>
                                  <span className="meta">
                                    {f.brand ? `${f.brand} · ` : ''}
                                    {Math.round(f.per100.kcal)} ккал · Б {r1(f.per100.protein)} · Ж {r1(f.per100.fat)} · У {r1(f.per100.carbs)} / 100{' '}
                                    {unitLabel(f.basis)}
                                    {f.source === 'recipe' ? ' · рецепт' : ''}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {refList.length > 0 && (
                      <>
                        <p className="search-group">Справочник продуктов (USDA)</p>
                        <ul className="list">
                          {refList.map((r) => (
                            <li key={r.id}>
                              <button type="button" className="list-item selectable" onClick={() => pickReference(r)}>
                                <span className="grow">
                                  <span className="title">{r.name}</span>
                                  <span className="meta">
                                    {Math.round(r.per100.kcal)} ккал · Б {r1(r.per100.protein)} · Ж {r1(r.per100.fat)} · У {r1(r.per100.carbs)} / 100 г
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {list.length === 0 && refList.length === 0 && (
                      <p className="muted small">
                        {hasQuery
                          ? 'Ничего не найдено. Создайте продукт — он сохранится в ваш каталог.'
                          : 'Введите название продукта или отсканируйте штрихкод.'}
                      </p>
                    )}
                    <div className="row">
                      <button type="button" className="btn" onClick={() => setNewFood({ name: query.trim() })}>
                        + Создать продукт
                      </button>
                      <button type="button" className="btn ghost" onClick={() => setTab('barcode')}>
                        Сканировать штрихкод
                      </button>
                    </div>
                  </>
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
              {food.sourceUrl && (food.source === 'perek' || food.source === 'off' || food.source === 'usda') && (
                <a className="small" href={food.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {food.source === 'usda' ? USDA_ATTRIBUTION : PROVIDER_ATTRIBUTION[food.source]}
                </a>
              )}
              {entry && <p className="small muted">Пищевая ценность взята из записи и не меняется при правке продукта в каталоге.</p>}
            </div>
            <Field label={`Порция, ${unitLabel(food.basis)}`} error={errors.amount}>
              {(p) => (
                <input {...p} className="input" inputMode="decimal" autoComplete="off" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
              )}
            </Field>
            <div className="chips" aria-label="Быстрый выбор порции">
              {QUICK_AMOUNTS.map((a) => (
                <button key={a} type="button" className="chip" onClick={() => setForm({ ...form, amount: String(a) })}>
                  {a} {unitLabel(food.basis)}
                </button>
              ))}
            </div>
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
