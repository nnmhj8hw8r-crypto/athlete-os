// Настройки оценки готовности: дни калибровки, веса компонентов, время восстановления мышц.
// Стартовые значения — предложение, научно не проверены; пользователь подстраивает их под себя.
import { useState, type FormEvent } from 'react';
import { setReadinessConfig } from '../../data/checkins.ts';
import { COMPONENT_LABEL, DEFAULT_READINESS_CONFIG, normalizeReadinessConfig, type ComponentId, type ReadinessConfig } from '../../domain/readiness.ts';
import { Field, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';

const IDS: ComponentId[] = ['sleep', 'wellbeing', 'soreness', 'heart'];

export function ReadinessSettingsDialog({ config, onClose }: { config: ReadinessConfig; onClose: () => void }) {
  const { notify } = useFeedback();
  const [f, setF] = useState(() => ({
    calibrationDays: String(config.calibrationDays),
    small: String(config.recoveryHoursSmall),
    large: String(config.recoveryHoursLarge),
    ...Object.fromEntries(IDS.map((id) => [id, String(config.weights[id])])),
  }) as Record<string, string>);
  const set = (k: string) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const total = IDS.reduce((s, id) => s + (Number(f[id]) || 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = normalizeReadinessConfig({
      calibrationDays: Number(f.calibrationDays),
      recoveryHoursSmall: Number(f.small),
      recoveryHoursLarge: Number(f.large),
      weights: Object.fromEntries(IDS.map((id) => [id, Number(f[id])])),
    });
    await setReadinessConfig(next);
    notify('Настройки готовности сохранены');
    onClose();
  }

  return (
    <Modal
      title="Настройки готовности"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              await setReadinessConfig(DEFAULT_READINESS_CONFIG);
              notify('Восстановлены стартовые значения');
              onClose();
            }}
          >
            Стартовые
          </button>
          <button type="submit" form="readiness-form" className="btn primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id="readiness-form" className="form" onSubmit={submit} noValidate>
        <p className="small muted">
          Значения по умолчанию — стартовое предложение, научно не проверены. Подстройте их под себя: оценка всё равно
          считается относительно вашей личной нормы.
        </p>
        <Field label="Дней калибровки (M)" hint="Сколько прошлых чек-инов нужно до первой оценки, 3–28">
          {(p) => <input {...p} className="input" inputMode="numeric" value={f.calibrationDays} onChange={set('calibrationDays')} />}
        </Field>
        <div className="field">
          <span className="label">Веса, %</span>
          <div className="fields-2">
            {IDS.map((id) => (
              <Field key={id} label={COMPONENT_LABEL[id]}>
                {(p) => <input {...p} className="input" inputMode="numeric" value={f[id]} onChange={set(id)} />}
              </Field>
            ))}
          </div>
          <span className="hint">Сумма {total}%. Веса нормируются автоматически; без данных компонент выпадает.</span>
        </div>
        <div className="fields-2">
          <Field label="Восстановление малых групп, ч">{(p) => <input {...p} className="input" inputMode="numeric" value={f.small} onChange={set('small')} />}</Field>
          <Field label="Крупных групп, ч">{(p) => <input {...p} className="input" inputMode="numeric" value={f.large} onChange={set('large')} />}</Field>
        </div>
      </form>
    </Modal>
  );
}
