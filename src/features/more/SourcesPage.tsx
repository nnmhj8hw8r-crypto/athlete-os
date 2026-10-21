// Библиотека источников: только то, что пользователь добавил сам.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity, saveEntity } from '../../data/repo.ts';
import { emptyToUndefined, type FieldErrors } from '../../domain/form.ts';
import { SOURCE_TYPES, type KnowledgeSource, type SourceType } from '../../domain/schemas.ts';
import { formatDateKey, todayKey } from '../../domain/time.ts';
import { EmptyState, Field, FormError, Modal, Page, RowActions } from '../../ui/components.tsx';
import { useConfirmDelete, useFeedback } from '../../ui/feedback.tsx';
import { href } from '../../ui/router.ts';

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  systematic_review: 'Систематический обзор',
  meta_analysis: 'Метаанализ',
  study: 'Исследование',
  guideline: 'Официальная рекомендация',
  book: 'Книга',
  article: 'Статья',
  video: 'Видео',
  coach_experience: 'Опыт тренера / спортсмена',
  other: 'Другое',
};

export function SourcesPage() {
  const items = useLiveQuery(() => db.sources.toArray(), []);
  const [query, setQuery] = useState('');
  const [dlg, setDlg] = useState<{ item?: KnowledgeSource } | null>(null);
  const confirmDelete = useConfirmDelete();

  const q = query.trim().toLocaleLowerCase('ru-RU');
  const list = (items ?? [])
    .filter((s) => !q || `${s.title} ${s.author ?? ''} ${s.topic ?? ''} ${s.notes ?? ''}`.toLocaleLowerCase('ru-RU').includes(q))
    .sort((a, b) => b.checkedDate.localeCompare(a.checkedDate));

  return (
    <Page
      title="Библиотека источников"
      subtitle={<a href={href('/more')}>← Ещё</a>}
      actions={
        <button type="button" className="btn primary" onClick={() => setDlg({})}>
          + Источник
        </button>
      }
    >
      <p className="small muted">
        Опыт тренеров и спортсменов полезен как практический материал, но не равен научному доказательству — отмечайте тип источника.
      </p>
      <label className="visually-hidden" htmlFor="src-q">
        Поиск по источникам
      </label>
      <input id="src-q" className="input" placeholder="Поиск по названию, автору, теме" value={query} onChange={(e) => setQuery(e.target.value)} />
      {items === undefined ? (
        <p className="muted">Загрузка…</p>
      ) : list.length === 0 ? (
        <EmptyState>{items.length === 0 ? 'Библиотека пуста. Добавьте источник, который хотите сохранить.' : 'Ничего не найдено.'}</EmptyState>
      ) : (
        <ul className="list">
          {list.map((s) => (
            <li key={s.id} className="list-item">
              <div className="grow">
                <span className="badge">{SOURCE_TYPE_LABEL[s.sourceType]}</span>
                <div className="title">{s.title}</div>
                <div className="meta">
                  {[s.author, s.topic, s.publishedDate && `опубликовано ${formatDateKey(s.publishedDate, true)}`, `проверено ${formatDateKey(s.checkedDate, true)}`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {s.notes && <div className="meta">{s.notes}</div>}
                {s.url && (
                  <a className="small" href={s.url} target="_blank" rel="noopener noreferrer">
                    Открыть
                  </a>
                )}
              </div>
              <RowActions label={s.title} onEdit={() => setDlg({ item: s })} onDelete={() => confirmDelete(s.title, () => deleteEntity('sources', s.id))} />
            </li>
          ))}
        </ul>
      )}
      {dlg && <SourceDialog item={dlg.item} onClose={() => setDlg(null)} />}
    </Page>
  );
}

function SourceDialog({ item, onClose }: { item?: KnowledgeSource; onClose: () => void }) {
  const { notify } = useFeedback();
  const [f, setF] = useState({
    title: item?.title ?? '',
    author: item?.author ?? '',
    url: item?.url ?? '',
    publishedDate: item?.publishedDate ?? '',
    checkedDate: item?.checkedDate ?? todayKey(),
    topic: item?.topic ?? '',
    sourceType: (item?.sourceType ?? 'article') as SourceType,
    notes: item?.notes ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await saveEntity(
      'sources',
      {
        title: f.title,
        author: emptyToUndefined(f.author),
        url: emptyToUndefined(f.url),
        publishedDate: emptyToUndefined(f.publishedDate),
        checkedDate: f.checkedDate,
        topic: emptyToUndefined(f.topic),
        sourceType: f.sourceType,
        notes: emptyToUndefined(f.notes),
      },
      item,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(item ? 'Источник обновлён' : 'Источник добавлен');
    onClose();
  }

  return (
    <Modal
      title={item ? 'Изменить источник' : 'Новый источник'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="src-form" className="btn primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id="src-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <Field label="Название" error={errors.title}>
          {(p) => <input {...p} className="input" value={f.title} onChange={set('title')} />}
        </Field>
        <div className="fields-2">
          <Field label="Автор или организация" optional error={errors.author}>
            {(p) => <input {...p} className="input" value={f.author} onChange={set('author')} />}
          </Field>
          <Field label="Тип источника">
            {(p) => (
              <select {...p} className="input" value={f.sourceType} onChange={set('sourceType')}>
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SOURCE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label="Ссылка" optional error={errors.url}>
          {(p) => <input {...p} className="input" type="url" inputMode="url" value={f.url} onChange={set('url')} />}
        </Field>
        <div className="fields-2">
          <Field label="Дата публикации" optional error={errors.publishedDate}>
            {(p) => <input {...p} className="input" type="date" value={f.publishedDate} onChange={set('publishedDate')} />}
          </Field>
          <Field label="Дата проверки" error={errors.checkedDate}>
            {(p) => <input {...p} className="input" type="date" value={f.checkedDate} onChange={set('checkedDate')} />}
          </Field>
        </div>
        <Field label="Тема" optional hint="Например: сгонка веса, восстановление, сила" error={errors.topic}>
          {(p) => <input {...p} className="input" value={f.topic} onChange={set('topic')} />}
        </Field>
        <Field label="Заметки" optional error={errors.notes}>
          {(p) => <textarea {...p} className="input" value={f.notes} onChange={set('notes')} />}
        </Field>
      </form>
    </Modal>
  );
}
