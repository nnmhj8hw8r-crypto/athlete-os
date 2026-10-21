import { useState, type FormEvent } from 'react';
import { saveEntity } from '../../data/repo.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import type { BodyWeight } from '../../domain/schemas.ts';
import { fromLocalInputValue, toLocalInputValue } from '../../domain/time.ts';
import { Field, FormError, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';

export function BodyWeightDialog({ entry, onClose }: { entry?: BodyWeight; onClose: () => void }) {
  const { notify } = useFeedback();
  const [f, setF] = useState({
    measuredAt: toLocalInputValue(entry?.measuredAt ?? new Date().toISOString()),
    weightKg: numberToField(entry?.weightKg),
    notes: entry?.notes ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const measuredAt = fromLocalInputValue(f.measuredAt);
    if (!measuredAt) {
      setErrors({ measuredAt: 'Укажите дату и время' });
      return;
    }
    const r = await saveEntity('bodyWeights', { measuredAt, weightKg: parseDecimal(f.weightKg) as number, notes: emptyToUndefined(f.notes) }, entry);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(entry ? 'Запись обновлена' : 'Масса записана');
    onClose();
  }

  return (
    <Modal
      title={entry ? 'Изменить взвешивание' : 'Масса тела'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="bw-form" className="btn primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id="bw-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <div className="fields-2">
          <Field label="Масса, кг" error={errors.weightKg}>
            {(p) => <input {...p} className="input" inputMode="decimal" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: e.target.value })} autoFocus />}
          </Field>
          <Field label="Дата и время (МСК)" error={errors.measuredAt}>
            {(p) => <input {...p} className="input" type="datetime-local" value={f.measuredAt} onChange={(e) => setF({ ...f, measuredAt: e.target.value })} />}
          </Field>
        </div>
        <Field label="Заметка" optional hint="Например: натощак, после тренировки" error={errors.notes}>
          {(p) => <input {...p} className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}
        </Field>
      </form>
    </Modal>
  );
}
