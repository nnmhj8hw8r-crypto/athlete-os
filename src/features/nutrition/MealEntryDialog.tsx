// Экран порции: продукт выбран (из истории, поиска, штрихкода) — указываем массу, приём пищи и дату.
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
import { MacroGrid } from './MacroGrid.tsx';
import { NutrientDetails } from './NutrientDetails.tsx';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

const QUICK_AMOUNTS = [50, 100, 150, 200, 250];

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

  return (
    <Modal
      title={entry ? 'Изменить запись' : `${MEAL_TYPE_LABEL[form.mealType]}: порция`}
      onClose={onClose}
      footer={
        <>
          {onBack && (
            <button type="button" className="btn" onClick={onBack}>
              Другой продукт
            </button>
          )}
          <button type="submit" form="meal-form" className="btn primary">
            {entry ? 'Сохранить' : 'Добавить'}
          </button>
        </>
      }
    >
      <form id="meal-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <div className="card">
          <div className="title">
            <b>{food.name}</b>
            {food.brand && <span className="muted"> · {food.brand}</span>}
          </div>
          {!quick && (
            <p className="small muted">
              На 100 {unit}: {Math.round(food.per100.kcal)} ккал, Б {r1(food.per100.protein)}, Ж {r1(food.per100.fat)}, У {r1(food.per100.carbs)}
            </p>
          )}
          {entry && <p className="small muted">Пищевая ценность взята из записи и не меняется при правке продукта в каталоге.</p>}
        </div>
        {!quick && (
          <>
            <Field label={`Порция, ${unit}`} error={errors.amount}>
              {(p) => (
                <input {...p} className="input" inputMode="decimal" autoComplete="off" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
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
        {preview && <MacroGrid n={quick ? food.per100 : preview} />}
        {!quick && <NutrientDetails extra={previewExtra} title="Подробнее о нутриентах порции" />}
        <Field label="Заметка" optional error={errors.notes}>
          {(p) => <input {...p} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
        </Field>
      </form>
    </Modal>
  );
}
