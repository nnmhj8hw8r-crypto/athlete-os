import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity } from '../../data/repo.ts';
import type { Workout, WorkoutTemplate } from '../../domain/schemas.ts';
import { exerciseProgress, templateFromWorkout, WORKOUT_TYPE_LABEL, workoutDraftFromTemplate, workoutSetCount } from '../../domain/training.ts';
import { formatDateKey, formatDateTime, formatDuration, plural, toDateKey } from '../../domain/time.ts';
import { EmptyState, Field, Page, RowActions, Tabs } from '../../ui/components.tsx';
import { useConfirmDelete } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { LineChart } from '../../ui/LineChart.tsx';
import { clearParam, type Route } from '../../ui/router.ts';
import { TemplateDialog } from './TemplateDialog.tsx';
import { WorkoutDialog, type WorkoutDraft } from './WorkoutDialog.tsx';

type Tab = 'history' | 'templates' | 'progress';
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function TrainingPage({ route }: { route: Route }) {
  const [tab, setTab] = useState<Tab>('history');
  const [workoutDlg, setWorkoutDlg] = useState<{ workout?: Workout; draft?: WorkoutDraft } | null>(null);
  const [tplDlg, setTplDlg] = useState<{ template?: WorkoutTemplate; draft?: ReturnType<typeof templateFromWorkout> } | null>(null);

  useEffect(() => {
    if (route.params.get('add') === '1') {
      setWorkoutDlg({});
      clearParam(route, 'add');
    }
  }, [route]);

  return (
    <Page
      title="Тренировки"
      actions={
        <button type="button" className="btn primary" onClick={() => setWorkoutDlg({})}>
          {Icons.plus} Тренировка
        </button>
      }
    >
      <Tabs
        label="Разделы тренировок"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'history', label: 'История' },
          { value: 'templates', label: 'Шаблоны' },
          { value: 'progress', label: 'Прогресс' },
        ]}
      />
      {tab === 'history' && (
        <History onEdit={(w) => setWorkoutDlg({ workout: w })} onMakeTemplate={(w) => setTplDlg({ draft: templateFromWorkout(w, w.title) })} onAdd={() => setWorkoutDlg({})} />
      )}
      {tab === 'templates' && (
        <Templates
          onStart={(t) => setWorkoutDlg({ draft: workoutDraftFromTemplate(t) })}
          onEdit={(t) => setTplDlg({ template: t })}
          onAdd={() => setTplDlg({})}
        />
      )}
      {tab === 'progress' && <Progress />}

      {workoutDlg && <WorkoutDialog workout={workoutDlg.workout} draft={workoutDlg.draft} onClose={() => setWorkoutDlg(null)} />}
      {tplDlg && <TemplateDialog template={tplDlg.template} draft={tplDlg.draft} onClose={() => setTplDlg(null)} />}
    </Page>
  );
}

function History({ onEdit, onMakeTemplate, onAdd }: { onEdit: (w: Workout) => void; onMakeTemplate: (w: Workout) => void; onAdd: () => void }) {
  const workouts = useLiveQuery(() => db.workouts.orderBy('startAt').reverse().toArray(), []);
  const confirmDelete = useConfirmDelete();
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
        Тренировок пока нет. Запишите первое занятие: дзюдо, самбо, зал или другое.
      </EmptyState>
    );
  }
  return (
    <ul className="list">
      {workouts.map((w) => {
        const sets = workoutSetCount(w);
        return (
          <li key={w.id} className="list-item">
            <div className="grow">
              <div className="title">{w.title}</div>
              <div className="meta">
                {formatDateTime(w.startAt)} · {WORKOUT_TYPE_LABEL[w.type]}
                {w.durationMin !== undefined && ` · ${formatDuration(w.durationMin)}`}
                {w.rpe !== undefined && ` · тяжесть ${r1(w.rpe)}/10`}
              </div>
              {w.exercises.length > 0 && (
                <div className="meta">
                  {w.exercises.map((e) => e.name).join(', ')} — {sets} {plural(sets, ['подход', 'подхода', 'подходов'])}
                </div>
              )}
              {w.notes && <div className="meta">{w.notes}</div>}
              {w.exercises.length > 0 && (
                <button type="button" className="btn ghost small" onClick={() => onMakeTemplate(w)}>
                  Сохранить как шаблон
                </button>
              )}
            </div>
            <RowActions label={w.title} onEdit={() => onEdit(w)} onDelete={() => confirmDelete(w.title, () => deleteEntity('workouts', w.id))} />
          </li>
        );
      })}
    </ul>
  );
}

