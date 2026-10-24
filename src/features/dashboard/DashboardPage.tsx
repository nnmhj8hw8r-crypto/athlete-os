// Главная: настраиваемая сводка из виджетов (по образцу Lift Card). Пользователь включает и выключает
// виджеты, меняет порядок и период графиков — настройка в settings.dashboardLayout.
// Кнопки добавления — только у карточек сна и чек-ина (v0.9), остальное вносится во вкладках разделов.
// В простом режиме виджеты соревнующегося спортсмена скрыты, вместо них — подсказка о полном режиме.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../data/db.ts';
import { setSetting } from '../../data/repo.ts';
import {
  DEFAULT_LAYOUT,
  normalizeLayout,
  swapWidgets,
  updateWidget,
  WIDGET_HINT,
  WIDGET_LABEL,
  WIDGET_PERIODS,
  type WidgetConfig,
  type WidgetId,
} from '../../domain/dashboard.ts';
import { FULL_ONLY_WIDGETS, recommendedWidgets, revealFullWidgets, shouldAskFeedback, type Profile } from '../../domain/profile.ts';
import { countAll } from '../../data/repo.ts';
import { SHARE_MESSAGE, shareApp } from '../../ui/share.ts';
import { useFeedback } from '../../ui/feedback.tsx';
import { sumNutrients } from '../../domain/nutrition.ts';
import { estimatedSleepMinutes, RATING_FIELDS, RATING_META, timeInBedMinutes } from '../../domain/sleep.ts';
import { WORKOUT_FORMAT_LABEL, WORKOUT_TYPE_LABEL } from '../../domain/training.ts';
import { formatDateKey, formatDateTime, formatDuration, toDateKey, todayKey } from '../../domain/time.ts';
import { Card, Modal, Page, Segmented } from '../../ui/components.tsx';
import { Icons } from '../../ui/icons.tsx';
import { href, navigate } from '../../ui/router.ts';
import { MacroGrid } from '../nutrition/MacroGrid.tsx';
import { SleepChart, SleepStrip, WellbeingChart, type Period } from '../recovery/RecoveryCharts.tsx';
import { saveProfile, useFeedbackUrl, useProfile } from '../onboarding/useProfile.ts';
import { CheckinDialog } from '../recovery/CheckinDialog.tsx';
import { MuscleFatigueCard } from '../recovery/MuscleFatigueCard.tsx';
import { ReadinessCard } from '../recovery/ReadinessCard.tsx';
import { SleepHero, usePendingSleep } from '../recovery/SleepHero.tsx';
import { useReadiness } from '../recovery/useReadiness.ts';
import { NextCompetitionCard, WeightChartCard, type WPeriod } from '../season/SeasonCards.tsx';
import { WeeklyReadinessCard } from '../season/WeeklyReadinessCard.tsx';

const LAYOUT_KEY = 'dashboardLayout';

function useLayout(): [WidgetConfig[] | undefined, (next: WidgetConfig[]) => void] {
  const raw = useLiveQuery(async () => (await db.settings.get(LAYOUT_KEY)) ?? null, []);
  const layout = raw === undefined ? undefined : normalizeLayout(raw?.value);
  return [layout, (next) => void setSetting(LAYOUT_KEY, next)];
}

