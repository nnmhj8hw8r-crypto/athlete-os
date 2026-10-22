// Экран программы: список упражнений с планом, правка пунктов и кнопка «Начать».
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { saveEntity, withoutMeta } from '../../data/repo.ts';
import type { CatalogExercise } from '../../domain/exerciseLibrary.ts';
import { numberToField, parseDecimal } from '../../domain/form.ts';
import type { ExerciseMetric, ProgramItem } from '../../domain/schemas.ts';
import {
  EXERCISE_METRIC_LABEL,
  formatClock,
  formatPlanItem,
  parseClock,
  WORKOUT_FORMAT_LABEL,
  WORKOUT_TYPE_LABEL,
  weekdaysLabel,
  workoutFromProgram,
} from '../../domain/training.ts';
import { plural } from '../../domain/time.ts';
import { EmptyState, Field, Modal, TopBar } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { navigate, type Route } from '../../ui/router.ts';
import { ExercisePicker, ExIcon, ProgramCover, useCatalogMap } from './catalog.tsx';
import { ProgramDialog } from './ProgramDialog.tsx';
import { useStartSession } from './useSession.ts';

export function ProgramPage({ route }: { route: Route }) {
  const id = route.params.get('id') ?? '';
  const program = useLiveQuery(async () => (await db.programs.get(id)) ?? null, [id]);
  const map = useCatalogMap();
  const [settings, setSettings] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editItem, setEditItem] = useState<{ index: number; item: ProgramItem } | null>(null);
  const start = useStartSession();
  const { notify } = useFeedback();

  if (program === undefined) return <p className="muted">Загрузка…</p>;
  if (program === null) {
    return (
      <div className="page">
        <TopBar title="Программа" backTo="/training?tab=programs" />
        <EmptyState>Программа не найдена или удалена.</EmptyState>
      </div>
    );
  }

  async function saveItems(items: ProgramItem[]) {
    const p = program!;
    const r = await saveEntity('programs', { ...withoutMeta(p), items }, p);
    if (!r.ok) notify(`Не удалось сохранить: ${Object.values(r.errors)[0] ?? ''}`, 'error');
  }

  const items = program.items;
  const lead = items.findIndex((it) => {
    const g = map.get(it.exerciseId)?.group;
    return g !== 'warmup' && g !== 'cardio';
  });
  const warmCount = lead === -1 ? items.length : lead;
  const main = items.length - warmCount;

  const row = (it: ProgramItem, index: number) => {
    const ex = map.get(it.exerciseId);
    return (
      <li key={`${it.exerciseId}-${index}`}>
        <button type="button" className="ex-row" onClick={() => setEditItem({ index, item: it })}>
          <ExIcon ex={ex} />
          <span className="grow">
            <span className="title">{it.name}</span>
            <span className="meta">{formatPlanItem(it)}</span>
          </span>
          <span className="icon-btn" aria-hidden="true">
            {Icons.dots}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="page has-sticky">
      <TopBar
        title={program.name}
        backTo="/training?tab=programs"
        action={
          <button type="button" className="round-btn" aria-label="Настройки программы" onClick={() => setSettings(true)}>
            {Icons.edit}
          </button>
        }
      />
      <ProgramCover program={program} className="wide" />
      <div className="program-tags">
        <span className="tag">{WORKOUT_FORMAT_LABEL[program.format]}</span>
        <span className="tag">{WORKOUT_TYPE_LABEL[program.type]}</span>
        {program.weekdays?.length ? <span className="tag">{weekdaysLabel(program.weekdays)}</span> : null}
      </div>
      {program.notes && <p className="muted">{program.notes}</p>}

      {items.length === 0 && <EmptyState>В программе пока нет упражнений. Добавьте первое.</EmptyState>}
      {warmCount > 0 && (
        <section className="ex-section">
          <h2 className="ex-section-head plain">Разминка и кардио</h2>
          <ul className="ex-list">{items.slice(0, warmCount).map((it, i) => row(it, i))}</ul>
        </section>
      )}
      {main > 0 && (
        <section className="ex-section">
          <h2 className="ex-section-head plain">
            {main} {plural(main, ['упражнение', 'упражнения', 'упражнений'])}
          </h2>
          <ul className="ex-list">{items.slice(warmCount).map((it, i) => row(it, i + warmCount))}</ul>
        </section>
      )}
      <button type="button" className="btn" onClick={() => setPicking(true)}>
        {Icons.plus} Добавить упражнение
      </button>

      <div className="sticky-action">
        <button type="button" className="btn primary big" onClick={() => start(workoutFromProgram(program, new Date().toISOString()))}>
          Начать «{program.name}»
        </button>
      </div>

      {settings && (
        <ProgramDialog program={program} onClose={() => setSettings(false)} onDeleted={() => navigate('/training?tab=programs', true)} />
      )}
      {picking && (
        <ExercisePicker
          title="Добавить в программу"
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setPicking(false);
            setEditItem({ index: -1, item: defaultItem(ex) });
          }}
        />
      )}
      {editItem && (
        <ProgramItemDialog
          item={editItem.item}
          isNew={editItem.index < 0}
          canUp={editItem.index > 0}
          canDown={editItem.index >= 0 && editItem.index < items.length - 1}
          onClose={() => setEditItem(null)}
          onSave={(it) => {
            const next = [...items];
            if (editItem.index < 0) next.push(it);
            else next[editItem.index] = it;
            setEditItem(null);
            void saveItems(next);
          }}
          onDelete={() => {
            setEditItem(null);
            void saveItems(items.filter((_, i) => i !== editItem.index));
          }}
          onMove={(dir) => {
            const i = editItem.index;
            const j = i + dir;
            const next = [...items];
            [next[i], next[j]] = [next[j]!, next[i]!];
            setEditItem(null);
            void saveItems(next);
          }}
        />
      )}
    </div>
  );
}

