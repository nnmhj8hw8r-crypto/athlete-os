// Сводка для ручного переноса в Claude / ChatGPT. Ничего не отправляется автоматически:
// пользователь выбирает данные, просматривает и правит текст и сам нажимает «Скопировать».
import { useRef, useState } from 'react';
import { db } from '../../data/db.ts';
import {
  buildSummary,
  PROMPT_TEMPLATES,
  SUMMARY_SECTION_LABEL,
  SUMMARY_SECTIONS,
  type SummarySection,
} from '../../domain/summary.ts';
import { addDays, todayKey } from '../../domain/time.ts';
import { Field, Page } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { href } from '../../ui/router.ts';

async function copyText(text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ниже — запасной способ для страниц без HTTPS
  }
  if (!fallback) return false;
  fallback.focus();
  fallback.select();
  return document.execCommand('copy');
}

export function AiSummaryPage() {
  const { notify } = useFeedback();
  const today = todayKey();
  const [templateId, setTemplateId] = useState(PROMPT_TEMPLATES[0]!.id);
  const [sections, setSections] = useState<Set<SummarySection>>(new Set(PROMPT_TEMPLATES[0]!.suggested));
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = PROMPT_TEMPLATES.find((x) => x.id === id);
    if (t) setSections(new Set(t.suggested));
  }

  function toggle(s: SummarySection) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function generate() {
    if (from > to) {
      setError('Начало периода позже окончания');
      return;
    }
    setError(null);
    // Читаются только выбранные разделы; невыбранные данные даже не загружаются.
    const has = (s: SummarySection) => sections.has(s);
    const [meals, workouts, sleep, competitions, bodyWeights] = await Promise.all([
      has('nutrition') ? db.meals.where('date').between(from, to, true, true).toArray() : [],
      has('training') ? db.workouts.toArray() : [],
      has('recovery') ? db.sleep.toArray() : [],
      has('competition') ? db.competitions.toArray() : [],
      has('competition') ? db.bodyWeights.toArray() : [],
    ]);
    setText(buildSummary({ meals, workouts, sleep, competitions, bodyWeights }, { sections: [...sections], from, to, templateId: templateId || undefined }));
  }

  async function copy() {
    const ok = await copyText(text, textRef.current);
    notify(ok ? 'Текст скопирован. Вставьте его в чат Claude или ChatGPT.' : 'Не удалось скопировать — выделите текст и скопируйте вручную.', ok ? 'info' : 'error');
  }

  return (
    <Page title="Сводка для ИИ" subtitle={<a href={href('/more')}>← Ещё</a>}>
      <p className="notice info small">
        Приложение не отправляет данные никуда само. Вы выбираете разделы, проверяете текст и сами копируете его в свой чат
        Claude или ChatGPT. Помните, что вставленный текст попадает к внешнему сервису.
      </p>

      <Field label="Шаблон запроса">
        {(p) => (
          <select {...p} className="input" value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
            {PROMPT_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
            <option value="">Без шаблона — только данные</option>
          </select>
        )}
      </Field>

      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>Какие данные включить</legend>
        {SUMMARY_SECTIONS.map((s) => (
          <label key={s} className="row">
            <input type="checkbox" checked={sections.has(s)} onChange={() => toggle(s)} /> {SUMMARY_SECTION_LABEL[s]}
          </label>
        ))}
      </fieldset>

      <div className="fields-2">
        <Field label="С">
          {(p) => <input {...p} className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}
        </Field>
        <Field label="По">
          {(p) => <input {...p} className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />}
        </Field>
      </div>
      {error && <p className="notice error">{error}</p>}

      <button type="button" className="btn primary" onClick={generate}>
        Сформировать текст
      </button>

      {text && (
        <div className="stack">
          <Field label="Текст для копирования (можно отредактировать)">
            {(p) => <textarea {...p} ref={textRef} className="input" style={{ minHeight: 320 }} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
          <div className="row">
            <button type="button" className="btn primary" onClick={copy}>
              Скопировать в буфер обмена
            </button>
            <button type="button" className="btn ghost" onClick={() => setText('')}>
              Очистить
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}
