// Создание и редактирование продукта вручную.
import { useState, type FormEvent } from 'react';
import { saveEntity } from '../../data/repo.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { hasEnergyMismatch, kcalFromMacros } from '../../domain/nutrition.ts';
import type { Food } from '../../domain/schemas.ts';
import { Field, FormError, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';

export interface FoodPrefill {
  name?: string;
  barcode?: string;
}

interface Props {
  food?: Food;
  prefill?: FoodPrefill;
  onClose: () => void;
  onSaved?: (food: Food) => void;
}

export function FoodFormDialog({ food, prefill, onClose, onSaved }: Props) {
  const { notify } = useFeedback();
  const [f, setF] = useState({
    name: food?.name ?? prefill?.name ?? '',
    brand: food?.brand ?? '',
    basis: food?.basis ?? 'g',
    kcal: numberToField(food?.per100.kcal),
    protein: numberToField(food?.per100.protein),
    fat: numberToField(food?.per100.fat),
    carbs: numberToField(food?.per100.carbs),
    sourceNote: food?.sourceNote ?? '',
    sourceUrl: food?.sourceUrl ?? '',
    barcode: food?.barcode ?? prefill?.barcode ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const per100 = {
    kcal: parseDecimal(f.kcal),
    protein: parseDecimal(f.protein),
    fat: parseDecimal(f.fat),
    carbs: parseDecimal(f.carbs),
  };
  const complete = Object.values(per100).every((v) => v !== undefined && Number.isFinite(v) && v >= 0);
  const mismatch = complete && hasEnergyMismatch(per100 as Food['per100']);
  const unit = f.basis === 'ml' ? '100 мл' : '100 г';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await saveEntity(
        'foods',
        {
          name: f.name,
          brand: emptyToUndefined(f.brand),
          basis: f.basis as Food['basis'],
          per100: per100 as Food['per100'],
          source: food?.source ?? 'manual',
          sourceNote: emptyToUndefined(f.sourceNote),
          sourceUrl: emptyToUndefined(f.sourceUrl),
          barcode: emptyToUndefined(f.barcode.replace(/[\s-]/g, '')),
          externalId: food?.externalId,
          license: food?.license,
          recipe: food?.recipe,
        },
        food,
      );
      if (!r.ok) {
        setErrors(r.errors);
        return;
      }
      notify(food ? 'Продукт обновлён' : 'Продукт добавлен в каталог');
      onSaved?.(r.value);
      onClose();
    } catch (err) {
      notify(`Не удалось сохранить: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  const num = (k: 'kcal' | 'protein' | 'fat' | 'carbs', label: string) => (
    <Field label={label} error={errors[`per100.${k}`]}>
      {(p) => <input {...p} className="input" inputMode="decimal" autoComplete="off" value={f[k]} onChange={set(k)} />}
    </Field>
  );

  return (
    <Modal
      title={food ? 'Изменить продукт' : 'Новый продукт'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="food-form" className="btn primary" disabled={saving}>
            Сохранить
          </button>
        </>
      }
    >
      <form id="food-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <Field label="Название" error={errors.name}>
          {(p) => <input {...p} className="input" value={f.name} onChange={set('name')} autoFocus />}
        </Field>
        <Field label="Бренд" optional error={errors.brand}>
          {(p) => <input {...p} className="input" value={f.brand} onChange={set('brand')} />}
        </Field>
        <Field
          label="Пищевая ценность указана на"
          hint="Как на упаковке. Миллилитры и граммы не пересчитываются друг в друга: для этого нужна плотность продукта."
        >
          {(p) => (
            <select {...p} className="input" value={f.basis} onChange={set('basis')}>
              <option value="g">100 г</option>
              <option value="ml">100 мл</option>
            </select>
          )}
        </Field>
        <div className="fields-4">
          {num('kcal', `Ккал / ${unit}`)}
          {num('protein', 'Белки, г')}
          {num('fat', 'Жиры, г')}
          {num('carbs', 'Углеводы, г')}
        </div>
        {errors.per100 && <p className="notice error">{errors.per100}</p>}
        {mismatch && (
          <p className="notice warn">
            Калорийность заметно отличается от рассчитанной по БЖУ (≈{Math.round(kcalFromMacros(per100 as Food['per100']))} ккал).
            Проверьте, нет ли опечатки. Сохранить можно и так.
          </p>
        )}
        <Field label="Источник сведений" optional hint="Например: упаковка, сайт производителя" error={errors.sourceNote}>
          {(p) => <input {...p} className="input" value={f.sourceNote} onChange={set('sourceNote')} />}
        </Field>
        <Field label="Ссылка на источник" optional error={errors.sourceUrl}>
          {(p) => <input {...p} className="input" type="url" inputMode="url" value={f.sourceUrl} onChange={set('sourceUrl')} />}
        </Field>
        <Field label="Штрихкод" optional error={errors.barcode}>
          {(p) => <input {...p} className="input" inputMode="numeric" value={f.barcode} onChange={set('barcode')} />}
        </Field>
      </form>
    </Modal>
  );
}