/** Пункт по умолчанию для нового упражнения в программе. */
export function defaultItem(ex: CatalogExercise): ProgramItem {
  const base: ProgramItem = { exerciseId: ex.id, name: ex.name, metric: ex.metric, sets: 1 };
  switch (ex.metric) {
    case 'weight_reps':
    case 'reps':
      return { ...base, sets: 3, repsMin: 8, repsMax: 12, restSec: 90 };
    case 'time':
      return { ...base, sets: ex.group === 'warmup' ? 1 : 3, durationSec: ex.group === 'warmup' ? 600 : 60, restSec: ex.group === 'warmup' ? undefined : 60 };
    case 'distance_time':
      return { ...base, durationSec: 600 };
    case 'rounds':
      return { ...base, sets: 4, durationSec: 180, restSec: 60 };
    case 'check':
      return base;
  }
}

interface ItemProps {
  item: ProgramItem;
  isNew: boolean;
  canUp: boolean;
  canDown: boolean;
  onClose: () => void;
  onSave: (it: ProgramItem) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}

const clockField = (sec: number | undefined) => (sec === undefined ? '' : sec < 60 ? String(sec) : formatClock(sec));

function ProgramItemDialog({ item, isNew, canUp, canDown, onClose, onSave, onDelete, onMove }: ItemProps) {
  const metric: ExerciseMetric = item.metric ?? 'weight_reps';
  const [f, setF] = useState({
    sets: String(item.sets),
    repsMin: numberToField(item.repsMin),
    repsMax: numberToField(item.repsMax),
    weightKg: numberToField(item.weightKg),
    duration: clockField(item.durationSec),
    distanceKm: numberToField(item.distanceKm),
    rest: clockField(item.restSec),
    notes: item.notes ?? '',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const setsLabel = metric === 'rounds' ? 'Встреч' : metric === 'check' ? 'Раз' : 'Подходов';
  const usesReps = metric === 'weight_reps' || metric === 'reps';
  const usesDuration = metric === 'time' || metric === 'distance_time' || metric === 'rounds';

  function submit(e: FormEvent) {
    e.preventDefault();
    const sets = Number(f.sets);
    if (!Number.isInteger(sets) || sets < 1 || sets > 50) return setError(`${setsLabel}: целое число от 1 до 50`);
    const int = (v: string) => {
      const n = parseDecimal(v);
      return n === undefined ? undefined : Math.round(n);
    };
    const repsMin = int(f.repsMin);
    const repsMax = int(f.repsMax);
    if (repsMin !== undefined && repsMax !== undefined && repsMin > repsMax) return setError('Минимум повторений больше максимума');
    const durationSec = f.duration.trim() ? parseClock(f.duration) : undefined;
    if (f.duration.trim() && durationSec === undefined) return setError('Время: секунды или м:сс, например 3:00');
    const restSec = f.rest.trim() ? parseClock(f.rest) : undefined;
    if (f.rest.trim() && restSec === undefined) return setError('Отдых: секунды или м:сс, например 1:30');
    const weightKg = parseDecimal(f.weightKg);
    const distanceKm = parseDecimal(f.distanceKm);
    if ([weightKg, distanceKm, repsMin, repsMax].some((n) => n !== undefined && (Number.isNaN(n) || n < 0))) return setError('Числа не могут быть отрицательными');
    const next: ProgramItem = { exerciseId: item.exerciseId, name: item.name, metric, sets };
    if (usesReps && repsMin !== undefined) next.repsMin = repsMin;
    if (usesReps && repsMax !== undefined) next.repsMax = repsMax;
    if (metric === 'weight_reps' && weightKg !== undefined) next.weightKg = weightKg;
    if (usesDuration && durationSec !== undefined) next.durationSec = durationSec;
    if (metric === 'distance_time' && distanceKm !== undefined) next.distanceKm = distanceKm;
    if (metric !== 'check' && restSec !== undefined) next.restSec = restSec;
    if (f.notes.trim()) next.notes = f.notes.trim();
    onSave(next);
  }

  return (
    <Modal
      title={item.name}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button type="button" className="btn danger" onClick={onDelete}>
              Убрать
            </button>
          )}
          <button type="submit" form="item-form" className="btn primary">
            {isNew ? 'Добавить' : 'Сохранить'}
          </button>
        </>
      }
    >
      <form id="item-form" className="form" onSubmit={submit} noValidate>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <p className="small muted">Что записывать: {EXERCISE_METRIC_LABEL[metric]}</p>
        <div className="fields-2">
          <Field label={setsLabel}>{(p) => <input {...p} className="input" inputMode="numeric" value={f.sets} onChange={set('sets')} />}</Field>
          {metric === 'weight_reps' && (
            <Field label="Вес, кг" optional>
              {(p) => <input {...p} className="input" inputMode="decimal" value={f.weightKg} onChange={set('weightKg')} />}
            </Field>
          )}
          {metric === 'distance_time' && (
            <Field label="Расстояние, км" optional>
              {(p) => <input {...p} className="input" inputMode="decimal" value={f.distanceKm} onChange={set('distanceKm')} />}
            </Field>
          )}
        </div>
        {usesReps && (
          <div className="fields-2">
            <Field label="Повторений от" optional>
              {(p) => <input {...p} className="input" inputMode="numeric" value={f.repsMin} onChange={set('repsMin')} />}
            </Field>
            <Field label="до" optional>
              {(p) => <input {...p} className="input" inputMode="numeric" value={f.repsMax} onChange={set('repsMax')} />}
            </Field>
          </div>
        )}
        {metric !== 'check' && (
          <div className="fields-2">
            {usesDuration && (
              <Field label={metric === 'rounds' ? 'Длительность встречи' : 'Время'} optional hint="м:сс или секунды">
                {(p) => <input {...p} className="input" inputMode="numeric" value={f.duration} onChange={set('duration')} placeholder="3:00" />}
              </Field>
            )}
            <Field label="Отдых между" optional hint="м:сс или секунды">
              {(p) => <input {...p} className="input" inputMode="numeric" value={f.rest} onChange={set('rest')} placeholder="1:30" />}
            </Field>
          </div>
        )}
        <Field label="Заметка" optional>
          {(p) => <input {...p} className="input" value={f.notes} onChange={set('notes')} placeholder="Например: хват кимоно, с партнёром" />}
        </Field>
        {!isNew && (
          <div className="row">
            <button type="button" className="btn small" disabled={!canUp} onClick={() => onMove(-1)}>
              {Icons.arrowUp} Выше
            </button>
            <button type="button" className="btn small" disabled={!canDown} onClick={() => onMove(1)}>
              {Icons.arrowDown} Ниже
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