function Templates({ onStart, onEdit, onAdd }: { onStart: (t: WorkoutTemplate) => void; onEdit: (t: WorkoutTemplate) => void; onAdd: () => void }) {
  const templates = useLiveQuery(() => db.workoutTemplates.orderBy('name').toArray(), []);
  const confirmDelete = useConfirmDelete();
  if (templates === undefined) return <p className="muted">Загрузка…</p>;
  return (
    <div className="stack">
      <button type="button" className="btn" onClick={onAdd}>
        + Новый шаблон
      </button>
      {templates.length === 0 ? (
        <EmptyState>Шаблонов нет. Создайте шаблон вручную или сохраните его из записанной тренировки.</EmptyState>
      ) : (
        <ul className="list">
          {templates.map((t) => (
            <li key={t.id} className="list-item">
              <div className="grow">
                <div className="title">{t.name}</div>
                <div className="meta">
                  {WORKOUT_TYPE_LABEL[t.type]}
                  {t.exercises.length > 0 && ` · ${t.exercises.map((e) => `${e.name}${e.plannedSets ? ` ×${e.plannedSets}` : ''}`).join(', ')}`}
                </div>
                <button type="button" className="btn small primary" onClick={() => onStart(t)}>
                  Начать по шаблону
                </button>
              </div>
              <RowActions label={t.name} onEdit={() => onEdit(t)} onDelete={() => confirmDelete(t.name, () => deleteEntity('workoutTemplates', t.id))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Progress() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  const [selected, setSelected] = useState('');
  if (exercises === undefined || workouts === undefined) return <p className="muted">Загрузка…</p>;
  if (exercises.length === 0) return <EmptyState>Упражнения появятся здесь после первой тренировки с подходами.</EmptyState>;
  const exId = selected || exercises[0]!.id;
  const points = exerciseProgress(workouts, exId);
  const withWeight = points.filter((p) => p.maxWeightKg !== null);

  return (
    <div className="stack">
      <Field label="Упражнение">
        {(p) => (
          <select {...p} className="input" value={exId} onChange={(e) => setSelected(e.target.value)}>
            {exercises.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {points.length === 0 ? (
        <EmptyState>Это упражнение ещё не выполнялось.</EmptyState>
      ) : (
        <>
          <div className="card">
            <h3>Максимальный рабочий вес</h3>
            <LineChart
              label="Максимальный вес"
              unit="кг"
              points={withWeight.map((p) => ({ x: Date.parse(p.startAt), y: p.maxWeightKg! }))}
              formatX={(x) => formatDateKey(toDateKey(new Date(x)))}
            />
          </div>
          <table className="set-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Подходы</th>
                <th>Повторы</th>
                <th>Макс., кг</th>
                <th>Тоннаж, кг</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.workoutId}>
                  <td>{formatDateKey(p.date)}</td>
                  <td className="num">{p.sets}</td>
                  <td className="num">{p.totalReps}</td>
                  <td className="num">{p.maxWeightKg === null ? '—' : r1(p.maxWeightKg)}</td>
                  <td className="num">{r1(p.volumeKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">Тоннаж считается только по подходам, где указаны и повторения, и вес.</p>
        </>
      )}
    </div>
  );
}