export function DashboardPage() {
  const today = todayKey();
  const [layout, save] = useLayout();
  const profile = useProfile();
  const basic = profile?.level === 'basic';
  const [editing, setEditing] = useState(false);
  const allowed = layout?.filter((w) => !basic || !FULL_ONLY_WIDGETS.includes(w.id));
  const visible = allowed?.filter((w) => w.visible) ?? [];
  const setPeriod = (w: WidgetConfig) => (p: string) => layout && save(updateWidget(layout, w.id, { period: p }));

  return (
    <Page
      title={profile?.name ? `Привет, ${profile.name}` : 'Сегодня'}
      subtitle={formatDateKey(today, true)}
      actions={
        <button type="button" className="round-btn" aria-label="Настроить главную" onClick={() => setEditing(true)}>
          {Icons.edit}
        </button>
      }
    >
      {basic && profile && !profile.hideLevelHint && layout && (
        <div className="notice info level-hint">
          <span>
            Включён <b>простой режим</b>. Хотите посмотреть всё, что приложение умеет для спортсменов: сезон, старты, нагрузку по неделям? Режим можно сменить в
            любой момент в «Ещё» → «Настройки».
          </span>
          <div className="row">
            <button
              type="button"
              className="btn small primary"
              onClick={() => {
                void saveProfile({ ...profile, level: 'full' });
                save(revealFullWidgets(layout));
              }}
            >
              Включить полный режим
            </button>
            <button type="button" className="btn small ghost" onClick={() => void saveProfile({ ...profile, hideLevelHint: true })}>
              Скрыть
            </button>
          </div>
        </div>
      )}
      {profile && layout && <FeedbackPrompt profile={profile} />}
      {layout === undefined ? (
        <p className="muted">Загрузка…</p>
      ) : visible.length === 0 ? (
        <section className="hero-card add-widgets">
          <span className="hero-label">Главная</span>
          <b className="readiness-title">Соберите свою сводку</b>
          <span className="muted">Выберите карточки, которые хотите видеть каждый день: сон, готовность, питание, вес и другие.</span>
          <button type="button" className="btn primary big" onClick={() => setEditing(true)}>
            {Icons.plus} {profile ? 'Рекомендации для вас' : 'Добавить виджеты'}
          </button>
        </section>
      ) : (
        visible.map((w) => (
          <div key={w.id} className="widget">
            {w.id === 'sleepNow' && <SleepHero />}
            {w.id === 'readiness' && <ReadinessWidget />}
            {w.id === 'muscles' && <MusclesWidget />}
            {w.id === 'trainingLoad' && <WeeklyReadinessCard />}
            {w.id === 'competition' && <NextCompetitionCard link />}
            {w.id === 'weight' && <WeightChartCard link period={w.period as WPeriod} onPeriodChange={setPeriod(w)} />}
            {w.id === 'sleep' && <SleepWidget period={w.period as Period} onPeriodChange={setPeriod(w)} />}
            {w.id === 'wellbeing' && <WellbeingChart period={w.period as Period} onPeriodChange={setPeriod(w)} />}
            {w.id === 'sleepStrip' && (
              <div className="chart-card">
                <div className="chart-head">
                  <h3>
                    <a href={href('/recovery')}>Записи сна за 14 дней</a>
                  </h3>
                </div>
                <SleepStrip />
              </div>
            )}
            {w.id === 'nutrition' && <NutritionWidget />}
            {w.id === 'trainings' && <TrainingsWidget />}
          </div>
        ))
      )}
      {editing && layout && allowed && (
        <CustomizeDialog
          layout={layout}
          shown={allowed}
          recommended={profile ? recommendedWidgets(profile).filter((id) => allowed.some((w) => w.id === id)) : []}
          save={save}
          onClose={() => setEditing(false)}
        />
      )}
    </Page>
  );
}

/** Просьба об отзыве после нескольких дней использования (не при знакомстве) + «Поделиться». */
function FeedbackPrompt({ profile }: { profile: Profile }) {
  const records = useLiveQuery(async () => (await countAll()) - (await db.settings.count()), []);
  const url = useFeedbackUrl();
  const { notify } = useFeedback();
  if (records === undefined || !shouldAskFeedback(profile, new Date(), records)) return null;
  return (
    <section className="hero-card">
      <span className="hero-label">Демо-версия</span>
      <b className="readiness-title">Как вам приложение?</b>
      <span className="muted">
        Расскажите, что понравилось и чего не хватает, — это 2–3 минуты (внешняя форма Tally, ваши записи в неё не попадают). И поделитесь приложением с
        друзьями, если оно вам пригодилось.
      </span>
      <div className="row">
        <a className="btn primary" href={url} target="_blank" rel="noreferrer">
          Оставить отзыв
        </a>
        <button
          type="button"
          className="btn"
          onClick={() => void shareApp().then((r) => SHARE_MESSAGE[r] && notify(SHARE_MESSAGE[r]!, r === 'failed' ? 'error' : 'info'))}
        >
          Поделиться
        </button>
        <button type="button" className="btn ghost" onClick={() => void saveProfile({ ...profile, hideFeedbackPrompt: true })}>
          Скрыть
        </button>
      </div>
    </section>
  );
}

