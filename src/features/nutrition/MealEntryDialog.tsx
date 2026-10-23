// Экран порции (v0.9.4, по образцу FatSecret): отдельный полноэкранный экран — название, «Добавить в мой
// дневник» с количеством и «Сохранить», плитки КБЖУ (калории — с долей от дневной цели), таблица пищевой
// ценности на 100 г/мл и в порции. Продукт выбран из истории, поиска или штрихкода.
// Также используется для правки уже сохранённой записи.
import { useState, type FormEvent } from 'react';
import { saveMealEntry, type PortionFood } from '../../data/meals.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { QUICK_REF } from '../../domain/foodHistory.ts';
import { scaleExtra } from '../../domain/nutrients.ts';
import { MEAL_TYPE_LABEL, nutrientsForAmount, unitLabel } from '../../domain/nutrition.ts';
import { MEAL_TYPES, type MealEntry, type MealType } from '../../domain/schemas.ts';
import { getZonedParts } from '../../domain/time.ts';
import { Field, FormError, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { NutrientDetails } from './NutrientDetails.tsx';
import { usePlanState } from './planData.ts';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

const QUICK_AMOUNTS = [50, 100, 150, 200, 250];
/** 1 ккал = 4,184 кДж (термохимическая калория). */
const KJ_PER_KCAL = 4.184;
const FACT_LABEL = { fat: 'Жиры', carbs: 'Углеводы', protein: 'Белки' } as const;

export function defaultMealType(now = new Date()): MealType {
  const h = getZonedParts(now).hour;
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export function entryToPortionFood(e: MealEntry): PortionFood {
  return { foodId: e.foodId, refId: e.refId, name: e.foodName, brand: e.brand, basis: e.basis, per100: e.per100, extra: e.extra100, sourceUrl: e.sourceUrl };
}

interface Props {
  /** Правка существующей записи. */
  entry?: MealEntry;
  /** Новая запись: выбранный продукт. */
  food?: PortionFood;
  mealType?: MealType;
  date: string;
  onClose: () => void;
  /** «Другой продукт» — вернуться к выбору. */
  onBack?: () => void;
  onSaved?: () => void;
}

export function MealEntryDialog({ entry, food: picked, mealType, date, onClose, onBack, onSaved }: Props) {
  const { notify } = useFeedback();
  const { targets } = usePlanState();
  const food = entry ? entryToPortionFood(entry) : picked!;
  const [form, setForm] = useState({
    amount: numberToField(entry?.amount ?? food.lastAmount),
    mealType: entry?.mealType ?? mealType ?? defaultMealType(),
    date: entry?.date ?? date,
    notes: entry?.notes ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const quick = entry?.refId === QUICK_REF;

  const amount = parseDecimal(form.amount);
  const valid = amount !== undefined && Number.isFinite(amount) && amount >= 0;
  const preview = valid ? nutrientsForAmount(food.per100, amount) : null;
  const previewExtra = valid ? scaleExtra(food.extra, amount) : undefined;
  const unit = unitLabel(food.basis);
  const chips = [...new Set([...(food.lastAmount ? [food.lastAmount] : []), ...QUICK_AMOUNTS])];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await saveMealEntry(
      { food, amount: parseDecimal(form.amount) as number, mealType: form.mealType, date: form.date, notes: emptyToUndefined(form.notes) },
      entry,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(entry ? 'Запись обновлена' : `Добавлено в «${MEAL_TYPE_LABEL[form.mealType]}»`);
    onSaved?.();
    onClose();
  }

  const t = targets;
  const pct = (v: number, goal: number | undefined) => (goal && goal > 0 ? ` (${Math.round((v / goal) * 100)}%)` : '');
  const shown = quick ? food.per100 : preview;

  return (
    <Modal title={entry ? 'Изменить запись' : MEAL_TYPE_LABEL[form.mealType]} onClose={onClose} size="full">
      <form id="meal-form" className="form food-screen" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <header className="food-head">
          {food.brand && <span className="food-brand">{food.brand}</span>}
          <h1 className="food-name">{food.name}</h1>
        </header>

        <section className="food-add">
          <span className="food-add-title">{entry ? 'Запись в дневнике' : 'Добавить в мой дневник'}</span>
          {!quick && (
            <>
              <Field label={`Количество, ${unit}`} error={errors.amount}>
                {(p) => (
                  <input
                    {...p}
                    className="input food-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    autoFocus
                  />
                )}
              </Field>
              <div className="chips" aria-label="Быстрый выбор порции">
                {chips.map((a, i) => (
                  <button key={a} type="button" className={`chip${i === 0 && food.lastAmount === a ? ' chip-accent' : ''}`} onClick={() => setForm({ ...form, amount: String(a) })}>
                    {i === 0 && food.lastAmount === a ? `как в прошлый раз: ${r1(a)} ${unit}` : `${a} ${unit}`}
                  </button>
                ))}
              </div>
            </>
          )}
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
          <button type="submit" className="btn primary big food-save">
            Сохранить
          </button>
        </section>

        {shown && (
          <div className="food-tiles" aria-label="Калории и БЖУ порции">
            <div>
              <span>Калории</span>
              <b>
                {Math.round(shown.kcal)}
                {pct(shown.kcal, t?.kcal)}
              </b>
            </div>
            <div>
              <span>Жиры</span>
              <b>{r1(shown.fat)} г</b>
            </div>
            <div>
              <span>Углеводы</span>
              <b>{r1(shown.carbs)} г</b>
            </div>
            <div>
              <span>Белки</span>
              <b>{r1(shown.protein)} г</b>
            </div>
          </div>
        )}
        {shown && t && <p className="small muted">% — доля от вашей дневной цели по калориям из «Моего плана».</p>}

        {!quick && (
          <section className="food-facts" aria-label="Пищевая ценность">
            <h2>Пищевая ценность</h2>
            <table>
              <thead>
                <tr>
                  <th />
                  <th>на 100 {unit}</th>
                  <th>в порции{valid ? ` (${r1(amount!)} ${unit})` : ''}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Энергетическая ценность</td>
                  <td>
                    {Math.round(food.per100.kcal * KJ_PER_KCAL)} кДж
                    <small>{Math.round(food.per100.kcal)} ккал</small>
                  </td>
                  <td>
                    {preview ? `${Math.round(preview.kcal * KJ_PER_KCAL)} кДж` : '—'}
                    {preview && <small>{Math.round(preview.kcal)} ккал</small>}
                  </td>
                </tr>
                {(['fat', 'carbs', 'protein'] as const).map((k) => (
                  <tr key={k}>
                    <td>{FACT_LABEL[k]}</td>
                    <td>{r1(food.per100[k])} г</td>
                    <td>{preview ? `${r1(preview[k])} г` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entry && <p className="small muted">Пищевая ценность взята из записи и не меняется при правке продукта в каталоге.</p>}
          </section>
        )}
        {!quick && <NutrientDetails extra={previewExtra} title="Витамины, минералы и другое" />}
        <Field label="Заметка" optional error={errors.notes}>
          {(p) => <input {...p} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
        </Field>
        {onBack && (
          <button type="button" className="btn ghost" onClick={onBack}>
            ← Выбрать другой продукт
          </button>
        )}
      </form>
    </Modal>
  );
}
