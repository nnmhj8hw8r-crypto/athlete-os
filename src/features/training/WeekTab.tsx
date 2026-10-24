// План недели: на каждый день — программы на утро, день и вечер; отметка выполнения по журналу.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity, saveEntity } from '../../data/repo.ts';
import { copyWeekPlan } from '../../data/training.ts';
import { SCHEDULE_SLOTS, type Program, type ScheduleEntry, type ScheduleSlot } from '../../domain/schemas.ts';
import { SCHEDULE_SLOT_LABEL, WEEKDAY_SHORT, workoutFromProgram } from '../../domain/training.ts';
import { addDays, formatDateKey, fromLocalInputValue, toDateKey, todayKey, weekStart } from '../../domain/time.ts';
import { EmptyState, Field, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { href } from '../../ui/router.ts';
import { ProgramGlyph, programMeta } from './catalog.tsx';
import { useStartSession } from './useSession.ts';

const WEEKDAY_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

/** Время начала по умолчанию для слота дня (по Москве). */
const SLOT_TIME: Record<ScheduleSlot, string> = { morning: '09:00', day: '13:00', evening: '18:00' };
const SLOT_HINT: Record<ScheduleSlot, string> = { morning: 'до 12:00', day: '12:00–17:00', evening: 'после 17:00' };

/** Значки времени суток (v0.9.4): восход, солнце, луна — линиями в стиле остальных иконок. */
const SLOT_ICON: Record<ScheduleSlot, ReactNode> = {
  morning: (
    <svg viewBox="0 0 24 24">
      <path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 6v3M5.6 10.6l1.8 1.4M18.4 10.6l-1.8 1.4" />
    </svg>
  ),
  day: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </svg>
  ),
  evening: (
    <svg viewBox="0 0 24 24">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  ),
};

