// Вкладка «Тренировки» (v0.5): план недели, программы, каталог упражнений, журнал, замеры.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity, saveEntity } from '../../data/repo.ts';
import type { Workout, WorkoutFormat } from '../../domain/schemas.ts';
import {
  emptyWorkout,
  formatClock,
  programItemsFromWorkout,
  WORKOUT_FORMAT_LABEL,
  WORKOUT_TYPE_LABEL,
  weekdaysLabel,
  workoutFromProgram,
  workoutSetCount,
} from '../../domain/training.ts';
import { formatDateTime, formatDuration, plural } from '../../domain/time.ts';
import { EmptyState, Modal, Page, RowActions, Tabs } from '../../ui/components.tsx';
import { useConfirmDelete, useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { clearParam, href, navigate, type Route } from '../../ui/router.ts';
import { ProgramCover, ProgramGlyph, programMeta } from './catalog.tsx';
import { ExercisesTab } from './ExercisesTab.tsx';
import { MeasureTab } from './MeasureTab.tsx';
import { ProgramDialog } from './ProgramDialog.tsx';
import { draftOf, useActiveSession, useStartSession } from './useSession.ts';
import { WeekTab } from './WeekTab.tsx';

type Tab = 'week' | 'programs' | 'exercises' | 'journal' | 'measure';
const TABS: { value: Tab; label: string }[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'programs', label: 'Программы' },
  { value: 'exercises', label: 'Упражнения' },
  { value: 'journal', label: 'Журнал' },
  { value: 'measure', label: 'Замеры' },
];
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function TrainingPage({ route }: { route: Route }) {
  const raw = route.params.get('tab');
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : 'week';
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    if (route.params.get('add') === '1') {
      setStartOpen(true);
      clearParam(route, 'add');
    }
  }, [route]);

  return (
    <Page
      title="Тренировки"
      actions={
        <button type="button" className="btn primary" onClick={() => setStartOpen(true)}>
          {Icons.play} Начать
        </button>
      }
    >
      <ActiveBanner />
      <Tabs compact label="Разделы тренировок" value={tab} onChange={(t) => navigate(`/training?tab=${t}`, true)} options={TABS} />
      {tab === 'week' && <WeekTab onStartFree={() => setStartOpen(true)} />}
      {tab === 'programs' && <ProgramsTab />}
      {tab === 'exercises' && <ExercisesTab />}
      {tab === 'journal' && <JournalTab onAdd={() => setStartOpen(true)} />}
      {tab === 'measure' && <MeasureTab />}
      {startOpen && <StartDialog onClose={() => setStartOpen(false)} />}
    </Page>
  );
}

/** Плашка «Идёт тренировка» с таймером — вернуться можно с любого раздела. */
function ActiveBanner() {
  const s = useActiveSession();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!s || s.editing) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s]);
  if (!s) return null;
  return (
    <a className="active-banner" href={href('/training/session')}>
      <span className="pulse" aria-hidden="true" />
      <span className="grow">
        <b>{s.editing ? 'Правка тренировки' : 'Идёт тренировка'}</b>
        <span>{s.draft.title}</span>
      </span>
      {!s.editing && <span className="num">{formatClock((now - s.startedAtMs) / 1000)}</span>}
      {Icons.chevronRight}
    </a>
  );
}

