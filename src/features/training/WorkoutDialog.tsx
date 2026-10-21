// Создание и редактирование тренировки, включая упражнения и подходы.
import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { ensureExercise, saveEntity } from '../../data/repo.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { WORKOUT_TYPES, type Workout, type WorkoutSet, type WorkoutType } from '../../domain/schemas.ts';
import { WORKOUT_TYPE_LABEL } from '../../domain/training.ts';
import { fromLocalInputValue, toLocalInputValue } from '../../domain/time.ts';
import { Field, FormError, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';

interface SetRow {
  reps: string;
  weightKg: string;
  restSec: string;
  rpe: string;
  notes: string;
}
interface ExerciseRow {
  key: number;
  name: string;
  notes: string;
  sets: SetRow[];
}

let nextKey = 1;
const emptySet = (): SetRow => ({ reps: '', weightKg: '', restSec: '', rpe: '', notes: '' });
const toSetRow = (s: WorkoutSet): SetRow => ({
  reps: numberToField(s.reps),
  weightKg: numberToField(s.weightKg),
  restSec: numberToField(s.restSec),
  rpe: numberToField(s.rpe),
  notes: s.notes ?? '',
});

export type WorkoutDraft = Partial<Pick<Workout, 'type' | 'title' | 'exercises' | 'templateId'>>;

interface Props {
  workout?: Workout;
  draft?: WorkoutDraft;
  onClose: () => void;
}

export function WorkoutDialog({ workout, draft, onClose }: Props) {
  const { notify } = useFeedback();
  const datalistId = useId();
  const knownExercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const src = workout ?? draft;
  const [f, setF] = useState({
    startAt: toLocalInputValue(workout?.startAt ?? new Date().toISOString()),
    type: (src?.type ?? 'judo') as WorkoutType,
    title: src?.title ?? '',
    durationMin: numberToField(workout?.durationMin),
    rpe: numberToField(workout?.rpe),
    notes: workout?.notes ?? '',
  });
  const [exercises, setExercises] = useState<ExerciseRow[]>(
    (src?.exercises ?? []).map((e) => ({ key: nextKey++, name: e.name, notes: e.notes ?? '', sets: e.sets.map(toSetRow) })),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const updateEx = (key: number, patch: (e: ExerciseRow) => ExerciseRow) =>
    setExercises((list) => list.map((e) => (e.key === key ? patch(e) : e)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const startAt = fromLocalInputValue(f.startAt);
    if (!startAt) {
      setErrors({ startAt: 'Укажите дату и время' });
      return;
    }
    const named = exercises.filter((x) => x.name.trim());
    if (named.length !== exercises.length) {
      setErrors({ _form: 'У каждого упражнения должно быть название (или удалите пустое упражнение)' });
      return;
    }
    setSaving(true);
    try {
      const resolved = [];
      for (const x of named) {
        const ex = await ensureExercise(x.name);
        resolved.push({
          exerciseId: ex.id,
          name: ex.name,
          notes: emptyToUndefined(x.notes),
          sets: x.sets.map((s) => ({
            reps: parseDecimal(s.reps),
            weightKg: parseDecimal(s.weightKg),
            restSec: parseDecimal(s.restSec),
            rpe: parseDecimal(s.rpe),
            notes: emptyToUndefined(s.notes),
          })),
        });
      }
      const r = await saveEntity(
        'workouts',
        {
          startAt,
          type: f.type,
          title: f.title,
          durationMin: parseDecimal(f.durationMin),
          rpe: parseDecimal(f.rpe),
          notes: emptyToUndefined(f.notes),
          exercises: resolved,
          templateId: workout?.templateId ?? draft?.templateId,
        },
        workout,
      );
      if (!r.ok) {
        const setError = Object.entries(r.errors).find(([k]) => k.startsWith('exercises.'));
        setErrors({ ...r.errors, ...(setError ? { _form: `Проверьте подходы: ${setError[1]}` } : {}) });
        return;
      }
      notify(workout ? 'Тренировка обновлена' : 'Тренировка записана');
      onClose();
    } catch (err) {
      notify(`Не удалось сохранить: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <Modal
      title={workout ? 'Изменить тренировку' : 'Новая тренировка'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="workout-form" className="btn primary" disabled={saving}>
            Сохранить
          </button>
        </>
      }
    >
      <form id="workout-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <div className="fields-2">
          <Field label="Дата и время (МСК)" error={errors.startAt}>
            {(p) => <input {...p} className="input" type="datetime-local" value={f.startAt} onChange={set('startAt')} />}
          </Field>
          <Field label="Тип занятия" error={errors.type}>
            {(p) => (
              <select {...p} className="input" value={f.type} onChange={set('type')}>
                {WORKOUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORKOUT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label="Название или цель" error={errors.title}>
          {(p) => <input {...p} className="input" value={f.title} onChange={set('title')} placeholder="Например: техника бросков, сила ног" />}
        </Field>
        <div className="fields-2">
          <Field label="Длительность, мин" optional error={errors.durationMin}>
            {(p) => <input {...p} className="input" inputMode="numeric" value={f.durationMin} onChange={set('durationMin')} />}
          </Field>
          <Field label="Тяжесть занятия, 1–10" optional error={errors.rpe}>
            {(p) => <input {...p} className="input" inputMode="decimal" value={f.rpe} onChange={set('rpe')} />}
          </Field>
        </div>
        <Field label="Заметки о выполнении" optional error={errors.notes}>
          {(p) => <textarea {...p} className="input" value={f.notes} onChange={set('notes')} />}
        </Field>

        <div className="section">
          <div className="section-head">
            <h3>Упражнения и подходы</h3>
            <span className="small muted">необязательно</span>
          </div>
          <datalist id={datalistId}>
            {knownExercises?.map((x) => <option key={x.id} value={x.name} />)}
          </datalist>
          {exercises.map((x, xi) => (
            <div key={x.key} className="exercise-block">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <label className="visually-hidden" htmlFor={`ex-${x.key}`}>
                  Упражнение {xi + 1}
                </label>
                <input
                  id={`ex-${x.key}`}
                  className="input"
                  list={datalistId}
                  placeholder="Название упражнения"
                  value={x.name}
                  onChange={(e) => updateEx(x.key, (r) => ({ ...r, name: e.target.value }))}
                />
                <button type="button" className="icon-btn" aria-label={`Удалить упражнение ${x.name || xi + 1}`} onClick={() => setExercises((l) => l.filter((r) => r.key !== x.key))}>
                  {Icons.trash}
                </button>
              </div>
              {x.sets.length > 0 && (
                <table className="set-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Повт.</th>
                      <th>Вес, кг</th>
                      <th>Отдых, с</th>
                      <th>RPE</th>
                      <th>
                        <span className="visually-hidden">Действия</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {x.sets.map((s, si) => {
                      const cell = (k: keyof SetRow, label: string, mode: 'numeric' | 'decimal') => (
                        <td>
                          <input
                            className="input"
                            inputMode={mode}
                            aria-label={`${label}, подход ${si + 1}`}
                            value={s[k]}
                            onChange={(e) =>
                              updateEx(x.key, (r) => ({ ...r, sets: r.sets.map((z, i) => (i === si ? { ...z, [k]: e.target.value } : z)) }))
                            }
                          />
                        </td>
                      );
                      return (
                        <tr key={si}>
                          <td className="muted small">{si + 1}</td>
                          {cell('reps', 'Повторения', 'numeric')}
                          {cell('weightKg', 'Вес, кг', 'decimal')}
                          {cell('restSec', 'Отдых, с', 'numeric')}
                          {cell('rpe', 'RPE', 'decimal')}
                          <td>
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Удалить подход ${si + 1}`}
                              onClick={() => updateEx(x.key, (r) => ({ ...r, sets: r.sets.filter((_, i) => i !== si) }))}
                            >
                              {Icons.close}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="row">
                <button
                  type="button"
                  className="btn small"
                  onClick={() => updateEx(x.key, (r) => ({ ...r, sets: [...r.sets, r.sets.length ? { ...r.sets[r.sets.length - 1]!, notes: '' } : emptySet()] }))}
                >
                  + Подход
                </button>
              </div>
              <label className="visually-hidden" htmlFor={`exn-${x.key}`}>
                Заметка к упражнению
              </label>
              <input
                id={`exn-${x.key}`}
                className="input"
                placeholder="Заметка к упражнению (необязательно)"
                value={x.notes}
                onChange={(e) => updateEx(x.key, (r) => ({ ...r, notes: e.target.value }))}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => setExercises((l) => [...l, { key: nextKey++, name: '', notes: '', sets: [emptySet()] }])}
          >
            + Упражнение
          </button>
          <p className="small muted">Новый подход копирует значения предыдущего. Пустые поля подхода допустимы.</p>
        </div>
      </form>
    </Modal>
  );
}
