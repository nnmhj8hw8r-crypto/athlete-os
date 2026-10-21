// Запись сна и утреннего самочувствия.
import { useState, type FormEvent } from 'react';
import { saveEntity } from '../../data/repo.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import type { SleepEntry } from '../../domain/schemas.ts';
import { estimatedSleepMinutes, RATING_FIELDS, RATING_META, timeInBedMinutes, type RatingField } from '../../domain/sleep.ts';
import { formatDuration, fromLocalInputValue, toLocalInputValue } from '../../domain/time.ts';
import { Field, FormError, Modal, RatingInput } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';

interface Props {
  entry?: SleepEntry;
  initial?: { bedtime?: string; wakeTime?: string };
  onClose: () => void;
  onSaved?: () => void;
}

export function SleepDialog({ entry, initial, onClose, onSaved }: Props) {
  const { notify } = useFeedback();
  const bed0 = entry?.bedtime ?? initial?.bedtime;
  const wake0 = entry?.wakeTime ?? initial?.wakeTime ?? new Date().toISOString();
  const [f, setF] = useState({
    bedtime: bed0 ? toLocalInputValue(bed0) : '',
    wakeTime: toLocalInputValue(wake0),
    sleepLatencyMin: numberToField(entry?.sleepLatencyMin),
    wakeDuringNightMin: numberToField(entry?.wakeDuringNightMin),
    notes: entry?.notes ?? '',
  });
  const [ratings, setRatings] = useState<Record<RatingField, number | undefined>>({
    wellbeing: entry?.wellbeing,
    fatigue: entry?.fatigue,
    soreness: entry?.soreness,
    motivation: entry?.motivation,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const bedIso = fromLocalInputValue(f.bedtime);
  const wakeIso = fromLocalInputValue(f.wakeTime);
  const inBed = bedIso && wakeIso ? timeInBedMinutes(bedIso, wakeIso) : null;
  const latency = parseDecimal(f.sleepLatencyMin);
  const waso = parseDecimal(f.wakeDuringNightMin);
  const estimate =
    bedIso && wakeIso
      ? estimatedSleepMinutes({
          bedtime: bedIso,
          wakeTime: wakeIso,
          sleepLatencyMin: Number.isFinite(latency) ? latency : undefined,
          wakeDuringNightMin: Number.isFinite(waso) ? waso : undefined,
        })
      : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!bedIso || !wakeIso) {
      setErrors({ ...(bedIso ? {} : { bedtime: 'Укажите время' }), ...(wakeIso ? {} : { wakeTime: 'Укажите время' }) });
      return;
    }
    const r = await saveEntity(
      'sleep',
      {
        bedtime: bedIso,
        wakeTime: wakeIso,
        sleepLatencyMin: latency,
        wakeDuringNightMin: waso,
        ...ratings,
        notes: emptyToUndefined(f.notes),
      },
      entry,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(entry ? 'Запись обновлена' : 'Сон и самочувствие записаны');
    onSaved?.();
    onClose();
  }

  return (
    <Modal
      title={entry ? 'Изменить запись' : 'Сон и восстановление'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="sleep-form" className="btn primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id="sleep-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <div className="fields-2">
          <Field label="Лёг спать (МСК)" error={errors.bedtime}>
            {(p) => <input {...p} className="input" type="datetime-local" value={f.bedtime} onChange={set('bedtime')} />}
          </Field>
          <Field label="Проснулся (МСК)" error={errors.wakeTime}>
            {(p) => <input {...p} className="input" type="datetime-local" value={f.wakeTime} onChange={set('wakeTime')} />}
          </Field>
        </div>
        <div className="fields-2">
          <Field label="Засыпал примерно, мин" optional error={errors.sleepLatencyMin}>
            {(p) => <input {...p} className="input" inputMode="numeric" value={f.sleepLatencyMin} onChange={set('sleepLatencyMin')} />}
          </Field>
          <Field label="Ночные пробуждения, мин" optional error={errors.wakeDuringNightMin}>
            {(p) => <input {...p} className="input" inputMode="numeric" value={f.wakeDuringNightMin} onChange={set('wakeDuringNightMin')} />}
          </Field>
        </div>
        {inBed !== null && (
          <p className="notice info">
            В постели: <b>{formatDuration(inBed)}</b>.{' '}
            {estimate !== null ? (
              <>
                Оценка сна по вашим данным: <b>{formatDuration(estimate)}</b> (время в постели минус засыпание и пробуждения — это ваша оценка, а не измерение).
              </>
            ) : (
              'Это промежуток между отметками, а не фактическое время сна. Укажите засыпание и пробуждения, чтобы получить оценку.'
            )}
          </p>
        )}
        {RATING_FIELDS.map((k) => (
          <RatingInput
            key={k}
            label={RATING_META[k].label}
            low={RATING_META[k].low}
            high={RATING_META[k].high}
            value={ratings[k]}
            onChange={(v) => setRatings((r) => ({ ...r, [k]: v }))}
          />
        ))}
        <Field label="Заметка" optional error={errors.notes}>
          {(p) => <textarea {...p} className="input" value={f.notes} onChange={set('notes')} />}
        </Field>
      </form>
    </Modal>
  );
}
