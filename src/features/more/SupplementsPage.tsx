// Журнал добавок. Только записи пользователя: приложение ничего не назначает и не рекомендует.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity, saveEntity } from '../../data/repo.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import type { Supplement } from '../../domain/schemas.ts';
import { formatDateKey, todayKey } from '../../domain/time.ts';
import { EmptyState, Field, FormError, Modal, Page, RowActions } from '../../ui/components.tsx';
import { useConfirmDelete, useFeedback } from '../../ui/feedback.tsx';
import { href } from '../../ui/router.ts';

export function SupplementsPage() {
  const items = useLiveQuery(() => db.supplements.orderBy('name').toArray(), []);
  const [dlg, setDlg] = useState<{ item?: Supplement } | null>(null);
  const confirmDelete = useConfirmDelete();
  const today = todayKey();

  return (
    <Page
      title="Добавки"
      subtitle={<a href={href('/more')}>← Ещё</a>}
      actions={
        <button type="button" className="btn primary" onClick={() => setDlg({})}>
          + Добавка
        </button>
      }
    >
      <p className="notice info small">
        Это журнал ваших записей, а не система назначений. Решения о приёме веществ принимайте со специалистом и с учётом
        антидопинговых правил (РУСАДА / WADA).
      </p>
      {items === undefined ? (
        <p className="muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <EmptyState>Записей нет. Добавьте то, что принимаете, с дозировкой и целью.</EmptyState>
      ) : (
        <ul className="list">
          {items.map((s) => {
            const active = (!s.startDate || s.startDate <= today) && (!s.endDate || s.endDate >= today);
            return (
              <li key={s.id} className="list-item">
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}>
                    <span className="title">{s.name}</span>
                    {active && <span className="badge ok">сейчас</span>}
                  </div>
                  <div className="meta">
                    {s.dose.toLocaleString('ru-RU')} {s.doseUnit}
                    {s.startDate && ` · с ${formatDateKey(s.startDate, true)}`}
                    {s.endDate && ` · по ${formatDateKey(s.endDate, true)}`}
                  </div>
                  {s.purpose && <div className="meta">Цель: {s.purpose}</div>}
                  {s.notes && <div className="meta">{s.notes}</div>}
                  {s.sourceUrl && (
                    <a className="small" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
                      Источник
                    </a>
                  )}
                </div>
                <RowActions label={s.name} onEdit={() => setDlg({ item: s })} onDelete={() => confirmDelete(s.name, () => deleteEntity('supplements', s.id))} />
              </li>
            );
          })}
        </ul>
      )}
      {dlg && <SupplementDialog item={dlg.item} onClose={() => setDlg(null)} />}
    </Page>
  );
}

function SupplementDialog({ item, onClose }: { item?: Supplement; onClose: () => void }) {
  const { notify } = useFeedback();
  const [f, setF] = useState({
    name: item?.name ?? '',
    dose: numberToField(item?.dose),
    doseUnit: item?.doseUnit ?? 'мг',
    startDate: item?.startDate ?? '',
    endDate: item?.endDate ?? '',
    purpose: item?.purpose ?? '',
    notes: item?.notes ?? '',
    sourceUrl: item?.sourceUrl ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await saveEntity(
      'supplements',
      {
        name: f.name,
        dose: parseDecimal(f.dose) as number,
        doseUnit: f.doseUnit,
        startDate: emptyToUndefined(f.startDate),
        endDate: emptyToUndefined(f.endDate),
        purpose: emptyToUndefined(f.purpose),
        notes: emptyToUndefined(f.notes),
        sourceUrl: emptyToUndefined(f.sourceUrl),
      },
      item,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(item ? 'Запись обновлена' : 'Добавка записана');
    onClose();
  }

  return (
    <Modal
      title={item ? 'Изменить запись' : 'Новая запись'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="supp-form" className="btn primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id="supp-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <Field label="Название" error={errors.name}>
          {(p) => <input {...p} className="input" value={f.name} onChange={set('name')} />}
        </Field>
        <div className="fields-2">
          <Field label="Дозировка" error={errors.dose}>
            {(p) => <input {...p} className="input" inputMode="decimal" value={f.dose} onChange={set('dose')} />}
          </Field>
          <Field label="Единица" error={errors.doseUnit} hint="мг, г, мкг, МЕ, капс.">
            {(p) => <input {...p} className="input" value={f.doseUnit} onChange={set('doseUnit')} />}
          </Field>
        </div>
        <div className="fields-2">
          <Field label="Начало" optional error={errors.startDate}>
            {(p) => <input {...p} className="input" type="date" value={f.startDate} onChange={set('startDate')} />}
          </Field>
          <Field label="Окончание" optional error={errors.endDate}>
            {(p) => <input {...p} className="input" type="date" value={f.endDate} onChange={set('endDate')} />}
          </Field>
        </div>
        <Field label="Цель приёма (ваша формулировка)" optional error={errors.purpose}>
          {(p) => <input {...p} className="input" value={f.purpose} onChange={set('purpose')} />}
        </Field>
        <Field label="Ссылка на источник" optional error={errors.sourceUrl}>
          {(p) => <input {...p} className="input" type="url" inputMode="url" value={f.sourceUrl} onChange={set('sourceUrl')} />}
        </Field>
        <Field label="Заметки" optional error={errors.notes}>
          {(p) => <textarea {...p} className="input" value={f.notes} onChange={set('notes')} />}
        </Field>
      </form>
    </Modal>
  );
}
