// Приветствие при первом запуске (v0.9): что это за приложение, разделы, кто вы, короткое интервью,
// демо-версия и отзыв. Ответы сохраняются только на устройстве (settings.profile); текущий вес — обычной
// записью массы тела. Повторно открывается из «Ещё» (#/welcome).
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type ReactNode } from 'react';
import { db } from '../../data/db.ts';
import { countAll, saveEntity, setSetting } from '../../data/repo.ts';
import { parseDecimal } from '../../domain/form.ts';
import { defaultLevel, emptyLayout, PROFILE_KEY, QUESTIONS, SCENARIO_META, SCENARIOS, type Profile, type Question, type Scenario } from '../../domain/profile.ts';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { navigate } from '../../ui/router.ts';
import { saveProfile, useProfile } from './useProfile.ts';

const LAYOUT_KEY = 'dashboardLayout';

/**
 * true — новый пользователь (пустая база, приветствие не пройдено), false — нет, undefined — проверяем.
 * У тех, кто пользовался приложением до v0.9, профиль создаётся молча: полный режим, ничего не меняется.
 */
export function useFirstRun(): boolean | undefined {
  const state = useLiveQuery(async () => {
    if (await db.settings.get(PROFILE_KEY)) return 'done' as const;
    return (await countAll()) === 0 ? ('new' as const) : ('existing' as const);
  }, []);
  useEffect(() => {
    if (state === 'existing') void saveProfile({ scenario: 'wrestler', level: 'full', completedAt: new Date().toISOString(), hideFeedbackPrompt: true });
  }, [state]);
  return state === undefined ? undefined : state === 'new';
}

const SECTIONS: { icon: ReactNode; title: string; text: string }[] = [
  { icon: Icons.home, title: 'Главная', text: 'Сводка дня из карточек, которые вы выбираете сами: сон, готовность, питание, вес.' },
  { icon: Icons.food, title: 'Питание', text: 'Дневник КБЖУ, сканер штрихкодов, свои продукты и рецепты, вода.' },
  { icon: Icons.training, title: 'Тренировки', text: 'Программы, журнал подходов, упражнения с картинками, тесты.' },
  { icon: Icons.recovery, title: 'Восстановление', text: 'Сон, утренний чек-ин, готовность к тренировке и усталость мышц.' },
  { icon: Icons.season, title: 'Сезон', text: 'Старты, выход в вес, нагрузка и готовность по неделям.' },
];

type Answers = Partial<Record<Question['key'], string | string[]>>;