function ReadinessWidget() {
  const readiness = useReadiness();
  const [checkin, setCheckin] = useState(false);
  if (!readiness) return null;
  return (
    <>
      <ReadinessCard state={readiness} onCheckin={() => setCheckin(true)} onSettings={() => navigate('/recovery')} />
      {checkin && <CheckinDialog date={readiness.today} existing={readiness.todayCheckin} onClose={() => setCheckin(false)} />}
    </>
  );
}

function MusclesWidget() {
  const readiness = useReadiness();
  return readiness ? <MuscleFatigueCard state={readiness} /> : null;
}

function SleepWidget({ period, onPeriodChange }: { period?: Period; onPeriodChange: (p: Period) => void }) {
  const lastSleep = useLiveQuery(() => db.sleep.orderBy('wakeTime').last(), []);
  const pendingSleep = usePendingSleep();
  const today = todayKey();
  return (
    <div className="stack">
      {pendingSleep && (
        <a className="notice info small" href={href('/recovery')}>
          Сон начат {formatDateTime(pendingSleep)} — отметьте пробуждение.
        </a>
      )}
      {lastSleep && (
        <p className="small muted">
          Последняя ночь ({toDateKey(lastSleep.wakeTime) === today ? 'сегодня' : formatDateTime(lastSleep.wakeTime)}): в постели{' '}
          <b>{formatDuration(timeInBedMinutes(lastSleep.bedtime, lastSleep.wakeTime) ?? 0)}</b>
          {estimatedSleepMinutes(lastSleep) !== null && <>, оценка сна {formatDuration(estimatedSleepMinutes(lastSleep)!)}</>}
          {RATING_FIELDS.some((k) => lastSleep[k] !== undefined) &&
            ` · ${RATING_FIELDS.filter((k) => lastSleep[k] !== undefined)
              .map((k) => `${RATING_META[k].label.toLowerCase()} ${lastSleep[k]}/5`)
              .join(', ')}`}
        </p>
      )}
      <SleepChart period={period} onPeriodChange={onPeriodChange} />
    </div>
  );
}

function NutritionWidget() {
  const today = todayKey();
  const meals = useLiveQuery(() => db.meals.where('date').equals(today).toArray(), [today]);
  return (
    <Card
      title="Питание сегодня"
      aside={
        <a className="small" href={href('/nutrition')}>
          Дневник
        </a>
      }
    >
      {meals === undefined ? null : meals.length ? (
        <>
          <MacroGrid n={sumNutrients(meals.map((m) => m.nutrients))} />
          <p className="small muted">Записей: {meals.length}</p>
        </>
      ) : (
        <p className="muted">Сегодня ещё ничего не записано. Добавьте еду во вкладке «Питание».</p>
      )}
    </Card>
  );
}

