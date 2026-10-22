// Экран тренировки: обзор упражнений и экран упражнения (подходы с галочками, таймер отдыха,
// техника, история, замена, заметка, «Далее»). Черновик хранится в настройках и переживает перезагрузку.
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { clearActiveSession, finishSession, loadActiveSession, saveActiveSession, type ActiveSession } from '../../data/training.ts';
import type { CatalogExercise } from '../../domain/exerciseLibrary.ts';
import { emptyToUndefined, numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { WORKOUT_TYPES, type ExerciseMetric, type WorkoutExercise, type WorkoutSet, type WorkoutType } from '../../domain/schemas.ts';
import {
  cleanupWorkout,
  EXERCISE_GROUP_LABEL,
  exerciseHistory,
  formatClock,
  formatSet,
  isSetFilled,
  parseClock,
  setsFromPlan,
  WORKOUT_FORMAT_LABEL,
  WORKOUT_TYPE_LABEL,
} from '../../domain/training.ts';
import { formatDateTime, fromLocalInputValue, toLocalInputValue } from '../../domain/time.ts';
import { EXERCISE_IMAGE_CREDIT, EXERCISE_IMAGE_LICENSE_URL, exerciseImagePath } from '../../domain/exerciseImages.ts';
import { BodyFigure, ExercisePose } from '../../ui/BodyFigure.tsx';
import { EmptyState, Field, FormError, Modal, TopBar } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { href, navigate, type Route } from '../../ui/router.ts';
import { ExercisePicker, ExIcon, useCatalogMap } from './catalog.tsx';
import { TechniqueNotes } from './ExercisePage.tsx';
import { defaultItem } from './ProgramPage.tsx';

const DEFAULT_REST_SEC = 90;

export function SessionPage({ route }: { route: Route }) {
  const [s, setS] = useState<ActiveSession | null | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<ActiveSession | null>(null);
  // После «Сохранить» или «Отменить» черновик больше не записывается (иначе отложенное
  // автосохранение вернуло бы только что закрытую тренировку).
  const closed = useRef(false);

  useEffect(() => {
    let alive = true;
    void loadActiveSession().then((v) => alive && setS(v));
    return () => {
      alive = false;
    };
  }, []);

  // Сохраняем черновик с небольшой задержкой и сразу — при уходе со страницы.
  const update = useCallback((fn: (prev: ActiveSession) => ActiveSession) => {
    setS((prev) => {
      if (!prev || closed.current) return prev;
      const next = fn(prev);
      latest.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        if (!closed.current) void saveActiveSession(next);
      }, 300);
      return next;
    });
  }, []);
  /** true — тренировка закрывается (сохранение/отмена), false — сохранить не удалось, продолжаем. */
  const markClosed = useCallback((value = true) => {
    closed.current = value;
    if (value && saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);
  useEffect(
    () => () => {
      if (saveTimer.current && !closed.current) {
        clearTimeout(saveTimer.current);
        if (latest.current) void saveActiveSession(latest.current);
      }
    },
    [],
  );

  const rest = useRestTimer();

  if (s === undefined) return <p className="muted">Загрузка…</p>;
  if (s === null) {
    return (
      <div className="page">
        <TopBar title="Тренировка" backTo="/training" />
        <EmptyState action={<a className="btn primary" href={href('/training?add=1')}>Начать тренировку</a>}>Сейчас нет начатой тренировки.</EmptyState>
      </div>
    );
  }

  const exParam = route.params.get('ex');
  const index = exParam === null ? -1 : Number(exParam);
  const current = index >= 0 ? s.draft.exercises[index] : undefined;

  const setExercises = (fn: (list: WorkoutExercise[]) => WorkoutExercise[]) =>
    update((p) => ({ ...p, draft: { ...p.draft, exercises: fn(p.draft.exercises) } }));

  return (
    <>
      {current ? (
        <ExerciseView
          key={`${index}-${current.exerciseId}`}
          session={s}
          index={index}
          ex={current}
          setExercises={setExercises}
          rest={rest}
        />
      ) : (
        <Overview session={s} update={update} setExercises={setExercises} markClosed={markClosed} />
      )}
      <RestBar rest={rest} />
    </>
  );
}

// ---------- Таймер отдыха ----------

interface Rest {
  endAt: number | null;
  left: number;
  justEnded: boolean;
  start: (sec: number) => void;
  add: (sec: number) => void;
  stop: () => void;
}

function useRestTimer(): Rest {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [justEnded, setJustEnded] = useState(false);
  useEffect(() => {
    if (endAt === null) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endAt) {
        setEndAt(null);
        setJustEnded(true);
        navigator.vibrate?.([200, 100, 200]);
      }
    }, 250);
    return () => clearInterval(t);
  }, [endAt]);
  useEffect(() => {
    if (!justEnded) return;
    const t = setTimeout(() => setJustEnded(false), 4000);
    return () => clearTimeout(t);
  }, [justEnded]);
  return {
    endAt,
    left: endAt === null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000)),
    justEnded,
    start: (sec) => {
      setJustEnded(false);
      setNow(Date.now());
      setEndAt(Date.now() + sec * 1000);
    },
    add: (sec) => setEndAt((e) => (e === null ? e : e + sec * 1000)),
    stop: () => setEndAt(null),
  };
}