export function OnboardingPage({ replay = false }: { replay?: boolean }) {
  const prev = useProfile();
  const { notify } = useFeedback();
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);

  const weight = typeof answers.weightKg === 'string' ? parseDecimal(answers.weightKg) : undefined;
  const weightError = answers.weightKg && (weight === undefined || weight < 20 || weight > 300) ? 'Вес — число от 20 до 300' : null;
  const steps = 5;

  async function finish() {
    if (!scenario || busy) return;
    setBusy(true);
    const text = (k: Question['key']) => (typeof answers[k] === 'string' && (answers[k] as string).trim() ? (answers[k] as string).trim() : undefined);
    const interests = Array.isArray(answers.interests) && answers.interests.length ? answers.interests : undefined;
    const sameScenario = prev?.scenario === scenario;
    const profile: Profile = {
      scenario,
      level: sameScenario ? prev!.level : defaultLevel(scenario),
      // При повторном приветствии дата первого знакомства и скрытые подсказки сохраняются.
      completedAt: prev?.completedAt ?? new Date().toISOString(),
      ...(prev?.hideLevelHint && { hideLevelHint: true }),
      ...(prev?.hideFeedbackPrompt && { hideFeedbackPrompt: true }),
      ...(name.trim() && { name: name.trim().slice(0, 40) }),
      ...(text('goal') && { goal: text('goal') }),
      ...(text('sport') && { sport: text('sport') }),
      ...(text('weightCategory') && { weightCategory: text('weightCategory') }),
      ...(text('trainingsPerWeek') && { trainingsPerWeek: text('trainingsPerWeek') }),
      ...(interests && { interests }),
    };
    // Новому пользователю — пустая главная: виджеты он добавит сам (рекомендованные — первыми).
    // Повторное приветствие главную не трогает, меняются только рекомендации.
    if (!replay) await setSetting(LAYOUT_KEY, emptyLayout());
    if (weight !== undefined && !weightError) {
      const r = await saveEntity('bodyWeights', { measuredAt: new Date().toISOString(), weightKg: weight, notes: 'Из приветствия' });
      if (!r.ok) notify('Вес не сохранён — его можно добавить в «Сезоне».', 'error');
    }
    await saveProfile(profile);
    setBusy(false);
    navigate('/', true);
  }

  const next = () => setStep((s) => Math.min(steps - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const canNext = step !== 2 || scenario !== null;

  return (
    <div className="onboarding">
      <div className="onb-top">
        <div className="onb-dots" aria-label={`Шаг ${step + 1} из ${steps}`}>
          {Array.from({ length: steps }, (_, i) => (
            <span key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        {replay && (
          <button type="button" className="btn ghost small" onClick={() => navigate('/more', true)}>
            Закрыть
          </button>
        )}
      </div>

      <div key={step} className="onb-body route-anim">
        {step === 0 && (
          <>
            <span className="onb-badge">Демо-версия</span>
            <h1>Personal Athlete OS</h1>
            <p className="onb-lead">Личный дневник спортсмена: питание, тренировки, сон и восстановление, сезон — в одном приложении.</p>
            <ul className="onb-points">
              <li>Работает в браузере и офлайн, ставится на экран «Домой».</li>
              <li>Все записи хранятся только на этом устройстве — у каждого своё приложение по той же ссылке.</li>
              <li>Без рекламы, регистрации и платных функций.</li>
            </ul>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Что внутри</h2>
            <ul className="onb-sections">
              {SECTIONS.map((s) => (
                <li key={s.title}>
                  <span className="onb-icon">{s.icon}</span>
                  <span>
                    <b>{s.title}</b>
                    <span className="muted small">{s.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Кто вы?</h2>
            <p className="muted">От ответа зависят вопросы дальше и карточки на главной. Всё можно поменять позже.</p>
            <div className="onb-choices" role="radiogroup" aria-label="Кто вы">
              {SCENARIOS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={scenario === s}
                  className={`onb-choice${scenario === s ? ' selected' : ''}`}
                  onClick={() => {
                    if (s !== scenario) setAnswers({});
                    setScenario(s);
                  }}
                >
                  <b>{SCENARIO_META[s].title}</b>
                  <span className="muted small">{SCENARIO_META[s].text}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && scenario && (
          <>
            <h2>Пара вопросов</h2>
            <p className="muted">Все необязательные — можно пропустить.</p>
            <label className="field">
              <span className="label">Как к вам обращаться</span>
              <input className="input" value={name} maxLength={40} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
            </label>
            {QUESTIONS[scenario].map((q) => (
              <QuestionField key={q.key} q={q} value={answers[q.key]} error={q.key === 'weightKg' ? weightError : null} onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
            ))}
          </>
        )}

        {step === 4 && (
          <>
            <h2>Это демо-версия</h2>
            <p>
              Приложение в разработке: что-то может работать неидеально, а функции будут меняться. Попользуйтесь несколько дней — потом
              приложение попросит коротко рассказать, что понравилось и чего не хватает.
            </p>
            <ul className="onb-points">
              <li>Главная сначала пустая: нажмите «Добавить виджеты» — подходящие вам будут сверху.</li>
              <li>Чтобы данные не потерялись, время от времени делайте резервную копию: «Ещё» → «Резервная копия».</li>
              <li>На iPhone: «Поделиться» в Safari → «На экран „Домой“» — приложение откроется как обычное.</li>
              {scenario === 'general' && (!replay || prev?.scenario !== 'general') && (
                <li>Включён простой режим. Разделы для соревнующихся спортсменов открываются в «Ещё» → «Настройки».</li>
              )}
            </ul>
          </>
        )}
      </div>

      <div className="onb-actions">
        {step > 0 && (
          <button type="button" className="btn ghost" onClick={back}>
            Назад
          </button>
        )}
        {step < steps - 1 ? (
          <button type="button" className="btn primary big" disabled={!canNext || (step === 3 && !!weightError)} onClick={next}>
            {step === 0 ? 'Начать знакомство' : step === 2 && !scenario ? 'Выберите вариант' : 'Далее'}
          </button>
        ) : (
          <button type="button" className="btn primary big" disabled={busy} onClick={() => void finish()}>
            {replay ? 'Сохранить' : 'Перейти в приложение'}
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionField({ q, value, error, onChange }: { q: Question; value: string | string[] | undefined; error: string | null; onChange: (v: string | string[]) => void }) {
  if (q.kind === 'choice' || q.kind === 'multi') {
    const list = Array.isArray(value) ? value : [];
    return (
      <div className="field">
        <span className="label">{q.label}</span>
        <div className="chips" role="group" aria-label={q.label}>
          {q.options.map((o) => {
            const on = q.kind === 'multi' ? list.includes(o) : value === o;
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                className={`chip${on ? ' chip-selected' : ''}`}
                onClick={() => onChange(q.kind === 'multi' ? (on ? list.filter((x) => x !== o) : [...list, o]) : on ? '' : o)}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <label className="field">
      <span className="label">{q.label}</span>
      <input
        className="input"
        inputMode={q.kind === 'weight' ? 'decimal' : 'text'}
        placeholder={q.kind === 'text' ? q.placeholder : 'например, 72,5'}
        value={typeof value === 'string' ? value : ''}
        maxLength={20}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span className="error">{error}</span>}
    </label>
  );
}
