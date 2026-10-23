// Страница упражнения: крупная иконка, параметры, заметки о технике, схема мышц, история и график.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity } from '../../data/repo.ts';
import { EXERCISE_NOTES_KEY, getExerciseNotes, setExerciseNote } from '../../data/training.ts';
import { EXERCISE_GROUP_LABEL, EXERCISE_METRIC_LABEL, exerciseHistory, exerciseProgress, formatClock, formatSet } from '../../domain/training.ts';
import { formatDateKey, formatDateTime, toDateKey } from '../../domain/time.ts';
import { EXERCISE_IMAGE_LICENSE_URL, exerciseImageCredit, exerciseImagePath } from '../../domain/exerciseImages.ts';
import { ExercisePose } from '../../ui/BodyFigure.tsx';
import { exerciseMarks, RealFigure } from '../../ui/RealFigure.tsx';
import { useProfile } from '../onboarding/useProfile.ts';
import { hasPictogram, Pictogram } from '../../ui/Pictograms.tsx';
import { EmptyState, TopBar } from '../../ui/components.tsx';
import { useConfirmDelete, useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { LineChart } from '../../ui/LineChart.tsx';
import { navigate, type Route } from '../../ui/router.ts';
import { ExerciseFormDialog, ExIcon, MUSCLE_LABEL, useCatalogMap } from './catalog.tsx';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function ExercisePage({ route }: { route: Route }) {
  const id = route.params.get('id') ?? '';
  const map = useCatalogMap();
  const ex = map.get(id);
  const own = useLiveQuery(() => db.exercises.get(id), [id]);
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  const [editing, setEditing] = useState(false);
  const confirmDelete = useConfirmDelete();
  const sex = useProfile()?.sex ?? 'male';

  if (!ex) {
    return (
      <div className="page">
        <TopBar title="Упражнение" backTo="/training?tab=exercises" />
        <EmptyState>{map.size ? 'Упражнение не найдено.' : 'Загрузка…'}</EmptyState>
      </div>
    );
  }
  const pose = exerciseImagePath(ex.id);
  const history = workouts ? exerciseHistory(workouts, id) : [];
  const points = workouts ? exerciseProgress(workouts, id) : [];
  const chart =
    ex.metric === 'weight_reps'
      ? { label: 'Максимальный вес', unit: 'кг', pts: points.filter((p) => p.maxWeightKg !== null).map((p) => ({ x: Date.parse(p.startAt), y: p.maxWeightKg! })) }
      : ex.metric === 'reps'
        ? { label: 'Повторений за тренировку', unit: 'раз', pts: points.map((p) => ({ x: Date.parse(p.startAt), y: p.totalReps })) }
        : ex.metric === 'distance_time'
          ? { label: 'Расстояние за тренировку', unit: 'км', pts: points.filter((p) => p.totalKm > 0).map((p) => ({ x: Date.parse(p.startAt), y: p.totalKm })) }
          : ex.metric === 'check'
            ? null
            : { label: 'Время за тренировку', unit: 'мин', pts: points.map((p) => ({ x: Date.parse(p.startAt), y: Math.round(p.totalSec / 6) / 10 })) };

  return (
    <div className="page">
      <TopBar
        title={ex.name}
        backTo="/training?tab=exercises"
        action={
          own ? (
            <button type="button" className="round-btn" aria-label="Изменить упражнение" onClick={() => setEditing(true)}>
              {Icons.edit}
            </button>
          ) : undefined
        }
      />
      {/* v0.9.4: сверху крупная иконка упражнения и название, ниже — параметры, техника, мышцы, история. */}
      <div className="ex-hero">
        {pose ? (
          <ExercisePose src={pose} credit={exerciseImageCredit(ex.id)} licenseUrl={EXERCISE_IMAGE_LICENSE_URL} />
        ) : hasPictogram(ex.id) ? (
          <ExercisePose credit="Пиктограмма приложения">
            <Pictogram exerciseId={ex.id} primary={ex.muscles} secondary={ex.musclesSecondary} />
          </ExercisePose>
        ) : (
          <ExIcon ex={ex} size="lg" />
        )}
        <h1 className="ex-title">{ex.name}</h1>
      </div>

      <section className="card ex-params" aria-label="Параметры упражнения">
        <div className="row-between">
          <h2>Параметры</h2>
          {own && (
            <button type="button" className="btn small" onClick={() => setEditing(true)}>
              {Icons.edit} Изменить
            </button>
          )}
        </div>
        <dl>
          <div>
            <dt>Раздел</dt>
            <dd>{EXERCISE_GROUP_LABEL[ex.group]}</dd>
          </div>
          <div>
            <dt>Что записывать</dt>
            <dd>{EXERCISE_METRIC_LABEL[ex.metric]}</dd>
          </div>
          {ex.muscles.length > 0 && (
            <div>
              <dt>Основные мышцы</dt>
              <dd>{ex.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')}</dd>
            </div>
          )}
          {ex.musclesSecondary.length > 0 && (
            <div>
              <dt>Вспомогательные</dt>
              <dd>{ex.musclesSecondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</dd>
            </div>
          )}
          <div>
            <dt>Источник</dt>
            <dd>{ex.builtIn ? 'встроенное' : 'своё упражнение'}</dd>
          </div>
        </dl>
        {!own && <p className="small muted">Встроенное упражнение не меняется. Нужны другие параметры — создайте своё в списке упражнений.</p>}
      </section>

      <TechniqueNotes exerciseId={id} />

      {(ex.muscles.length > 0 || ex.musclesSecondary.length > 0) && (
        <section className="section">
          <h2>Какие мышцы работают</h2>
          <RealFigure sex={sex} marks={exerciseMarks(ex.muscles, ex.musclesSecondary)} className="ex-real" title={`Мышцы: ${ex.name}`} />
          <p className="small muted">Ярче — основные мышцы, бледнее — вспомогательные.</p>
        </section>
      )}

      <section className="section">
        <h2>История</h2>
        {history.length === 0 ? (
          <EmptyState>Это упражнение ещё не выполнялось.</EmptyState>
        ) : (
          <>
            {chart && chart.pts.length > 1 && (
              <div className="card">
                <h3>{chart.label}</h3>
                <LineChart label={chart.label} unit={chart.unit} points={chart.pts} formatX={(x) => formatDateKey(toDateKey(new Date(x)))} />
              </div>
            )}
            <ul className="list">
              {history.map((h) => (
                <li key={h.workoutId} className="list-item">
                  <div className="grow">
                    <div className="title">{formatDateTime(h.startAt)}</div>
                    <div className="meta">{h.title}</div>
                    <div className="meta">{h.sets.map((s) => formatSet(s, h.metric)).join(', ')}</div>
                  </div>
                </li>
              ))}
            </ul>
            {ex.metric === 'weight_reps' && points.length > 0 && (
              <p className="small muted">
                Лучший вес: {r1(Math.max(...points.map((p) => p.maxWeightKg ?? 0)))} кг · тоннаж последней тренировки:{' '}
                {r1(points[points.length - 1]!.volumeKg)} кг (по подходам с весом и повторениями).
              </p>
            )}
            {(ex.metric === 'rounds' || ex.metric === 'time') && points.length > 0 && (
              <p className="small muted">Всего времени: {formatClock(points.reduce((s, p) => s + p.totalSec, 0))}.</p>
            )}
          </>
        )}
      </section>

      {own && (
        <button
          type="button"
          className="btn danger"
          onClick={() =>
            confirmDelete(own.name, async () => {
              await deleteEntity('exercises', own.id);
              navigate('/training?tab=exercises', true);
            })
          }
        >
          Удалить своё упражнение
        </button>
      )}
      {own && <p className="small muted">Записи в журнале при удалении упражнения сохраняются.</p>}
      {editing && own && <ExerciseFormDialog exercise={own} onClose={() => setEditing(false)} />}
    </div>
  );
}

export function TechniqueNotes({ exerciseId }: { exerciseId: string }) {
  const notes = useLiveQuery(async () => {
    await db.settings.get(EXERCISE_NOTES_KEY);
    return getExerciseNotes();
  }, []);
  const saved = notes?.[exerciseId] ?? '';
  const [text, setText] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const { notify } = useFeedback();
  useEffect(() => {
    if (!dirty) setText(saved);
  }, [saved, dirty]);
  return (
    <section className="section">
      <h2>Техника</h2>
      <textarea
        className="input"
        aria-label="Заметки о технике"
        placeholder="Ключевые моменты техники, на что обращать внимание, ссылки на разборы…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
      />
      {dirty && (
        <button
          type="button"
          className="btn small primary"
          onClick={async () => {
            await setExerciseNote(exerciseId, text);
            setDirty(false);
            notify('Заметка сохранена');
          }}
        >
          Сохранить заметку
        </button>
      )}
    </section>
  );
}
