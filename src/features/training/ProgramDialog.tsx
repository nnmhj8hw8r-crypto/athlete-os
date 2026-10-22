// Создание и настройка программы: название, формат, вид спорта, дни (подпись), значок, цвет, обложка.
import { useRef, useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { deletePhoto, savePhoto } from '../../data/photos.ts';
import { deleteEntity, saveEntity } from '../../data/repo.ts';
import { libraryExercise } from '../../domain/exerciseLibrary.ts';
import type { FieldErrors } from '../../domain/form.ts';
import {
  PROGRAM_COLORS,
  PROGRAM_ICONS,
  WORKOUT_FORMATS,
  WORKOUT_TYPES,
  type Program,
  type ProgramColor,
  type ProgramIcon,
  type ProgramItem,
  type WorkoutFormat,
  type WorkoutType,
} from '../../domain/schemas.ts';
import { WEEKDAY_SHORT, WORKOUT_FORMAT_LABEL, WORKOUT_TYPE_LABEL } from '../../domain/training.ts';
import { Field, FormError, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { ProgramCover, ProgramGlyph } from './catalog.tsx';

const ICON_LABEL: Record<ProgramIcon, string> = {
  auto: 'Авто',
  gym: 'Гантель',
  mat: 'Ковёр',
  fight: 'Борьба',
  run: 'Бег',
  bolt: 'Скорость',
  letter: 'Буква',
};
const COLOR_LABEL: Record<ProgramColor, string> = {
  blue: 'синий',
  red: 'красный',
  green: 'зелёный',
  orange: 'оранжевый',
  purple: 'фиолетовый',
  gray: 'серый',
};

/** Стартовый план для новой программы на ковре — его можно изменить или удалить. */
function starterItems(format: WorkoutFormat): ProgramItem[] {
  const item = (id: string, patch: Partial<ProgramItem> = {}): ProgramItem => {
    const ex = libraryExercise(`lib:${id}`)!;
    return { exerciseId: ex.id, name: ex.name, metric: ex.metric, sets: 1, ...patch };
  };
  if (format === 'fight') {
    return [item('randori-ground', { sets: 2, durationSec: 180 }), item('randori-standing', { sets: 6, durationSec: 180, restSec: 60 }), item('analysis')];
  }
  if (format === 'mat') return [item('technique', { durationSec: 1800 })];
  return [];
}

interface Props {
  program?: Program;
  onClose: () => void;
  onSaved?: (p: Program) => void;
  onDeleted?: () => void;
}

export function ProgramDialog({ program, onClose, onSaved, onDeleted }: Props) {
  const { notify, confirm } = useFeedback();
  const [name, setName] = useState(program?.name ?? '');
  const [format, setFormat] = useState<WorkoutFormat>(program?.format ?? 'exercises');
  const [type, setType] = useState<WorkoutType>(program?.type ?? 'gym');
  const [weekdays, setWeekdays] = useState<number[]>(program?.weekdays ?? []);
  const [icon, setIcon] = useState<ProgramIcon>(program?.icon ?? 'auto');
  const [color, setColor] = useState<ProgramColor>(program?.color ?? 'blue');
  const [coverPhotoId, setCoverPhotoId] = useState<string | undefined>(program?.coverPhotoId);
  const [notes, setNotes] = useState(program?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const newCovers = useRef<string[]>([]);

  const changeFormat = (f: WorkoutFormat) => {
    setFormat(f);
    if (f !== 'exercises' && (type === 'gym' || type === 'other')) setType('judo');
    if (f === 'exercises' && (type === 'judo' || type === 'sambo')) setType('gym');
  };

  async function pickCover(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const rec = await savePhoto(file, 'cover');
      newCovers.current.push(rec.id);
      setCoverPhotoId(rec.id);
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    // Обложки, загруженные в этом окне и не сохранённые, не оставляем в базе.
    for (const id of newCovers.current) await deletePhoto(id);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await saveEntity(
      'programs',
      {
        name,
        format,
        type,
        weekdays: weekdays.length ? [...weekdays].sort((a, b) => a - b) : undefined,
        icon,
        color,
        coverPhotoId,
        notes: notes.trim() || undefined,
        items: program?.items ?? starterItems(format),
      },
      program,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    // Старая обложка и неиспользованные новые больше не нужны.
    const unused = [...newCovers.current, program?.coverPhotoId].filter((id): id is string => !!id && id !== coverPhotoId);
    for (const id of unused) await deletePhoto(id);
    notify(program ? 'Программа сохранена' : 'Программа создана');
    onSaved?.(r.value);
    onClose();
  }

  async function remove() {
    if (!program) return;
    const planned = await db.schedule.where('programId').equals(program.id).count();
    const ok = await confirm({
      title: 'Удалить программу?',
      message: `«${program.name}» будет удалена${planned ? `, а также ${planned} записей из плана недели` : ''}. Тренировки в журнале сохранятся.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    await db.transaction('rw', db.programs, db.schedule, async () => {
      await db.schedule.where('programId').equals(program.id).delete();
      await deleteEntity('programs', program.id);
    });
    if (program.coverPhotoId) await deletePhoto(program.coverPhotoId);
    notify('Программа удалена');
    onClose();
    onDeleted?.();
  }

  const preview: Program = {
    id: 'preview',
    name: name || 'Программа',
    format,
    type,
    icon,
    color,
    coverPhotoId,
    items: [],
    createdAt: '',
    updatedAt: '',
  };

  return (
    <Modal
      title={program ? 'Настройки программы' : 'Новая программа'}
      onClose={cancel}
      size="full"
      footer={
        <>
          {program && (
            <button type="button" className="btn danger" onClick={remove}>
              Удалить
            </button>
          )}
          <button type="button" className="btn" onClick={cancel}>
            Отмена
          </button>
          <button type="submit" form="program-form" className="btn primary" disabled={busy}>
            Сохранить
          </button>
        </>
      }
    >
      <form id="program-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <ProgramCover program={preview} className="small" />
        <Field label="Название" error={errors.name} hint="Например: «Ковёр — Пн, Ср, Пт», «Качалка — Вт, Чт», «Скоростно-силовая»">
          {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="field">
          <span className="label">Формат</span>
          <div className="seg" role="radiogroup" aria-label="Формат">
            {WORKOUT_FORMATS.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={format === f} className={format === f ? 'on' : ''} onClick={() => changeFormat(f)}>
                {WORKOUT_FORMAT_LABEL[f]}
              </button>
            ))}
          </div>
          {!program && format !== 'exercises' && (
            <span className="hint">
              {format === 'fight'
                ? 'Будет создан стартовый план: 2 встречи в партере, 6 встреч в стойке по 3 минуты, разбор. Его можно изменить.'
                : 'Будет создан стартовый план: отработка техники. Его можно изменить.'}
            </span>
          )}
        </div>
        <Field label="Вид спорта / место">
          {(p) => (
            <select {...p} className="input" value={type} onChange={(e) => setType(e.target.value as WorkoutType)}>
              {WORKOUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {WORKOUT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="field">
          <span className="label">
            Дни недели <span className="optional">(необязательно, только подпись)</span>
          </span>
          <div className="chips">
            {WEEKDAY_SHORT.map((d, i) => {
              const n = i + 1;
              const on = weekdays.includes(n);
              return (
                <button key={d} type="button" className={`chip${on ? ' chip-selected' : ''}`} aria-pressed={on} onClick={() => setWeekdays((l) => (on ? l.filter((x) => x !== n) : [...l, n]))}>
                  {d}
                </button>
              );
            })}
          </div>
          <span className="hint">Чтобы разложить программы по конкретным дням, утру и вечеру, используйте вкладку «Неделя».</span>
        </div>
        <div className="field">
          <span className="label">Значок</span>
          <div className="chips">
            {PROGRAM_ICONS.map((i) => (
              <button key={i} type="button" className={`icon-choice${icon === i ? ' on' : ''}`} aria-pressed={icon === i} onClick={() => setIcon(i)} title={ICON_LABEL[i]}>
                <ProgramGlyph program={{ icon: i, format, name: name || 'П' }} size={22} />
                <small>{ICON_LABEL[i]}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Цвет</span>
          <div className="chips">
            {PROGRAM_COLORS.map((c) => (
              <button key={c} type="button" className={`swatch color-${c}${color === c ? ' on' : ''}`} aria-pressed={color === c} aria-label={COLOR_LABEL[c]} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">
            Своё фото на обложку <span className="optional">(необязательно)</span>
          </span>
          <div className="row">
            <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
              {coverPhotoId ? 'Заменить фото' : 'Выбрать фото'}
            </button>
            {coverPhotoId && (
              <button type="button" className="btn ghost" onClick={() => setCoverPhotoId(undefined)}>
                Убрать фото
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickCover(e.target.files?.[0])} />
          <span className="hint">Фото хранится только на этом устройстве и не входит в резервную копию.</span>
        </div>
        <Field label="Заметки" optional>
          {(p) => <textarea {...p} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Цель программы, нюансы, от тренера…" />}
        </Field>
      </form>
    </Modal>
  );
}
