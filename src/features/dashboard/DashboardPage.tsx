// Главная: настраиваемая сводка из виджетов (по образцу Lift Card). Пользователь включает и выключает
// виджеты, меняет порядок и период графиков — настройка в settings.dashboardLayout.
// Кнопок добавления нет — для этого есть вкладки разделов.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../data/db.ts';
import { setSetting } from '../../data/repo.ts';
import type { ChartLineStyle } from '../../domain/chartPath.ts';
import { DEFAULT_LAYOUT, moveWidget, normalizeLayout, updateWidget, WIDGET_LABEL, WIDGET_PERIODS, type WidgetConfig } from '../../domain/dashboard.ts';
import { sumNutrients } from '../../domain/nutrition.ts';
import { estimatedSleepMinutes, RATING_FIELDS, RATING_META, timeInBedMinutes } from '../../domain/sleep.ts';
import { WORKOUT_FORMAT_LABEL, WORKOUT_TYPE_LABEL } from '../../domain/training.ts';
import { formatDateKey, formatDateTime, formatDuration, toDateKey, todayKey } from '../../domain/time.ts';
import { setChartStyle, useChartStyle } from '../../ui/chartStyle.ts';
import { Card, EmptyState, Modal, Page, Segmented } from '../../ui/components.tsx';
import { Icons } from '../../ui/icons.tsx';
import { href } from '../../ui/router.ts';
import { MacroGrid } from '../nutrition/MacroGrid.tsx';
import { SleepChart, SleepStrip, WellbeingChart, type Period } from '../recovery/RecoveryCharts.tsx';
import { usePendingSleep } from '../recovery/RecoveryPage.tsx';
import { NextCompetitionCard, WeightChartCard, type WPeriod } from '../season/SeasonCards.tsx';

const LAYOUT_KEY = 'dashboardLayout';

function useLayout(): [WidgetConfig[] | undefined, (next: WidgetConfig[]) => void] {
  const raw = useLiveQuery(async () => (await db.settings.get(LAYOUT_KEY)) ?? null, []);
  const layout = raw === undefined ? undefined : normalizeLayout(raw?.value);
  return [layout, (next) => void setSetting(LAYOUT_KEY, next)];
}

export function DashboardPage() {
  const today = todayKey();
  const [layout, save] = useLayout();
  const [editing, setEditing] = useState(false);
  const visible = layout?.filter((w) => w.visible) ?? [];
  const setPeriod = (w: WidgetConfig) => (p: string) => layout && save(updateWidget(layout, w.id, { period: p }));

  return (
    <Page
      title="Сегодня"
      subtitle={formatDateKey(today, true)}
      actions={
        <button type="button" className="round-btn" aria-label="Настроить главную" onClick={() => setEditing(true)}>
          {Icons.edit}
        </button>
      }
    >
      {layout === undefined ? (
        <p className="muted">Загрузка…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          action={
            <button type="button" className="btn primary" onClick={() => setEditing(true)}>
              Выбрать виджеты
            </button>
          }
        >
          Все виджеты скрыты.
        </EmptyState>
      ) : (
        visible.map((w) => (
          <div key={w.id} className="widget">
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
      {editing && layout && <CustomizeDialog layout={layout} save={save} onClose={() => setEditing(false)} />}
    </Page>
  );
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
    <Card title="Питание сегодня" aside={<a className="small" href={href('/nutrition')}>Дневник</a>}>
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
    <Card title="Последние тренировки" aside={<a className="small" href={href('/training?tab=journal')}>Журнал</a>}>
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

function CustomizeDialog({ layout, save, onClose }: { layout: WidgetConfig[]; save: (l: WidgetConfig[]) => void; onClose: () => void }) {
  const chartStyle = useChartStyle();
  return (
    <Modal
      title="Настроить главную"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={() => save(DEFAULT_LAYOUT.map((w) => ({ ...w })))}>
            Сбросить
          </button>
          <button type="button" className="btn primary" onClick={onClose}>
            Готово
          </button>
        </>
      }
    >
      <p className="small muted">Включайте и выключайте виджеты, меняйте порядок стрелками и выбирайте период графиков.</p>
      <ul className="widget-list">
        {layout.map((w, i) => {
          const periods = WIDGET_PERIODS[w.id];
          return (
            <li key={w.id} className={`widget-row${w.visible ? '' : ' off'}`}>
              <label className="switch">
                <input type="checkbox" checked={w.visible} onChange={(e) => save(updateWidget(layout, w.id, { visible: e.target.checked }))} />
                <span className="switch-track" aria-hidden="true" />
                <span className="widget-name">{WIDGET_LABEL[w.id]}</span>
              </label>
              <div className="widget-move">
                <button type="button" className="icon-btn" disabled={i === 0} aria-label={`Выше: ${WIDGET_LABEL[w.id]}`} onClick={() => save(moveWidget(layout, w.id, -1))}>
                  {Icons.arrowUp}
                </button>
                <button type="button" className="icon-btn" disabled={i === layout.length - 1} aria-label={`Ниже: ${WIDGET_LABEL[w.id]}`} onClick={() => save(moveWidget(layout, w.id, 1))}>
                  {Icons.arrowDown}
                </button>
              </div>
              {periods && w.visible && (
                <div className="widget-period">
                  <Segmented label={`Период: ${WIDGET_LABEL[w.id]}`} value={w.period ?? periods[0]!.value} onChange={(p) => save(updateWidget(layout, w.id, { period: p }))} options={periods} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="field">
        <span className="label">Линии графиков</span>
        <Segmented<ChartLineStyle>
          label="Линии графиков"
          value={chartStyle}
          onChange={(s) => void setChartStyle(s)}
          options={[
            { value: 'smooth', label: 'Плавные' },
            { value: 'straight', label: 'Прямые' },
          ]}
        />
      </div>
    </Modal>
  );
}