function RestBar({ rest }: { rest: Rest }) {
  if (rest.endAt === null && !rest.justEnded) return null;
  return (
    <div className={`rest-bar${rest.justEnded ? ' ended' : ''}`} role="status" aria-live="polite">
      {rest.justEnded ? (
        <b>Отдых окончен — следующий подход</b>
      ) : (
        <>
          <span>
            Отдых <b className="num">{formatClock(rest.left)}</b>
          </span>
          <button type="button" className="btn small" onClick={() => rest.add(15)}>
            +15 с
          </button>
          <button type="button" className="btn small" onClick={rest.stop}>
            Пропустить
          </button>
        </>
      )}
    </div>
  );
}

// ---------- Обзор ----------

function Overview({
  session,
  update,
  setExercises,
  markClosed,
}: {
  session: ActiveSession;
  update: (fn: (p: ActiveSession) => ActiveSession) => void;
  setExercises: (fn: (l: WorkoutExercise[]) => WorkoutExercise[]) => void;
  markClosed: (value?: boolean) => void;
}) {
  const map = useCatalogMap();
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const { confirm, notify } = useFeedback();
  const elapsed = useElapsed(session.editing ? null : session.startedAtMs);
  const d = session.draft;

  async function discard() {
    const ok = await confirm({
      title: session.editing ? 'Отменить правку?' : 'Отменить тренировку?',
      message: session.editing ? 'Изменения не сохранятся, запись в журнале останется прежней.' : 'Тренировка не будет записана в журнал.',
      confirmLabel: session.editing ? 'Отменить правку' : 'Не сохранять',
      danger: true,
    });
    if (!ok) return;
    markClosed();
    await clearActiveSession();
    notify(session.editing ? 'Правка отменена' : 'Тренировка отменена');
    navigate('/training', true);
  }

  return (
    <div className="page has-sticky">
      <TopBar title={d.title} backTo="/training" onBack={() => navigate('/training')} />
      <p className="muted center">
        {d.format ? WORKOUT_FORMAT_LABEL[d.format] : WORKOUT_TYPE_LABEL[d.type]}
        {d.format && d.format !== 'exercises' && ` · ${WORKOUT_TYPE_LABEL[d.type]}`}
        {session.editing ? ` · ${formatDateTime(d.startAt)}` : elapsed !== null && <> · идёт <span className="num">{formatClock(elapsed)}</span></>}
      </p>

      {d.format && d.format !== 'exercises' && (
        <Field label="Над чем работал" optional hint="Техника, связки, задачи от тренера">
          {(p) => (
            <textarea
              {...p}
              className="input"
              value={d.focus ?? ''}
              onChange={(e) => update((s) => ({ ...s, draft: { ...s.draft, focus: e.target.value || undefined } }))}
              placeholder="Например: подхват с захватом за пояс, переходы в партер"
            />
          )}
        </Field>
      )}

      {d.exercises.length === 0 ? (
        <EmptyState>Упражнений пока нет. Добавьте их по ходу тренировки — или просто завершите и запишите заметки.</EmptyState>
      ) : (
        <ul className="ex-list">
          {d.exercises.map((e, i) => {
            const done = e.sets.filter((x) => x.done).length;
            return (
              <li key={`${i}-${e.exerciseId}`}>
                <a className="ex-row" href={href(`/training/session?ex=${i}`)}>
                  <ExIcon ex={map.get(e.exerciseId)} />
                  <span className="grow">
                    <span className="title">{e.name}</span>
                    <span className="meta">
                      {e.metric === 'check'
                        ? done
                          ? 'сделано'
                          : 'не отмечено'
                        : `${done} из ${e.sets.length} ${e.metric === 'rounds' ? 'встреч' : 'подходов'} выполнено`}
                    </span>
                  </span>
                  {done === e.sets.length && e.sets.length > 0 ? <span className="done-mark">{Icons.check}</span> : Icons.chevronRight}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="btn" onClick={() => setPicking(true)}>
        {Icons.plus} Добавить упражнение
      </button>
      <button type="button" className="btn ghost danger" onClick={discard}>
        {session.editing ? 'Отменить правку' : 'Отменить тренировку'}
      </button>

      <div className="sticky-action">
        {d.exercises.length > 0 && !session.editing && (
          <a className="btn big" href={href(`/training/session?ex=${firstUnfinished(d.exercises)}`)}>
            {Icons.play} К упражнению
          </a>
        )}
        <button type="button" className="btn primary big" onClick={() => setFinishing(true)}>
          {session.editing ? 'Сохранить' : 'Завершить'}
        </button>
      </div>

      {picking && (
        <ExercisePicker
          title="Добавить упражнение"
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setPicking(false);
            setExercises((l) => [...l, exerciseFromCatalog(ex)]);
          }}
        />
      )}
      {finishing && <FinishDialog session={session} elapsedSec={elapsed} onClose={() => setFinishing(false)} markClosed={markClosed} />}
    </div>
  );
}

function firstUnfinished(list: readonly WorkoutExercise[]): number {
  const i = list.findIndex((e) => e.sets.some((s) => !s.done));
  return i === -1 ? 0 : i;
}

function exerciseFromCatalog(ex: CatalogExercise): WorkoutExercise {
  return { exerciseId: ex.id, name: ex.name, metric: ex.metric, sets: setsFromPlan(defaultItem(ex)) };
}

function useElapsed(startMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startMs === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startMs]);
  return startMs === null ? null : Math.max(0, (now - startMs) / 1000);
}

// ---------- Экран упражнения ----------

interface ExerciseViewProps {
  session: ActiveSession;
  index: number;
  ex: WorkoutExercise;
  setExercises: (fn: (l: WorkoutExercise[]) => WorkoutExercise[]) => void;
  rest: Rest;
}

function ExerciseView({ session, index, ex, setExercises, rest }: ExerciseViewProps) {
  const map = useCatalogMap();
  const cat = map.get(ex.exerciseId);
  const metric: ExerciseMetric = ex.metric ?? 'weight_reps';
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  const history = workouts ? exerciseHistory(workouts, ex.exerciseId, session.editing?.id) : [];
  const prev = history[0];
  const [modal, setModal] = useState<'technique' | 'history' | 'replace' | null>(null);
  const { confirm } = useFeedback();
  const list = session.draft.exercises;
  const next = list[index + 1];

  const patch = (fn: (e: WorkoutExercise) => WorkoutExercise) => setExercises((l) => l.map((x, i) => (i === index ? fn(x) : x)));
  const patchSet = (si: number, p: Partial<WorkoutSet>) =>
    patch((e) => ({ ...e, sets: e.sets.map((x, i) => (i === si ? dropUndefined({ ...x, ...p }) : x)) }));

  function toggleDone(si: number) {
    const set = ex.sets[si]!;
    const done = !set.done;
    // Если поля пустые, а в прошлый раз были значения — считаем, что сделано «как в прошлый раз».
    const fill: Partial<WorkoutSet> = {};
    const p = prev?.sets[si] ?? prev?.sets[prev.sets.length - 1];
    if (done && p && !isSetFilled({ ...set, done: false })) {
      if (p.reps !== undefined) fill.reps = p.reps;
      if (p.weightKg !== undefined && metric === 'weight_reps') fill.weightKg = p.weightKg;
      if (p.durationSec !== undefined) fill.durationSec = p.durationSec;
      if (p.distanceKm !== undefined) fill.distanceKm = p.distanceKm;
    }
    patchSet(si, { ...fill, done });
    const isLast = si === ex.sets.length - 1;
    if (done && metric !== 'check' && !isLast) rest.start(set.restSec ?? (metric === 'rounds' ? 60 : DEFAULT_REST_SEC));
  }

  async function removeExercise() {
    const ok = await confirm({ title: 'Убрать упражнение?', message: `«${ex.name}» будет убрано из этой тренировки.`, confirmLabel: 'Убрать', danger: true });
    if (!ok) return;
    setExercises((l) => l.filter((_, i) => i !== index));
    navigate('/training/session', true);
  }

  function replace(c: CatalogExercise) {
    setModal(null);
    const fresh = exerciseFromCatalog(c);
    patch(() => ({ ...fresh, sets: ex.sets.map((s, i) => ({ ...(fresh.sets[i] ?? fresh.sets[0] ?? {}), restSec: s.restSec })) }));
    navigate(`/training/session?ex=${index}`, true);
  }

  return (
    <div className="page has-bottombar">
      <TopBar
        title={`${index + 1} из ${list.length}`}
        onBack={() => navigate('/training/session', true)}
        action={
          <button
            type="button"
            className={`round-btn${rest.endAt !== null ? ' on' : ''}`}
            aria-label={rest.endAt !== null ? 'Остановить таймер отдыха' : 'Запустить таймер отдыха'}
            onClick={() => (rest.endAt !== null ? rest.stop() : rest.start(ex.sets[0]?.restSec ?? DEFAULT_REST_SEC))}
          >
            {Icons.timer}
          </button>
        }
      />
      <div className="ex-hero compact">
        <ExIcon ex={cat} size="lg" />
        <h1 className="ex-title">{ex.name}</h1>
        <p className="muted">{cat ? EXERCISE_GROUP_LABEL[cat.group].toLowerCase() : ''}</p>
      </div>
      <div className="action-tiles">
        <button type="button" className="action-tile" onClick={() => setModal('technique')}>
          {Icons.play}
          <span>Техника</span>
        </button>
        <button type="button" className="action-tile" onClick={() => setModal('history')}>
          {Icons.history}
          <span>История</span>
        </button>
        <button type="button" className="action-tile" onClick={() => setModal('replace')}>
          {Icons.swap}
          <span>Заменить</span>
        </button>
      </div>

      <SetHeader metric={metric} />
      <ul className="set-rows">
        {ex.sets.map((set, si) => (
          <SetRow
            key={si}
            n={si + 1}
            metric={metric}
            set={set}
            prev={prev?.sets[si]}
            onChange={(p) => patchSet(si, p)}
            onToggle={() => toggleDone(si)}
          />
        ))}
      </ul>
      <div className="row">
        <button
          type="button"
          className="btn small"
          onClick={() => patch((e) => ({ ...e, sets: [...e.sets, e.sets.length ? { ...e.sets[e.sets.length - 1]!, done: undefined, notes: undefined } : {}] }))}
        >
          {Icons.plus} {metric === 'rounds' ? 'Встреча' : 'Подход'}
        </button>
        {ex.sets.length > 1 && (
          <button type="button" className="btn small ghost" onClick={() => patch((e) => ({ ...e, sets: e.sets.slice(0, -1) }))}>
            Убрать последний
          </button>
        )}
      </div>
      {prev && (
        <p className="small muted">
          В прошлый раз ({formatDateTime(prev.startAt)}): {prev.sets.map((x) => formatSet(x, prev.metric)).join(', ')}
        </p>
      )}

      <textarea
        className="input note-input"
        aria-label="Заметка к упражнению"
        placeholder="Оставить заметку…"
        value={ex.notes ?? ''}
        onChange={(e) => patch((x) => ({ ...x, notes: e.target.value || undefined }))}
      />

      <div className="bottombar">
        <button type="button" className="round-btn" aria-label="Убрать упражнение из тренировки" onClick={removeExercise}>
          {Icons.trash}
        </button>
        {next ? (
          <button type="button" className="next-card" onClick={() => navigate(`/training/session?ex=${index + 1}`, true)}>
            <ExIcon ex={map.get(next.exerciseId)} size="sm" />
            <span className="grow">
              <span className="title">{next.name}</span>
              <span className="meta">Далее</span>
            </span>
            {Icons.next}
          </button>
        ) : (
          <button type="button" className="next-card finish" onClick={() => navigate('/training/session', true)}>
            <span className="grow">
              <span className="title">Все упражнения</span>
              <span className="meta">К обзору и завершению</span>
            </span>
            {Icons.check}
          </button>
        )}
      </div>

      {modal === 'technique' && (
        <Modal title={ex.name} onClose={() => setModal(null)}>
          {exerciseImagePath(ex.exerciseId) && (
            <ExercisePose src={exerciseImagePath(ex.exerciseId)!} credit={EXERCISE_IMAGE_CREDIT} licenseUrl={EXERCISE_IMAGE_LICENSE_URL} />
          )}
          {cat && <BodyFigure primary={cat.muscles} secondary={cat.musclesSecondary} view="both" className="ex-hero-figure" />}
          <TechniqueNotes exerciseId={ex.exerciseId} />
          <p className="small muted">Видео техники появится в следующих версиях.</p>
        </Modal>
      )}
      {modal === 'history' && (
        <Modal title={`История: ${ex.name}`} onClose={() => setModal(null)}>
          {history.length === 0 ? (
            <p className="muted">Раньше это упражнение не записывалось.</p>
          ) : (
            <ul className="list">
              {history.slice(0, 30).map((h) => (
                <li key={h.workoutId} className="list-item">
                  <div className="grow">
                    <div className="title">{formatDateTime(h.startAt)}</div>
                    <div className="meta">{h.sets.map((x) => formatSet(x, h.metric)).join(', ')}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
      {modal === 'replace' && <ExercisePicker title="Заменить упражнение" onClose={() => setModal(null)} onPick={replace} />}
    </div>
  );
}

function dropUndefined(s: WorkoutSet): WorkoutSet {
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as WorkoutSet;
}

function SetHeader({ metric }: { metric: ExerciseMetric }) {
  const cols: Record<ExerciseMetric, string[]> = {
    weight_reps: ['Вес, кг', 'Повторения'],
    reps: ['Повторения'],
    time: ['Время'],
    distance_time: ['Расстояние, км', 'Время'],
    rounds: ['Длительность встречи'],
    check: ['Выполнено'],
  };
  return (
    <div className={`set-head cols-${cols[metric].length}`} aria-hidden="true">
      <span />
      {cols[metric].map((c) => (
        <span key={c}>{c}</span>
      ))}
      <span />
    </div>
  );
}

interface SetRowProps {
  n: number;
  metric: ExerciseMetric;
  set: WorkoutSet;
  prev?: WorkoutSet;
  onChange: (p: Partial<WorkoutSet>) => void;
  onToggle: () => void;
}

function SetRow({ n, metric, set, prev, onChange, onToggle }: SetRowProps) {
  const label = metric === 'rounds' ? `встреча ${n}` : `подход ${n}`;
  return (
    <li className={`set-row${set.done ? ' done' : ''} cols-${metric === 'weight_reps' || metric === 'distance_time' ? 2 : 1}`}>
      <span className="set-n">{n}</span>
      {metric === 'weight_reps' && <NumInput label={`Вес, кг, ${label}`} unit="кг" value={set.weightKg} placeholder={prev?.weightKg} decimal onChange={(v) => onChange({ weightKg: v })} />}
      {metric === 'distance_time' && <NumInput label={`Расстояние, ${label}`} unit="км" value={set.distanceKm} placeholder={prev?.distanceKm} decimal onChange={(v) => onChange({ distanceKm: v })} />}
      {(metric === 'weight_reps' || metric === 'reps') && <NumInput label={`Повторения, ${label}`} unit="повт" value={set.reps} placeholder={prev?.reps} onChange={(v) => onChange({ reps: v })} />}
      {(metric === 'time' || metric === 'distance_time' || metric === 'rounds') && (
        <ClockInput label={`Время, ${label}`} value={set.durationSec} placeholder={prev?.durationSec} onChange={(v) => onChange({ durationSec: v })} />
      )}
      {metric === 'check' && <span className="set-check-label">{set.done ? 'Сделано' : 'Отметьте, когда выполните'}</span>}
      <button type="button" className={`round-btn check${set.done ? ' on' : ''}`} aria-pressed={!!set.done} aria-label={`Отметить ${label} выполненным`} onClick={onToggle}>
        {Icons.check}
      </button>
    </li>
  );
}

function NumInput({ label, unit, value, placeholder, decimal, onChange }: { label: string; unit: string; value?: number; placeholder?: number; decimal?: boolean; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(numberToField(value));
  useEffect(() => {
    // Значение изменилось снаружи (например, «как в прошлый раз») — показать его.
    if (parseDecimal(text) !== value) setText(numberToField(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <label className="pill-input">
      <input
        aria-label={label}
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={text}
        placeholder={placeholder !== undefined ? numberToField(placeholder) : '0'}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseDecimal(e.target.value);
          if (v === undefined || (Number.isFinite(v) && v >= 0)) onChange(v === undefined ? undefined : decimal ? v : Math.round(v));
        }}
      />
      <span>{unit}</span>
    </label>
  );
}

function ClockInput({ label, value, placeholder, onChange }: { label: string; value?: number; placeholder?: number; onChange: (v: number | undefined) => void }) {
  const show = (v: number | undefined) => (v === undefined ? '' : formatClock(v));
  const [text, setText] = useState(show(value));
  useEffect(() => {
    if (parseClock(text) !== value) setText(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <label className="pill-input">
      <input
        aria-label={label}
        inputMode="numeric"
        value={text}
        placeholder={placeholder !== undefined ? formatClock(placeholder) : 'м:сс'}
        onChange={(e) => {
          setText(e.target.value);
          if (!e.target.value.trim()) onChange(undefined);
          else {
            const v = parseClock(e.target.value);
            if (v !== undefined) onChange(v);
          }
        }}
      />
      <span>мин</span>
    </label>
  );
}

// ---------- Завершение ----------

function FinishDialog({
  session,
  elapsedSec,
  onClose,
  markClosed,
}: {
  session: ActiveSession;
  elapsedSec: number | null;
  onClose: () => void;
  markClosed: (value?: boolean) => void;
}) {
  const d = session.draft;
  const { notify } = useFeedback();
  const [f, setF] = useState({
    title: d.title,
    startAt: toLocalInputValue(d.startAt),
    type: d.type,
    durationMin: numberToField(d.durationMin ?? (elapsedSec !== null && elapsedSec >= 60 ? Math.round(elapsedSec / 60) : undefined)),
    rpe: numberToField(d.rpe),
    focus: d.focus ?? '',
    notes: d.notes ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const [withUnchecked, setWithUnchecked] = useState(false);
  const cleaned = cleanupWorkout(d, !withUnchecked);
  const countSets = (w: { exercises: WorkoutExercise[] }) => w.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = countSets(cleanupWorkout(d, true));
  const filledUnchecked = countSets(cleanupWorkout(d)) - doneSets;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const startAt = fromLocalInputValue(f.startAt);
    if (!startAt) {
      setErrors({ startAt: 'Укажите дату и время' });
      return;
    }
    setSaving(true);
    markClosed();
    try {
      const r = await finishSession(session, {
        ...cleaned,
        title: f.title,
        startAt,
        type: f.type,
        durationMin: parseDecimal(f.durationMin),
        rpe: parseDecimal(f.rpe),
        focus: emptyToUndefined(f.focus),
        notes: emptyToUndefined(f.notes),
      });
      if (!r.ok) {
        markClosed(false);
        setErrors(r.errors);
        return;
      }
      notify(session.editing ? 'Тренировка обновлена' : 'Тренировка записана в журнал');
      navigate('/training?tab=journal', true);
    } catch (err) {
      markClosed(false);
      notify(`Не удалось сохранить: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={session.editing ? 'Сохранить изменения' : 'Завершить тренировку'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Продолжить
          </button>
          <button type="submit" form="finish-form" className="btn primary" disabled={saving}>
            Сохранить
          </button>
        </>
      }
    >
      <form id="finish-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <Field label="Название" error={errors.title}>
          {(p) => <input {...p} className="input" value={f.title} onChange={set('title')} />}
        </Field>
        <div className="fields-2">
          <Field label="Начало (МСК)" error={errors.startAt}>
            {(p) => <input {...p} className="input" type="datetime-local" value={f.startAt} onChange={set('startAt')} />}
          </Field>
          <Field label="Вид спорта / место">
            {(p) => (
              <select {...p} className="input" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value as WorkoutType }))}>
                {WORKOUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORKOUT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="fields-2">
          <Field label="Длительность, мин" optional error={errors.durationMin}>
            {(p) => <input {...p} className="input" inputMode="numeric" value={f.durationMin} onChange={set('durationMin')} />}
          </Field>
          <Field label="Тяжесть, 1–10" optional error={errors.rpe}>
            {(p) => <input {...p} className="input" inputMode="decimal" value={f.rpe} onChange={set('rpe')} />}
          </Field>
        </div>
        <Field label="Над чем работал" optional error={errors.focus}>
          {(p) => <input {...p} className="input" value={f.focus} onChange={set('focus')} placeholder="Техника, связки" />}
        </Field>
        <Field label="Разбор, дневник" optional error={errors.notes}>
          {(p) => <textarea {...p} className="input" value={f.notes} onChange={set('notes')} placeholder="Что получилось, что нет, самочувствие, нюансы схваток" />}
        </Field>
        <p className="small muted">
          Сохранятся подходы, отмеченные галочкой: {doneSets}. Упражнений в записи: {cleaned.exercises.length}.
        </p>
        {filledUnchecked > 0 && (
          <label className="check-line">
            <input type="checkbox" checked={withUnchecked} onChange={(e) => setWithUnchecked(e.target.checked)} />
            <span>Сохранить и неотмеченные подходы со значениями ({filledUnchecked}) — если забыли поставить галочки</span>
          </label>
        )}
      </form>
    </Modal>
  );
}
