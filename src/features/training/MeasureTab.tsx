// Замеры: тесты физической подготовки (встроенные и свои) и фото прогресса.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { deletePhoto, savePhoto, updatePhoto } from '../../data/photos.ts';
import type { PhotoRecord } from '../../data/photoTypes.ts';
import { saveEntity } from '../../data/repo.ts';
import {
  allTests,
  formatTestValue,
  latestResult,
  parseTestValue,
  TEST_CATEGORY_LABEL,
  TEST_UNIT_LABEL,
  type FitnessTest,
  type TestCategory,
} from '../../domain/fitnessTests.ts';
import type { FieldErrors } from '../../domain/form.ts';
import { TEST_UNITS, type TestDef, type TestResult, type TestUnit } from '../../domain/schemas.ts';
import { formatDateKey, todayKey } from '../../domain/time.ts';
import { EmptyState, Field, FormError, Modal, Tabs } from '../../ui/components.tsx';
import { useConfirmDelete, useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { href } from '../../ui/router.ts';

const CATEGORY_ORDER: TestCategory[] = ['strength', 'speed', 'grip', 'endurance', 'body', 'own'];

export function MeasureTab() {
  const [view, setView] = useState<'tests' | 'photos'>('tests');
  return (
    <div className="stack">
      <Tabs
        label="Замеры"
        value={view}
        onChange={setView}
        options={[
          { value: 'tests', label: 'Тесты' },
          { value: 'photos', label: 'Фото прогресса' },
        ]}
      />
      {view === 'tests' ? <TestsList /> : <Photos />}
    </div>
  );
}

export function useTests(): FitnessTest[] | undefined {
  const own = useLiveQuery(() => db.testDefs.toArray(), []);
  return useMemo(() => (own ? allTests(own) : undefined), [own]);
}

function TestsList() {
  const tests = useTests();
  const results = useLiveQuery(() => db.testResults.toArray(), []);
  const [adding, setAdding] = useState<FitnessTest | null>(null);
  const [creating, setCreating] = useState(false);
  if (tests === undefined || results === undefined) return <p className="muted">Загрузка…</p>;
  const byTest = new Map<string, TestResult[]>();
  for (const r of results) byTest.set(r.testId, [...(byTest.get(r.testId) ?? []), r]);

  return (
    <>
      <p className="small muted">
        Общие тесты для отслеживания своей динамики. Нормативов и оценок нет — сравнивайте себя с собой и проводите
        тест в одинаковых условиях. Можно добавить свои тесты.
      </p>
      {CATEGORY_ORDER.map((c) => {
        const list = tests.filter((t) => t.category === c);
        if (!list.length) return null;
        return (
          <section key={c} className="ex-section">
            <h2 className="ex-section-head">{TEST_CATEGORY_LABEL[c]}</h2>
            <ul className="ex-list">
              {list.map((t) => {
                const last = latestResult(byTest.get(t.id) ?? []);
                return (
                  <li key={t.id} className="measure-row">
                    <a className="ex-row" href={href(`/training/test?id=${encodeURIComponent(t.id)}`)}>
                      <span className="measure-icon" aria-hidden="true">
                        {Icons.training}
                      </span>
                      <span className="grow">
                        <span className="title">{t.name}</span>
                        {last && <span className="meta">{formatDateKey(last.date)}</span>}
                      </span>
                      <span className="ex-last num">{last ? formatTestValue(t, last.value) : '––'}</span>
                    </a>
                    <button type="button" className="round-btn" aria-label={`Добавить результат: ${t.name}`} onClick={() => setAdding(t)}>
                      {Icons.plus}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <button type="button" className="btn" onClick={() => setCreating(true)}>
        {Icons.plus} Свой тест или замер
      </button>
      {adding && <ResultDialog test={adding} onClose={() => setAdding(null)} />}
      {creating && <TestDefDialog onClose={() => setCreating(false)} />}
    </>
  );
}

export function ResultDialog({ test, result, onClose }: { test: FitnessTest; result?: TestResult; onClose: () => void }) {
  const { notify } = useFeedback();
  const [date, setDate] = useState(result?.date ?? todayKey());
  const [value, setValue] = useState(result ? (test.unit === 'sec' && result.value >= 60 ? formatTestValue(test, result.value) : String(result.value).replace('.', ',')) : '');
  const [notes, setNotes] = useState(result?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = parseTestValue(test, value);
    if (v === undefined) {
      setErrors({ value: test.unit === 'sec' ? 'Введите время: секунды (4,6) или м:сс (12:40)' : 'Введите число' });
      return;
    }
    const r = await saveEntity('testResults', { testId: test.id, date, value: v, notes: notes.trim() || undefined }, result);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify('Результат сохранён');
    onClose();
  }

  const unit = test.unit === 'sec' ? 'с или м:сс' : test.unit === 'other' ? (test.unitLabel ?? '') : TEST_UNIT_LABEL[test.unit];
  return (
    <Modal
      title={test.name}
      onClose={onClose}
      size="sheet"
      footer={
        <button type="submit" form="result-form" className="btn primary">
          Сохранить
        </button>
      }
    >
      <form id="result-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        {test.hint && <p className="small muted">{test.hint}</p>}
        <div className="fields-2">
          <Field label={`Результат${unit ? `, ${unit}` : ''}`} error={errors.value}>
            {(p) => <input {...p} className="input" inputMode={test.unit === 'sec' ? 'text' : 'decimal'} value={value} onChange={(e) => setValue(e.target.value)} data-autofocus />}
          </Field>
          <Field label="Дата" error={errors.date}>
            {(p) => <input {...p} className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
        <Field label="Заметка" optional>
          {(p) => <input {...p} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Условия, самочувствие, высота каната…" />}
        </Field>
      </form>
    </Modal>
  );
}

export function TestDefDialog({ def, onClose }: { def?: TestDef; onClose: () => void }) {
  const { notify } = useFeedback();
  const [name, setName] = useState(def?.name ?? '');
  const [unit, setUnit] = useState<TestUnit>(def?.unit ?? 'reps');
  const [unitLabel, setUnitLabel] = useState(def?.unitLabel ?? '');
  const [higher, setHigher] = useState(def?.higherIsBetter ?? true);
  const [notes, setNotes] = useState(def?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await saveEntity(
      'testDefs',
      { name, unit, unitLabel: unit === 'other' ? unitLabel.trim() || undefined : undefined, higherIsBetter: higher, notes: notes.trim() || undefined },
      def,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(def ? 'Тест изменён' : 'Тест добавлен');
    onClose();
  }

  const unitName: Record<TestUnit, string> = { reps: 'Разы (повторения)', sec: 'Время', cm: 'Сантиметры', kg: 'Килограммы', m: 'Метры', other: 'Другое' };
  return (
    <Modal
      title={def ? 'Изменить тест' : 'Свой тест или замер'}
      onClose={onClose}
      footer={
        <button type="submit" form="testdef-form" className="btn primary">
          Сохранить
        </button>
      }
    >
      <form id="testdef-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <Field label="Название" error={errors.name}>
          {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: броски манекена за 30 с" />}
        </Field>
        <div className="fields-2">
          <Field label="Единица">
            {(p) => (
              <select {...p} className="input" value={unit} onChange={(e) => setUnit(e.target.value as TestUnit)}>
                {TEST_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {unitName[u]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {unit === 'other' && (
            <Field label="Подпись единицы" error={errors.unitLabel}>
              {(p) => <input {...p} className="input" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="бросков" />}
            </Field>
          )}
        </div>
        <Field label="Что лучше">
          {(p) => (
            <select {...p} className="input" value={higher ? 'up' : 'down'} onChange={(e) => setHigher(e.target.value === 'up')}>
              <option value="up">Больше — лучше (подтягивания, обхват)</option>
              <option value="down">Меньше — лучше (время на канате, бег)</option>
            </select>
          )}
        </Field>
        <Field label="Как проводить" optional>
          {(p) => <textarea {...p} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}

// ---------- Фото прогресса ----------

function Photos() {
  const photos = useLiveQuery(() => db.photos.where('kind').equals('progress').toArray(), []);
  const [viewing, setViewing] = useState<PhotoRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { notify } = useFeedback();

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) await savePhoto(f, 'progress');
      notify(files.length > 1 ? `Добавлено фото: ${files.length}` : 'Фото добавлено');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (photos === undefined) return <p className="muted">Загрузка…</p>;
  const sorted = [...photos].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <button type="button" className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
        {Icons.camera} {busy ? 'Сохраняю…' : 'Добавить фото'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      <p className="small muted">
        Фото хранятся только в приложении на этом устройстве и открываются без интернета. В резервную копию они
        не входят: если удалить приложение или данные сайта, фото пропадут. Оригиналы остаются в «Фото» iPhone.
      </p>
      {sorted.length === 0 ? (
        <EmptyState>Фото пока нет. Добавьте снимок из галереи или камеры — дата ставится сегодняшняя, её можно изменить.</EmptyState>
      ) : (
        <ul className="photo-grid">
          {sorted.map((p) => (
            <li key={p.id}>
              <button type="button" className="photo-tile" onClick={() => setViewing(p)}>
                <img src={p.thumb} alt={`Фото от ${formatDateKey(p.date)}`} loading="lazy" />
                <span>{formatDateKey(p.date)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {viewing && <PhotoViewer photo={viewing} list={sorted} onSelect={setViewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function PhotoViewer({ photo, list, onSelect, onClose }: { photo: PhotoRecord; list: PhotoRecord[]; onSelect: (p: PhotoRecord) => void; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [date, setDate] = useState(photo.date);
  const [note, setNote] = useState(photo.note ?? '');
  const confirmDelete = useConfirmDelete();
  const { notify } = useFeedback();
  const i = list.findIndex((p) => p.id === photo.id);

  useEffect(() => {
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    setDate(photo.date);
    setNote(photo.note ?? '');
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const dirty = date !== photo.date || note !== (photo.note ?? '');
  return (
    <Modal title={`Фото от ${formatDateKey(photo.date, true)}`} onClose={onClose} size="full">
      {url && <img className="photo-full" src={url} alt={`Фото от ${formatDateKey(photo.date)}`} />}
      <div className="row-between">
        <button type="button" className="btn small" disabled={i >= list.length - 1} onClick={() => onSelect(list[i + 1]!)}>
          {Icons.chevronLeft} Раньше
        </button>
        <span className="small muted">
          {i + 1} из {list.length}
        </span>
        <button type="button" className="btn small" disabled={i <= 0} onClick={() => onSelect(list[i - 1]!)}>
          Позже {Icons.chevronRight}
        </button>
      </div>
      <div className="fields-2">
        <Field label="Дата">{(p) => <input {...p} className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Заметка" optional>
          {(p) => <input {...p} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Вес, фаза сезона…" />}
        </Field>
      </div>
      <div className="row">
        {dirty && (
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notify('Укажите дату', 'error');
              await updatePhoto(photo.id, { date, note });
              notify('Сохранено');
              onClose();
            }}
          >
            Сохранить
          </button>
        )}
        <button
          type="button"
          className="btn danger"
          onClick={() =>
            confirmDelete(`фото от ${formatDateKey(photo.date)}`, async () => {
              await deletePhoto(photo.id);
              onClose();
            })
          }
        >
          Удалить фото
        </button>
      </div>
    </Modal>
  );
}