/** «Начать»: по программе или без неё (по упражнениям, на ковре, день борьбы). */
export function StartDialog({ onClose, scheduleId }: { onClose: () => void; scheduleId?: string }) {
  const programs = useLiveQuery(() => db.programs.orderBy('name').toArray(), []);
  const start = useStartSession();
  const go = async (draft: ReturnType<typeof emptyWorkout>) => {
    onClose();
    await start(draft);
  };
  const now = new Date().toISOString();
  return (
    <Modal title="Начать тренировку" onClose={onClose} size="sheet">
      {programs && programs.length > 0 && (
        <div className="section">
          <h3 className="search-group">По программе</h3>
          <ul className="list">
            {programs.map((p) => (
              <li key={p.id}>
                <button type="button" className="list-item selectable" onClick={() => go(workoutFromProgram(p, now, scheduleId))}>
                  <span className={`program-badge color-${p.color}`}>
                    <ProgramGlyph program={p} size={22} />
                  </span>
                  <span className="grow">
                    <span className="title">{p.name}</span>
                    <span className="meta">{programMeta(p)}</span>
                  </span>
                  {Icons.chevronRight}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="section">
        <h3 className="search-group">Без программы</h3>
        {(['exercises', 'mat', 'fight'] as WorkoutFormat[]).map((f) => (
          <button key={f} type="button" className="add-wide" onClick={() => go(emptyWorkout(now, f))}>
            <span className="program-badge color-gray">
              <ProgramGlyph program={{ icon: 'auto', format: f, name: '' }} size={22} />
            </span>
            <span>
              {WORKOUT_FORMAT_LABEL[f]}
              <small>
                {f === 'exercises' && 'Зал, ОФП: упражнения добавляете по ходу'}
                {f === 'mat' && 'Разминка, техника, немного борьбы — запишите, над чем работали'}
                {f === 'fight' && 'Встречи в партере и в стойке, затем разбор'}
              </small>
            </span>
          </button>
        ))}
      </div>
      <p className="small muted">Прошедшую тренировку можно записать так же: дату и время укажете при сохранении.</p>
    </Modal>
  );
}

function ProgramsTab() {
  const programs = useLiveQuery(() => db.programs.orderBy('name').toArray(), []);
  const [creating, setCreating] = useState(false);
  if (programs === undefined) return <p className="muted">Загрузка…</p>;
  return (
    <div className="stack">
      <button type="button" className="btn" onClick={() => setCreating(true)}>
        {Icons.plus} Новая программа
      </button>
      {programs.length === 0 ? (
        <EmptyState>
          Программ пока нет. Создайте план под свой день: например «Ковёр — Пн, Ср, Пт», «Качалка — Вт, Чт» или
          «День борьбы». Программ может быть сколько угодно.
        </EmptyState>
      ) : (
        <ul className="program-grid">
          {programs.map((p) => (
            <li key={p.id}>
              <a className="program-card" href={href(`/training/program?id=${encodeURIComponent(p.id)}`)}>
                <ProgramCover program={p} />
                <span className="program-card-body">
                  <span className="program-card-title">{p.name}</span>
                  <span className="program-tags">
                    <span className="tag">{WORKOUT_FORMAT_LABEL[p.format]}</span>
                    {p.format !== 'exercises' && <span className="tag">{WORKOUT_TYPE_LABEL[p.type]}</span>}
                    {p.weekdays?.length ? <span className="tag">{weekdaysLabel(p.weekdays)}</span> : null}
                    <span className="tag">
                      {p.items.length} {plural(p.items.length, ['упражнение', 'упражнения', 'упражнений'])}
                    </span>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <ProgramDialog
          onClose={() => setCreating(false)}
          onSaved={(p) => navigate(`/training/program?id=${encodeURIComponent(p.id)}`)}
        />
      )}
    </div>
  );
}

function JournalTab({ onAdd }: { onAdd: () => void }) {
  const workouts = useLiveQuery(() => db.workouts.orderBy('startAt').reverse().toArray(), []);
  const programs = useLiveQuery(() => db.programs.toArray(), []);
  const confirmDelete = useConfirmDelete();
  const { notify } = useFeedback();
  const start = useStartSession();
  if (workouts === undefined) return <p className="muted">Загрузка…</p>;
  if (workouts.length === 0) {
    return (
      <EmptyState
        action={
          <button type="button" className="btn primary" onClick={onAdd}>
            Записать тренировку
          </button>
        }
      >
        Тренировок пока нет. Начните по программе или запишите занятие: зал, ковёр, день борьбы.
      </EmptyState>
    );
  }
  const programName = new Map((programs ?? []).map((p) => [p.id, p.name]));

  async function saveAsProgram(w: Workout) {
    const r = await saveEntity('programs', {
      name: w.title.slice(0, 100),
      type: w.type,
      format: w.format ?? 'exercises',
      icon: 'auto',
      color: 'blue',
      items: programItemsFromWorkout(w),
    });
    if (!r.ok) {
      notify(`Не удалось создать программу: ${Object.values(r.errors)[0] ?? ''}`, 'error');
      return;
    }
    notify('Программа создана — проверьте план упражнений');
    navigate(`/training/program?id=${encodeURIComponent(r.value.id)}`);
  }

  return (
    <ul className="list">
      {workouts.map((w) => {
        const sets = workoutSetCount(w);
        const prog = w.programId ? programName.get(w.programId) : undefined;
        return (
          <li key={w.id} className="list-item">
            <div className="grow">
              <div className="title">{w.title}</div>
              <div className="meta">
                {formatDateTime(w.startAt)} · {w.format ? WORKOUT_FORMAT_LABEL[w.format] : WORKOUT_TYPE_LABEL[w.type]}
                {w.format && w.format !== 'exercises' && ` · ${WORKOUT_TYPE_LABEL[w.type]}`}
                {w.durationMin !== undefined && ` · ${formatDuration(w.durationMin)}`}
                {w.rpe !== undefined && ` · тяжесть ${r1(w.rpe)}/10`}
              </div>
              {prog && prog !== w.title && <div className="meta">Программа: {prog}</div>}
              {w.focus && <div className="meta">Техника: {w.focus}</div>}
              {w.exercises.length > 0 && (
                <div className="meta">
                  {w.exercises.map((e) => e.name).join(', ')} — {sets} {plural(sets, ['подход', 'подхода', 'подходов'])}
                </div>
              )}
              {w.notes && <div className="meta">{w.notes}</div>}
              {w.exercises.length > 0 && !w.programId && (
                <button type="button" className="btn ghost small" onClick={() => saveAsProgram(w)}>
                  Сохранить как программу
                </button>
              )}
            </div>
            <RowActions
              label={w.title}
              onEdit={() => start(draftOf(w), w)}
              onDelete={() => confirmDelete(w.title, () => deleteEntity('workouts', w.id))}
            />
          </li>
        );
      })}
    </ul>
  );
}