export function WeekTab({ onStartFree }: { onStartFree: () => void }) {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState<ScheduleSlot | null>(null);
  const { notify, confirm } = useFeedback();
  const start = useStartSession();

  const monday = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const fromIso = fromLocalInputValue(`${monday}T00:00`) ?? '';
  const toIso = fromLocalInputValue(`${addDays(monday, 7)}T00:00`) ?? '';
  const schedule = useLiveQuery(() => db.schedule.where('date').between(monday, days[6]!, true, true).toArray(), [monday]);
  const workouts = useLiveQuery(() => db.workouts.where('startAt').between(fromIso, toIso, true, false).toArray(), [fromIso, toIso]);
  const programs = useLiveQuery(() => db.programs.toArray(), []);

  if (schedule === undefined || workouts === undefined || programs === undefined) return <p className="muted">Загрузка…</p>;
  const programById = new Map(programs.map((p) => [p.id, p]));
  const doneBySchedule = new Map(workouts.filter((w) => w.scheduleId).map((w) => [w.scheduleId!, w]));
  const dayEntries = schedule.filter((e) => e.date === date);
  const dayWorkouts = workouts.filter((w) => toDateKey(w.startAt) === date && !(w.scheduleId && schedule.some((s) => s.id === w.scheduleId)));
  const weekday = (days.indexOf(date) + 7) % 7;

  async function startEntry(e: ScheduleEntry, p: Program) {
    const startAt = date === today ? new Date().toISOString() : (fromLocalInputValue(`${date}T${SLOT_TIME[e.slot]}`) ?? new Date().toISOString());
    await start(workoutFromProgram(p, startAt, e.id));
  }

  async function copyPrev() {
    const prev = addDays(monday, -7);
    const n = await copyWeekPlan(prev, monday);
    notify(n ? `Перенесено из прошлой недели: ${n}` : 'На прошлой неделе нечего переносить (или всё уже есть)');
  }

  async function remove(e: ScheduleEntry, name: string) {
    const ok = await confirm({ title: 'Убрать из плана?', message: `«${name}» исчезнет из плана этого дня. Сама программа и журнал не изменятся.`, confirmLabel: 'Убрать' });
    if (ok) await deleteEntity('schedule', e.id);
  }

  return (
    <div className="stack">
      <div className="week-head">
        <button type="button" className="icon-btn" aria-label="Предыдущая неделя" onClick={() => setDate(addDays(date, -7))}>
          {Icons.chevronLeft}
        </button>
        <span className="week-range">{weekRange(days)}</span>
        <button type="button" className="icon-btn" aria-label="Следующая неделя" onClick={() => setDate(addDays(date, 7))}>
          {Icons.chevronRight}
        </button>
      </div>
      <div className="week-days week-days-min">
        {days.map((d, i) => {
          const planned = schedule.filter((e) => e.date === d);
          const done = planned.filter((e) => doneBySchedule.has(e.id)).length + workouts.filter((w) => toDateKey(w.startAt) === d && !w.scheduleId).length;
          const state = done && done >= planned.length ? 'wd-done' : planned.length ? (done ? 'wd-partial' : 'wd-planned') : 'wd-empty';
          return (
            <button
              key={d}
              type="button"
              className={`week-day plan-day${d === date ? ' selected' : ''}${d === today ? ' today' : ''}`}
              onClick={() => setDate(d)}
              aria-label={`${WEEKDAY_FULL[i]}, ${formatDateKey(d)}${planned.length ? `, в плане: ${planned.length}` : ''}`}
            >
              <span className="wd-name">{WEEKDAY_SHORT[i]}</span>
              <span className={`wd-circle ${state}`}>{Number(d.slice(8))}</span>
              {/* Точки — утро, день, вечер; только там, где что-то запланировано. */}
              <span className="wd-slots" aria-hidden="true">
                {SCHEDULE_SLOTS.map((slot) => {
                  const inSlot = planned.filter((e) => e.slot === slot);
                  const cls = inSlot.length === 0 ? '' : inSlot.every((e) => doneBySchedule.has(e.id)) ? ' done' : ' planned';
                  return <i key={slot} className={cls} />;
                })}
              </span>
            </button>
          );
        })}
      </div>

      <div className="row-between">
        <h2>
          {WEEKDAY_FULL[weekday]}, {formatDateKey(date).replace(/^[^,]+,\s*/, '')}
        </h2>
        {date !== today && (
          <button type="button" className="btn ghost small" onClick={() => setDate(today)}>
            Сегодня
          </button>
        )}
      </div>

      {SCHEDULE_SLOTS.map((slot) => {
        const entries = dayEntries.filter((e) => e.slot === slot);
        return (
          <section key={slot} className={`slot slot-${slot}`}>
            <div className="slot-head">
              <h3>
                <span className="slot-icon" aria-hidden="true">
                  {SLOT_ICON[slot]}
                </span>
                {SCHEDULE_SLOT_LABEL[slot]}
                <small>{SLOT_HINT[slot]}</small>
              </h3>
              <button type="button" className="btn ghost small" onClick={() => setAdding(slot)}>
                {Icons.plus} В план
              </button>
            </div>
            {entries.length === 0 ? (
              <p className="small muted">Ничего не запланировано</p>
            ) : (
              <ul className="list">
                {entries.map((e) => {
                  const p = programById.get(e.programId);
                  const done = doneBySchedule.get(e.id);
                  return (
                    <li key={e.id} className="list-item plan-entry">
                      <span className={`program-badge color-${p?.color ?? 'gray'}`}>{p ? <ProgramGlyph program={p} size={22} /> : '?'}</span>
                      <a className="grow plan-entry-link" href={p ? href(`/training/program?id=${encodeURIComponent(p.id)}`) : undefined}>
                        <span className="title">{p?.name ?? 'Программа удалена'}</span>
                        <span className="meta">{p ? programMeta(p) : 'Уберите запись из плана'}</span>
                      </a>
                      {done ? (
                        <span className="badge ok">Выполнено</span>
                      ) : (
                        p && (
                          <button type="button" className="btn small primary" onClick={() => startEntry(e, p)}>
                            Начать
                          </button>
                        )
                      )}
                      <button type="button" className="icon-btn" aria-label={`Убрать из плана: ${p?.name ?? ''}`} onClick={() => remove(e, p?.name ?? 'запись')}>
                        {Icons.close}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {dayWorkouts.length > 0 && (
        <section className="section">
          <h3>Записано в этот день</h3>
          <ul className="list">
            {dayWorkouts.map((w) => (
              <li key={w.id} className="list-item">
                <div className="grow">
                  <div className="title">{w.title}</div>
                  <div className="meta">{w.exercises.length ? w.exercises.map((x) => x.name).join(', ') : (w.focus ?? w.notes ?? '')}</div>
                </div>
                <span className="badge ok">Выполнено</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {programs.length === 0 && (
        <EmptyState action={<a className="btn" href={href('/training?tab=programs')}>К программам</a>}>
          Чтобы планировать неделю, сначала создайте программы во вкладке «Программы».
        </EmptyState>
      )}

      <div className="row">
        <button type="button" className="btn" onClick={onStartFree}>
          {Icons.play} Тренировка без плана
        </button>
        <button type="button" className="btn ghost" onClick={copyPrev}>
          {Icons.copy} Скопировать прошлую неделю
        </button>
      </div>

      {adding && <AddToPlanDialog date={date} slot={adding} programs={programs} onClose={() => setAdding(null)} />}
    </div>
  );
}

function AddToPlanDialog({ date, slot: initialSlot, programs, onClose }: { date: string; slot: ScheduleSlot; programs: Program[]; onClose: () => void }) {
  const [slot, setSlot] = useState<ScheduleSlot>(initialSlot);
  const { notify } = useFeedback();
  const sorted = [...programs].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  async function add(p: Program) {
    const r = await saveEntity('schedule', { date, slot, programId: p.id });
    if (!r.ok) {
      notify('Не удалось добавить в план', 'error');
      return;
    }
    notify(`«${p.name}» — ${SCHEDULE_SLOT_LABEL[slot].toLowerCase()}, ${formatDateKey(date)}`);
    onClose();
  }

  return (
    <Modal title={`В план на ${formatDateKey(date)}`} onClose={onClose} size="sheet">
      <Field label="Время суток">
        {(p) => (
          <select {...p} className="input" value={slot} onChange={(e) => setSlot(e.target.value as ScheduleSlot)}>
            {SCHEDULE_SLOTS.map((s) => (
              <option key={s} value={s}>
                {SCHEDULE_SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </Field>
      {sorted.length === 0 ? (
        <EmptyState action={<a className="btn" href={href('/training?tab=programs')} onClick={onClose}>Создать программу</a>}>
          Программ пока нет.
        </EmptyState>
      ) : (
        <ul className="list">
          {sorted.map((p) => (
            <li key={p.id}>
              <button type="button" className="list-item selectable" onClick={() => add(p)}>
                <span className={`program-badge color-${p.color}`}>
                  <ProgramGlyph program={p} size={22} />
                </span>
                <span className="grow">
                  <span className="title">{p.name}</span>
                  <span className="meta">{programMeta(p)}</span>
                </span>
                {Icons.plus}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «19–25 октября» или «28 октября – 3 ноября». */
function weekRange(days: readonly string[]): string {
  const a = days[0]!;
  const b = days[days.length - 1]!;
  const [ma, mb] = [Number(a.slice(5, 7)) - 1, Number(b.slice(5, 7)) - 1];
  return ma === mb ? `${Number(a.slice(8))}–${Number(b.slice(8))} ${MONTHS_GEN[mb]}` : `${Number(a.slice(8))} ${MONTHS_GEN[ma]} – ${Number(b.slice(8))} ${MONTHS_GEN[mb]}`;
}
