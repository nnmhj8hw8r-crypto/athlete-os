// Соревнование: вид спорта, категория, даты старта и взвешивания (по Москве), цель и статус.
import { useState, type FormEvent } from 'react';
import { DEFAULT_WEIGHT_CATEGORY, SPORT_LABEL, type Sport } from '../../config.ts';
import { saveEntity } from '../../data/repo.ts';
import { COMPETITION_STATUS_LABEL, suggestWeighIn } from '../../domain/competition.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { COMPETITION_STATUSES, type Competition, type CompetitionStatus } from '../../domain/schemas.ts';
import { fromLocalInputValue, toLocalInputValue } from '../../domain/time.ts';
import { Field, FormError, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';

export function CompetitionDialog({ competition, onClose }: { competition?: Competition; onClose: () => void }) {
  const { notify } = useFeedback();
  const [f, setF] = useState({
    sport: (competition?.sport ?? 'judo') as Sport,
    weightCategory: competition?.weightCategory ?? DEFAULT_WEIGHT_CATEGORY.judo,
    name: competition?.name ?? '',
    startAt: competition ? toLocalInputValue(competition.startAt) : '',
    weighInAt: competition ? toLocalInputValue(competition.weighInAt) : '',
    location: competition?.location ?? '',
    targetWeightKg: numberToField(competition?.targetWeightKg),
    status: (competition?.status ?? 'planned') as CompetitionStatus,
    rules: competition?.rules ?? '',
    notes: competition?.notes ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  function changeSport(sport: Sport) {
    setF((s) => ({
      ...s,
      sport,
      // Категорию по умолчанию меняем, только если пользователь её не правил.
      weightCategory: s.weightCategory === DEFAULT_WEIGHT_CATEGORY[s.sport] ? DEFAULT_WEIGHT_CATEGORY[sport] : s.weightCategory,
    }));
  }

  const suggestion = f.startAt ? suggestWeighIn(f.startAt) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const startAt = fromLocalInputValue(f.startAt);
    const weighInAt = fromLocalInputValue(f.weighInAt);
    const errs: FieldErrors = {};
    if (!startAt) errs.startAt = 'Укажите дату и время старта';
    if (!weighInAt) errs.weighInAt = 'Укажите дату и время взвешивания';
    if (!startAt || !weighInAt) {
      setErrors(errs);
      return;
    }
    const r = await saveEntity(
      'competitions',
      {
        sport: f.sport,
        weightCategory: f.weightCategory,
        name: f.name,
        startAt,
        weighInAt,
        location: emptyToUndefined(f.location),
        targetWeightKg: parseDecimal(f.targetWeightKg),
        status: f.status,
        rules: emptyToUndefined(f.rules),
        notes: emptyToUndefined(f.notes),
      },
      competition,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(competition ? 'Соревнование обновлено' : 'Соревнование добавлено');
    onClose();
  }

  return (
    <Modal
      title={competition ? 'Изменить соревнование' : 'Новое соревнование'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="comp-form" className="btn primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id="comp-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <div className="fields-2">
          <Field label="Вид спорта">
            {(p) => (
              <select {...p} className="input" value={f.sport} onChange={(e) => changeSport(e.target.value as Sport)}>
                {(Object.keys(SPORT_LABEL) as Sport[]).map((s) => (
                  <option key={s} value={s}>
                    {SPORT_LABEL[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Весовая категория, кг" error={errors.weightCategory}>
            {(p) => <input {...p} className="input" value={f.weightCategory} onChange={set('weightCategory')} />}
          </Field>
        </div>
        <Field label="Название соревнования" error={errors.name}>
          {(p) => <input {...p} className="input" value={f.name} onChange={set('name')} />}
        </Field>
        <Field label="Дата и время старта (МСК)" error={errors.startAt}>
          {(p) => <input {...p} className="input" type="datetime-local" value={f.startAt} onChange={set('startAt')} />}
        </Field>
        <Field
          label="Дата и время взвешивания (МСК)"
          error={errors.weighInAt}
          hint={
            suggestion && suggestion !== f.weighInAt ? (
              <button type="button" className="btn ghost small" onClick={() => setF((s) => ({ ...s, weighInAt: suggestion }))}>
                Подставить: за день до старта, то же время
              </button>
            ) : (
              'Укажите по регламенту соревнования.'
            )
          }
        >
          {(p) => <input {...p} className="input" type="datetime-local" value={f.weighInAt} onChange={set('weighInAt')} />}
        </Field>
        <Field label="Место проведения" optional error={errors.location}>
          {(p) => <input {...p} className="input" value={f.location} onChange={set('location')} />}
        </Field>
        <div className="fields-2">
          <Field label="Целевая масса, кг" optional error={errors.targetWeightKg}>
            {(p) => <input {...p} className="input" inputMode="decimal" value={f.targetWeightKg} onChange={set('targetWeightKg')} />}
          </Field>
          <Field label="Статус">
            {(p) => (
              <select {...p} className="input" value={f.status} onChange={set('status')}>
                {COMPETITION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {COMPETITION_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label="Регламент" optional error={errors.rules}>
          {(p) => <textarea {...p} className="input" value={f.rules} onChange={set('rules')} />}
        </Field>
        <Field label="Заметки" optional error={errors.notes}>
          {(p) => <textarea {...p} className="input" value={f.notes} onChange={set('notes')} />}
        </Field>
      </form>
    </Modal>
  );
}
