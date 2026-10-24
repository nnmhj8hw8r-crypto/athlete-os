// Добавки (v0.10): «Сегодня» — приёмы по времени с отметкой «принял», ниже — все добавки.
// Напоминание — файлом календаря (.ics): iPhone сам напомнит, даже когда приложение закрыто.
// Приложение ничего не назначает: что, сколько и когда принимать, решает пользователь (со специалистом).
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity, saveEntity, setSetting } from '../../data/repo.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import type { Supplement } from '../../domain/schemas.ts';
import { dosesForDay, isActiveOn, normalizeLog, SUPPLEMENT_LOG_KEY, supplementIcs, toggleDose } from '../../domain/supplements.ts';
import { formatDateKey, todayKey } from '../../domain/time.ts';
import { Card, EmptyState, Field, FormError, InfoButton, InfoPanel, Modal, Page, RowActions } from '../../ui/components.tsx';
import { useConfirmDelete, useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { href } from '../../ui/router.ts';

const UNITS = ['мг', 'г', 'мкг', 'МЕ', 'капс.', 'табл.', 'мл'];

function downloadIcs(s: Supplement) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const blob = new Blob([supplementIcs(s, todayKey(), stamp)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${s.name.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'dobavka'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SupplementsPage() {
  const items = useLiveQuery(() => db.supplements.orderBy('name').toArray(), []);
  const log = useLiveQuery(async () => normalizeLog((await db.settings.get(SUPPLEMENT_LOG_KEY))?.value), []);
  const [dlg, setDlg] = useState<{ item?: Supplement } | null>(null);
  const [info, setInfo] = useState(false);
  const confirmDelete = useConfirmDelete();
  const { notify } = useFeedback();
  const today = todayKey();
  const doses = items ? dosesForDay(items, today) : [];
  const taken = new Set(log?.[today] ?? []);
  const done = doses.filter((d) => taken.has(d.key)).length;

  return (
    <Page
      title="Добавки"
      subtitle={<a href={href('/more')}>← Ещё</a>}
      actions={
        <>
          <InfoButton open={info} onToggle={() => setInfo((o) => !o)} label="о разделе" />
          <button type="button" className="btn primary" onClick={() => setDlg({})}>
            {Icons.plus} Добавить
          </button>
        </>
      }
    >
      {info && (
        <InfoPanel>
          <p>Ваш список: что, сколько и когда вы принимаете. Отмечайте приём — так видно, ничего ли не пропущено.</p>
          <p>Напоминание: кнопка {Icons.bell} у добавки сохраняет событие в «Календарь» — iPhone напомнит в нужное время, даже если приложение закрыто.</p>
          <p className="muted">Решения о приёме — со специалистом и с учётом антидопинговых правил (РУСАДА / WADA): выбирайте добавки с проверкой партии на допинг.</p>
        </InfoPanel>
      )}

      {items === undefined ? (
        <p className="muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <EmptyState
          action={
            <button type="button" className="btn primary" onClick={() => setDlg({})}>
              Добавить первую
            </button>
          }
        >
          Добавьте то, что принимаете, — с дозой и временем. Здесь появится список на сегодня с отметками.
        </EmptyState>
      ) : (
        <>
          <Card title="Сегодня" aside={doses.length > 0 && <span className="muted small num">{done} из {doses.length}</span>}>
            {doses.length === 0 ? (
              <p className="muted small">Сегодня по датам приёма ничего нет.</p>
            ) : (
              <>
                <div className="dose-progress" aria-hidden="true">
                  <span style={{ width: `${(done / doses.length) * 100}%` }} />
                </div>
                <ul className="dose-list">
                  {doses.map((d) => {
                    const on = taken.has(d.key);
                    return (
                      <li key={d.key}>
                        <button
                          type="button"
                          className={`dose${on ? ' on' : ''}`}
                          aria-pressed={on}
                          onClick={() => void setSetting(SUPPLEMENT_LOG_KEY, toggleDose(log ?? {}, today, d.key))}
                        >
                          <span className="dose-time num">{d.time || 'днём'}</span>
                          <span className="grow">
                            <b>{d.supplement.name}</b>
                            <span className="muted small">
                              {d.supplement.dose.toLocaleString('ru-RU')} {d.supplement.doseUnit}
                            </span>
                          </span>
                          <span className="dose-check">{Icons.check}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>

          <h2 className="section-title">Все добавки</h2>
          <ul className="list">
            {items.map((s) => {
              const active = isActiveOn(s, today);
              return (
                <li key={s.id} className={`list-item${active ? '' : ' faded'}`}>
                  <div className="grow">
                    <div className="title">{s.name}</div>
                    <div className="meta">
                      {s.dose.toLocaleString('ru-RU')} {s.doseUnit}
                      {s.times?.length ? ` · ${s.times.join(', ')}` : ''}
                      {s.endDate && ` · до ${formatDateKey(s.endDate)}`}
                      {!active && (s.startDate && s.startDate > today ? ` · с ${formatDateKey(s.startDate)}` : ' · закончена')}
                    </div>
                    {s.purpose && <div className="meta">{s.purpose}</div>}
                  </div>
                  {active && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Напоминание в календарь: ${s.name}`}
                      onClick={() => {
                        downloadIcs(s);
                        notify('Откройте файл и нажмите «Добавить все» — напоминания появятся в Календаре');
                      }}
                    >
                      {Icons.bell}
                    </button>
                  )}
                  <RowActions label={s.name} onEdit={() => setDlg({ item: s })} onDelete={() => confirmDelete(s.name, () => deleteEntity('supplements', s.id))} />
                </li>
              );
            })}
          </ul>
        </>
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
  const [times, setTimes] = useState<string[]>(item?.times ?? []);
  const [newTime, setNewTime] = useState('08:00');
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
        times: times.length ? [...times].sort() : undefined,
      },
      item,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(item ? 'Сохранено' : 'Добавка добавлена');
    onClose();
  }

  return (
    <Modal
      title={item ? 'Изменить' : 'Новая добавка'}
      onClose={onClose}
      footer={
        <button type="submit" form="supp-form" className="btn primary big">
          Сохранить
        </button>
      }
    >
      <form id="supp-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <Field label="Название" error={errors.name}>
          {(p) => <input {...p} className="input" value={f.name} placeholder="Например, креатин" onChange={set('name')} />}
        </Field>
        <Field label="Доза" error={errors.dose ?? errors.doseUnit}>
          {(p) => (
            <div className="stack-sm">
              <input {...p} className="input" inputMode="decimal" value={f.dose} placeholder="5" onChange={set('dose')} />
              <div className="chips" role="group" aria-label="Единица">
                {UNITS.map((u) => (
                  <button key={u} type="button" className={`chip${f.doseUnit === u ? ' chip-selected' : ''}`} aria-pressed={f.doseUnit === u} onClick={() => setF((s) => ({ ...s, doseUnit: u }))}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>
        <div className="field">
          <span className="label">
            Время приёма <span className="optional">(для списка «Сегодня» и напоминаний)</span>
          </span>
          <div className="chips">
            {times.map((t) => (
              <button key={t} type="button" className="chip chip-selected" aria-label={`Убрать ${t}`} onClick={() => setTimes((l) => l.filter((x) => x !== t))}>
                {t} ✕
              </button>
            ))}
          </div>
          <div className="row">
            <input className="input time-input" type="time" value={newTime} aria-label="Новое время" onChange={(e) => setNewTime(e.target.value)} />
            <button type="button" className="btn" disabled={!newTime || times.includes(newTime) || times.length >= 6} onClick={() => setTimes((l) => [...l, newTime].sort())}>
              {Icons.plus} Время
            </button>
          </div>
          {errors.times && <span className="error">{errors.times}</span>}
        </div>
        <div className="fields-2">
          <Field label="С" optional error={errors.startDate}>
            {(p) => <input {...p} className="input" type="date" value={f.startDate} onChange={set('startDate')} />}
          </Field>
          <Field label="По" optional error={errors.endDate}>
            {(p) => <input {...p} className="input" type="date" value={f.endDate} onChange={set('endDate')} />}
          </Field>
        </div>
        <details className="details">
          <summary>Цель, заметки, источник</summary>
          <Field label="Цель (своими словами)" optional error={errors.purpose}>
            {(p) => <input {...p} className="input" value={f.purpose} onChange={set('purpose')} />}
          </Field>
          <Field label="Заметки" optional error={errors.notes}>
            {(p) => <textarea {...p} className="input" value={f.notes} onChange={set('notes')} />}
          </Field>
          <Field label="Ссылка на источник" optional error={errors.sourceUrl}>
            {(p) => <input {...p} className="input" type="url" inputMode="url" value={f.sourceUrl} onChange={set('sourceUrl')} />}
          </Field>
        </details>
      </form>
    </Modal>
  );
}