function TrainingsWidget() {
  const workouts = useLiveQuery(() => db.workouts.orderBy('startAt').reverse().limit(3).toArray(), []);
  return (
    <Card
      title="Последние тренировки"
      aside={
        <a className="small" href={href('/training?tab=journal')}>
          Журнал
        </a>
      }
    >
      {workouts === undefined ? null : workouts.length ? (
        <ul className="list">
          {workouts.map((w) => (
            <li key={w.id}>
              <b>{w.title}</b>
              <div className="small muted">
                {formatDateTime(w.startAt)} · {w.format ? WORKOUT_FORMAT_LABEL[w.format] : WORKOUT_TYPE_LABEL[w.type]}
                {w.durationMin !== undefined && ` · ${formatDuration(w.durationMin)}`}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Тренировок пока нет. Начните во вкладке «Тренировки».</p>
      )}
    </Card>
  );
}

/** layout — весь список (сохраняется целиком), shown — то, что доступно в текущем режиме. */
function CustomizeDialog({
  layout,
  shown,
  recommended,
  save,
  onClose,
}: {
  layout: WidgetConfig[];
  shown: WidgetConfig[];
  recommended: WidgetId[];
  save: (l: WidgetConfig[]) => void;
  onClose: () => void;
}) {
  const toAdd = recommended.filter((id) => !shown.find((w) => w.id === id)?.visible);
  const showAll = (ids: WidgetId[]) => {
    let next = layout;
    for (const id of ids) next = updateWidget(next, id, { visible: true });
    save(next);
  };
  // Новому пользователю (главная пуста) сначала показываем только рекомендации, полный список — по кнопке.
  const [showList, setShowList] = useState(() => shown.some((w) => w.visible) || toAdd.length === 0);
  return (
    <Modal
      title={toAdd.length && !shown.some((w) => w.visible) ? 'Рекомендации для вас' : 'Настроить главную'}
      onClose={onClose}
      footer={
        <>
          {showList && (
            <button type="button" className="btn ghost" onClick={() => save(DEFAULT_LAYOUT.map((w) => ({ ...w })))}>
              Сбросить
            </button>
          )}
          <button type="button" className="btn primary" onClick={onClose}>
            Готово
          </button>
        </>
      }
    >
      {toAdd.length > 0 && (
        <div className="recommended">
          <div className="row-between">
            {/* В режиме «только рекомендации» заголовок окна уже говорит то же самое. */}
            {showList ? <b>Рекомендуем для вас</b> : <span />}
            <button type="button" className="btn small primary" onClick={() => showAll(toAdd)}>
              Добавить все
            </button>
          </div>
          <p className="small muted">Подобраны по ответам в приветствии. Лишнее потом легко убрать.</p>
          <ul className="rec-list">
            {toAdd.map((id) => (
              <li key={id}>
                <span className="grow">
                  <b>{WIDGET_LABEL[id]}</b>
                  <span className="small muted">{WIDGET_HINT[id]}</span>
                </span>
                <button type="button" className="btn small" aria-label={`Добавить: ${WIDGET_LABEL[id]}`} onClick={() => showAll([id])}>
                  {Icons.plus}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!showList ? (
        <button type="button" className="btn ghost" onClick={() => setShowList(true)}>
          Все виджеты ({shown.length})
        </button>
      ) : (
        <>
          <p className="small muted">Включайте и выключайте виджеты, меняйте порядок стрелками и выбирайте период графиков.</p>
          <ul className="widget-list">
            {shown.map((w, i) => {
              const periods = WIDGET_PERIODS[w.id];
              return (
                <li key={w.id} className={`widget-row${w.visible ? '' : ' off'}`}>
                  <label className="switch">
                    <input type="checkbox" checked={w.visible} onChange={(e) => save(updateWidget(layout, w.id, { visible: e.target.checked }))} />
                    <span className="switch-track" aria-hidden="true" />
                    <span className="widget-text">
                      <span className="widget-name">{WIDGET_LABEL[w.id]}</span>
                      <span className="small muted">{WIDGET_HINT[w.id]}</span>
                    </span>
                  </label>
                  <div className="widget-move">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={i === 0}
                      aria-label={`Выше: ${WIDGET_LABEL[w.id]}`}
                      onClick={() => save(swapWidgets(layout, w.id, shown[i - 1]!.id))}
                    >
                      {Icons.arrowUp}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={i === shown.length - 1}
                      aria-label={`Ниже: ${WIDGET_LABEL[w.id]}`}
                      onClick={() => save(swapWidgets(layout, w.id, shown[i + 1]!.id))}
                    >
                      {Icons.arrowDown}
                    </button>
                  </div>
                  {periods && w.visible && (
                    <div className="widget-period">
                      <Segmented
                        label={`Период: ${WIDGET_LABEL[w.id]}`}
                        value={w.period ?? periods[0]!.value}
                        onChange={(p) => save(updateWidget(layout, w.id, { period: p }))}
                        options={periods}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
