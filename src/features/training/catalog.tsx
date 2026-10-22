// Общие элементы вкладки «Тренировки»: каталог упражнений (встроенные + свои), выбор упражнения,
// форма своего упражнения, иконки и обложки программ.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { saveEntity } from '../../data/repo.ts';
import { buildCatalog, RETIRED_EXERCISES, searchCatalog, toCatalogExercise, type CatalogExercise } from '../../domain/exerciseLibrary.ts';
import { exerciseImagePath } from '../../domain/exerciseImages.ts';
import type { FieldErrors } from '../../domain/form.ts';
import {
  EXERCISE_GROUPS,
  EXERCISE_METRICS,
  MUSCLES,
  type Exercise,
  type ExerciseGroup,
  type ExerciseMetric,
  type Muscle,
  type Program,
} from '../../domain/schemas.ts';
import { EXERCISE_GROUP_LABEL, EXERCISE_METRIC_LABEL, WORKOUT_FORMAT_LABEL, WORKOUT_TYPE_LABEL, weekdaysLabel } from '../../domain/training.ts';
import { plural } from '../../domain/time.ts';
import { BodyFigure, ExerciseIcon } from '../../ui/BodyFigure.tsx';
import { Field, FormError, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';

export function useCatalog(): CatalogExercise[] | undefined {
  const own = useLiveQuery(() => db.exercises.toArray(), []);
  return useMemo(() => (own ? buildCatalog(own) : undefined), [own]);
}

/** Каталог по id, включая убранные из каталога упражнения — для показа старых записей. */
export function useCatalogMap(): Map<string, CatalogExercise> {
  const catalog = useCatalog();
  return useMemo(
    () => new Map([...RETIRED_EXERCISES.map(toCatalogExercise), ...(catalog ?? [])].map((e) => [e.id, e])),
    [catalog],
  );
}

/** Иконка упражнения: рисунок позы Everkinetic, если он есть, иначе схема мышц (нет в каталоге — серая). */
export function ExIcon({ ex, size }: { ex: CatalogExercise | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const src = ex ? exerciseImagePath(ex.id) : null;
  return <ExerciseIcon key={src ?? 'figure'} muscles={ex?.muscles ?? []} secondary={ex?.musclesSecondary} size={size} src={src} />;
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'грудные',
  delts: 'дельты',
  biceps: 'бицепс',
  triceps: 'трицепс',
  forearms: 'предплечья',
  abs: 'пресс',
  obliques: 'косые мышцы живота',
  quads: 'квадрицепс',
  adductors: 'приводящие бедра',
  calves: 'икры',
  traps: 'трапеции',
  lats: 'широчайшие',
  rearDelts: 'задние дельты',
  lowerBack: 'поясница',
  glutes: 'ягодицы',
  hamstrings: 'бицепс бедра',
};

/** Порядок групп в каталоге (раздела «Разминка» нет — решение пользователя, v0.5.1). */
export const GROUP_ORDER: ExerciseGroup[] = EXERCISE_GROUPS.filter((g) => g !== 'warmup');

// ---------- Иконки и обложки программ ----------

/** Подпись программы: формат, вид спорта, число упражнений, дни. */
export function programMeta(p: Program): string {
  const n = p.items.length;
  return [
    WORKOUT_FORMAT_LABEL[p.format],
    p.format === 'exercises' && p.type === 'gym' ? null : WORKOUT_TYPE_LABEL[p.type],
    n ? `${n} ${plural(n, ['упражнение', 'упражнения', 'упражнений'])}` : null,
    weekdaysLabel(p.weekdays) || null,
  ]
    .filter(Boolean)
    .join(' · ');
}


const GLYPH: Record<string, string> = {
  gym: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  mat: 'M3 6h18v12H3zM3 12h18M12 6v12',
  fight: 'M7 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM17 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 9v5l-2 6M7 14l3 6M17 9v5l2 6M17 14l-3 6M8 11l4 2 4-2',
  run: 'M14 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 20l4-5 3 2 2-5 3 3M9 10l3-2 3 1',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
};

export function programGlyph(p: Pick<Program, 'icon' | 'format'>): string {
  if (p.icon === 'auto') return p.format === 'exercises' ? 'gym' : p.format === 'mat' ? 'mat' : 'fight';
  return p.icon;
}

export function ProgramGlyph({ program, size = 32 }: { program: Pick<Program, 'icon' | 'format' | 'name'>; size?: number }) {
  const g = programGlyph(program);
  if (g === 'letter') {
    return (
      <span className="program-letter" style={{ fontSize: size * 0.8 }}>
        {program.name.trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPH[g] ?? GLYPH.gym} />
    </svg>
  );
}

/** Обложка: своё фото (если загружено) или цветной фон со значком. */
export function ProgramCover({ program, className = '' }: { program: Program; className?: string }) {
  const photo = useLiveQuery(() => (program.coverPhotoId ? db.photos.get(program.coverPhotoId) : undefined), [program.coverPhotoId]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return (
    <div className={`program-cover color-${program.color} ${className}`} style={url ? { backgroundImage: `url(${url})` } : undefined}>
      {!url && (
        <span className="program-cover-glyph">
          <ProgramGlyph program={program} size={56} />
        </span>
      )}
    </div>
  );
}

// ---------- Выбор упражнения ----------

interface PickerProps {
  title: string;
  onPick: (ex: CatalogExercise) => void;
  onClose: () => void;
}

/** Окно выбора упражнения: поиск, группы, «+ Своё упражнение». */
export function ExercisePicker({ title, onPick, onClose }: PickerProps) {
  const catalog = useCatalog();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    if (!catalog) return [];
    const found = searchCatalog(catalog, q);
    return group === 'all' ? found : found.filter((e) => e.group === group);
  }, [catalog, q, group]);

  if (creating) {
    return (
      <ExerciseFormDialog
        initialName={q}
        onClose={() => setCreating(false)}
        onSaved={(e) => {
          setCreating(false);
          onPick(e);
        }}
      />
    );
  }

  return (
    <Modal title={title} onClose={onClose} size="full">
      <label className="search-box">
        {Icons.search}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск упражнения" aria-label="Поиск упражнения" data-autofocus />
      </label>
      <GroupChips value={group} onChange={setGroup} />
      <button type="button" className="add-wide" onClick={() => setCreating(true)}>
        {Icons.plus}
        <span>
          Своё упражнение
          <small>{q.trim() ? `«${q.trim()}» — с группой, мышцами и типом измерения` : 'Название, группа, мышцы и что измерять'}</small>
        </span>
      </button>
      {catalog === undefined ? (
        <p className="muted">Загрузка…</p>
      ) : list.length === 0 ? (
        <p className="muted">Ничего не найдено. Создайте своё упражнение.</p>
      ) : (
        <ul className="ex-list">
          {list.map((e) => (
            <li key={e.id}>
              <button type="button" className="ex-row" onClick={() => onPick(e)}>
                <ExIcon ex={e} size="sm" />
                <span className="grow">
                  <span className="title">{e.name}</span>
                  <span className="meta">
                    {EXERCISE_GROUP_LABEL[e.group]} · {EXERCISE_METRIC_LABEL[e.metric]}
                    {!e.builtIn && ' · своё'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function GroupChips({ value, onChange, groups = GROUP_ORDER }: { value: ExerciseGroup | 'all'; onChange: (g: ExerciseGroup | 'all') => void; groups?: ExerciseGroup[] }) {
  return (
    <div className="chip-scroll no-swipe" role="group" aria-label="Группы упражнений">
      {(['all', ...groups] as const).map((g) => (
        <button key={g} type="button" className={`chip${value === g ? ' chip-selected' : ''}`} aria-pressed={value === g} onClick={() => onChange(g)}>
          {g === 'all' ? 'Все' : EXERCISE_GROUP_LABEL[g]}
        </button>
      ))}
    </div>
  );
}

// ---------- Своё упражнение ----------

interface FormProps {
  exercise?: Exercise;
  initialName?: string;
  onClose: () => void;
  onSaved?: (e: CatalogExercise) => void;
}

export function ExerciseFormDialog({ exercise, initialName = '', onClose, onSaved }: FormProps) {
  const { notify } = useFeedback();
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [group, setGroup] = useState<ExerciseGroup>(exercise?.group ?? 'other');
  const [metric, setMetric] = useState<ExerciseMetric>(exercise?.metric ?? 'weight_reps');
  const [primary, setPrimary] = useState<Muscle[]>(exercise?.muscles ?? []);
  const [secondary, setSecondary] = useState<Muscle[]>(exercise?.musclesSecondary ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});

  const toggle = (m: Muscle) => {
    // Нажатия по кругу: нет → основная → вспомогательная → нет.
    if (primary.includes(m)) {
      setPrimary((l) => l.filter((x) => x !== m));
      setSecondary((l) => [...l, m]);
    } else if (secondary.includes(m)) {
      setSecondary((l) => l.filter((x) => x !== m));
    } else {
      setPrimary((l) => [...l, m]);
    }
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!exercise) {
      const lower = clean.toLocaleLowerCase('ru-RU');
      const dup = await db.exercises.filter((x) => x.name.toLocaleLowerCase('ru-RU') === lower).first();
      if (dup) {
        setErrors({ name: 'Своё упражнение с таким названием уже есть' });
        return;
      }
    }
    const r = await saveEntity('exercises', { name: clean, group, metric, muscles: primary, musclesSecondary: secondary, notes: exercise?.notes }, exercise);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(exercise ? 'Упражнение изменено' : 'Упражнение добавлено в каталог');
    onSaved?.({
      id: r.value.id,
      name: r.value.name,
      group,
      metric,
      muscles: primary,
      musclesSecondary: secondary,
      builtIn: false,
    });
    onClose();
  }

  return (
    <Modal
      title={exercise ? 'Изменить упражнение' : 'Своё упражнение'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="exercise-form" className="btn primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id="exercise-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <Field label="Название" error={errors.name}>
          {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: броски манекена" />}
        </Field>
        <div className="fields-2">
          <Field label="Группа">
            {(p) => (
              <select {...p} className="input" value={group} onChange={(e) => setGroup(e.target.value as ExerciseGroup)}>
                {GROUP_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {EXERCISE_GROUP_LABEL[g]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Что записывать">
            {(p) => (
              <select {...p} className="input" value={metric} onChange={(e) => setMetric(e.target.value as ExerciseMetric)}>
                {EXERCISE_METRICS.map((m) => (
                  <option key={m} value={m}>
                    {EXERCISE_METRIC_LABEL[m]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="field">
          <span className="label">Мышцы для иконки</span>
          <span className="hint">Нажмите один раз — основная (красная), второй — вспомогательная, третий — убрать.</span>
          <div className="muscle-editor">
            <BodyFigure primary={primary} secondary={secondary} view="both" className="muscle-preview" />
            <div className="chips">
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip${primary.includes(m) ? ' chip-primary' : secondary.includes(m) ? ' chip-secondary' : ''}`}
                  onClick={() => toggle(m)}
                >
                  {MUSCLE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
