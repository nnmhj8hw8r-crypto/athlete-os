// Утренний чек-ин (до 30 секунд): сон, энергия, настроение, стресс, боль по карте мышц,
// по желанию — пульс покоя и HRV (RMSSD). После сохранения страница показывает готовность.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { saveCheckin } from '../../data/checkins.ts';
import { db } from '../../data/db.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { CHECKIN_SCALES, type ScaleId } from '../../domain/checkinScales.ts';
import type { Checkin, Muscle } from '../../domain/schemas.ts';
import { timeInBedMinutes } from '../../domain/sleep.ts';
import { toDateKey } from '../../domain/time.ts';
import { Field, FormError, Modal, RatingInput } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { MuscleChips, MuscleStatusMap } from './MuscleStatusMap.tsx';

function Scale({ id, value, onChange }: { id: ScaleId; value: number | undefined; onChange: (v: number | undefined) => void }) {
  const def = CHECKIN_SCALES[id];
  return <RatingInput label={def.label} anchors={def.anchors} info={<p className="small">{def.how}</p>} value={value} onChange={onChange} />;
}

export function CheckinDialog({ date, existing, onClose, onSaved }: { date: string; existing?: Checkin; onClose: () => void; onSaved?: () => void }) {
  const { notify } = useFeedback();
  // Время в постели из записи сна этого дня — как подсказка для поля «часы сна».
  const sleepToday = useLiveQuery(async () => (await db.sleep.toArray()).filter((s) => toDateKey(s.wakeTime) === date).pop() ?? null, [date]);
  const suggested = sleepToday ? timeInBedMinutes(sleepToday.bedtime, sleepToday.wakeTime) : null;
  const [hours, setHours] = useState(numberToField(existing?.sleepHours));
  const [quality, setQuality] = useState(existing?.sleepQuality);
  const [energy, setEnergy] = useState(existing?.energy);
  const [mood, setMood] = useState(existing?.mood);
  const [stress, setStress] = useState(existing?.stress);
  const [sore, setSore] = useState<Muscle[]>(existing?.soreMuscles ?? []);
  const [hr, setHr] = useState(numberToField(existing?.restingHr));
  const [hrv, setHrv] = useState(numberToField(existing?.hrvRmssd));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const toggle = (m: Muscle) => setSore((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m]));
  const hrvNum = parseDecimal(hrv);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const sleepHours = parseDecimal(hours);
    const r = await saveCheckin({
      date,
      sleepHours: sleepHours === undefined ? undefined : Math.round(sleepHours * 10) / 10,
      sleepQuality: quality,
      energy,
      mood,
      stress,
      soreMuscles: sore,
      restingHr: parseDecimal(hr),
      hrvRmssd: hrvNum,
      notes: emptyToUndefined(notes),
    });
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify('Чек-ин сохранён');
    onSaved?.();
    onClose();
  }

  return (
    <Modal
      title="Утренний чек-ин"
      onClose={onClose}
      size="full"
      footer={
        <button type="submit" form="checkin-form" className="btn primary big">
          Сохранить и показать готовность
        </button>
      }
    >
      <form id="checkin-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <div className="fields-2">
          <Field label="Сон, часов" error={errors.sleepHours} hint={suggested !== null && !hours ? `В постели по записи: ${(Math.round(suggested / 6) / 10).toLocaleString('ru-RU')} ч` : undefined}>
            {(p) => (
              <div className="stepper">
                <button type="button" className="round-btn" aria-label="Меньше на полчаса" onClick={() => setHours((h) => numberToField(Math.max(0, (parseDecimal(h) ?? 7.5) - 0.5)))}>
                  −
                </button>
                <input {...p} className="input" inputMode="decimal" value={hours} placeholder={suggested !== null ? (Math.round(suggested / 6) / 10).toLocaleString('ru-RU') : '7,5'} onChange={(e) => setHours(e.target.value)} />
                <button type="button" className="round-btn" aria-label="Больше на полчаса" onClick={() => setHours((h) => numberToField(Math.min(24, (parseDecimal(h) ?? (suggested !== null ? suggested / 60 : 7)) + 0.5)))}>
                  +
                </button>
              </div>
            )}
          </Field>
          {suggested !== null && !hours && (
            <button type="button" className="btn small" onClick={() => setHours(numberToField(Math.round(suggested / 6) / 10))}>
              Взять из записи сна
            </button>
          )}
        </div>
        <Scale id="sleepQuality" value={quality} onChange={setQuality} />
        <Scale id="energy" value={energy} onChange={setEnergy} />
        <Scale id="mood" value={mood} onChange={setMood} />
        <Scale id="stress" value={stress} onChange={setStress} />
        <p className="small muted">Описания значений — подсказки приложения, а не медицинский опросник.</p>

        <div className="field">
          <span className="label">
            Что болит <span className="optional">(выберите группы)</span>
          </span>
          <MuscleChips selected={sore} onPick={toggle} />
          <details className="details">
            <summary>Показать на фигуре</summary>
            <MuscleStatusMap sore={sore} onPick={toggle} />
          </details>
        </div>

        <details className="details">
          <summary>Пульс покоя и HRV (необязательно)</summary>
          <div className="fields-2">
            <Field label="Пульс покоя, уд/мин" optional error={errors.restingHr}>
              {(p) => <input {...p} className="input" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} />}
            </Field>
            <Field label="HRV (RMSSD), мс" optional error={errors.hrvRmssd} hint={hrvNum && hrvNum > 0 ? `ln(RMSSD) = ${(Math.round(Math.log(hrvNum) * 100) / 100).toLocaleString('ru-RU')}` : 'Из приложения часов или ремня'}>
              {(p) => <input {...p} className="input" inputMode="decimal" value={hrv} onChange={(e) => setHrv(e.target.value)} />}
            </Field>
          </div>
          <p className="small muted">Без этих полей оценка считается по остальным показателям.</p>
        </details>
        <Field label="Заметка" optional>
          {(p) => <input {...p} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
