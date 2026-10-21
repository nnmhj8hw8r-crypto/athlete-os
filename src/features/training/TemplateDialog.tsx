// Шаблон тренировки: тип, упражнения и планируемое число подходов.
import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { ensureExercise, saveEntity } from '../../data/repo.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { WORKOUT_TYPES, type WorkoutTemplate, type WorkoutType } from '../../domain/schemas.ts';
import { WORKOUT_TYPE_LABEL } from '../../domain/training.ts';
import { Field, FormError, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';

type Draft = Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'>;

let k = 1;

export function TemplateDialog({ template, draft, onClose }: { template?: WorkoutTemplate; draft?: Draft; onClose: () => void }) {
  const { notify } = useFeedback();
  const listId = useId();
  const known = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const src = template ?? draft;
  const [name, setName] = useState(src?.name ?? '');
  const [type, setType] = useState<WorkoutType>(src?.type ?? 'gym');
  const [title, setTitle] = useState(src?.title ?? '');
  const [notes, setNotes] = useState(src?.notes ?? '');
  const [rows, setRows] = useState(
    (src?.exercises ?? []).map((e) => ({ key: k++, name: e.name, plannedSets: numberToField(e.plannedSets) })),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const filled = rows.filter((r) => r.name.trim());
    const exercises = [];
    for (const r of filled) {
      const ex = await ensureExercise(r.name);
      exercises.push({ exerciseId: ex.id, name: ex.name, plannedSets: parseDecimal(r.plannedSets) });
    }
    const res = await saveEntity(
      'workoutTemplates',
      { name, type, title: emptyToUndefined(title), notes: emptyToUndefined(notes), exercises },
      template,
    );
    if (!res.ok) {
      const exErr = Object.entries(res.errors).find(([key]) => key.startsWith('exercises.'));
      setErrors({ ...res.errors, ...(exErr ? { _form: `Проверьте число подходов: ${exErr[1]}` } : {}) });
      return;
    }
    notify(template ? 'Шаблон обновлён' : 'Шаблон сохранён');
    onClose();
  }

  return (
    <Modal
      title={template ? 'Изменить шаблон' : 'Новый шаблон'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="tpl-form" className="btn primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id="tpl-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <Field label="Название шаблона" error={errors.name}>
          {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="fields-2">
          <Field label="Тип занятия">
            {(p) => (
              <select {...p} className="input" value={type} onChange={(e) => setType(e.target.value as WorkoutType)}>
                {WORKOUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORKOUT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Цель по умолчанию" optional>
            {(p) => <input {...p} className="input" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
        </div>
        <Field label="Заметки" optional>
          {(p) => <textarea {...p} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <datalist id={listId}>
          {known?.map((x) => <option key={x.id} value={x.name} />)}
        </datalist>
        <div className="section">
          <h3>Упражнения</h3>
          {rows.map((r, i) => (
            <div key={r.key} className="row" style={{ flexWrap: 'nowrap' }}>
              <input
                className="input"
                list={listId}
                aria-label={`Упражнение ${i + 1}`}
                placeholder="Название"
                value={r.name}
                onChange={(e) => setRows((l) => l.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className="input"
                style={{ width: 90 }}
                inputMode="numeric"
                aria-label={`Подходов, упражнение ${i + 1}`}
                placeholder="Подх."
                value={r.plannedSets}
                onChange={(e) => setRows((l) => l.map((x) => (x.key === r.key ? { ...x, plannedSets: e.target.value } : x)))}
              />
              <button type="button" className="icon-btn" aria-label={`Удалить упражнение ${i + 1}`} onClick={() => setRows((l) => l.filter((x) => x.key !== r.key))}>
                {Icons.trash}
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => setRows((l) => [...l, { key: k++, name: '', plannedSets: '3' }])}>
            + Упражнение
          </button>
        </div>
      </form>
    </Modal>
  );
}
