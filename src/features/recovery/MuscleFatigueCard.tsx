// Карта мышц во «Восстановлении»: вид «Усталость» (свежая / восстанавливается / утомлена) или
// «Нагрузка за неделю» (подходы за 7 дней), по мотивам openGym. Нажатие — карточка группы.
import { useState } from 'react';
import { saveCheckin } from '../../data/checkins.ts';
import { withoutMeta } from '../../data/repo.ts';
import { FATIGUE_LABEL, type FatigueStatus } from '../../domain/muscleFatigue.ts';
import { LARGE_MUSCLES, MUSCLE_LABEL } from '../../domain/muscles.ts';
import type { Muscle } from '../../domain/schemas.ts';
import { formatDateTime } from '../../domain/time.ts';
import { Modal, Segmented } from '../../ui/components.tsx';
import { MuscleStatusMap, StatusLegend, type Level } from './MuscleStatusMap.tsx';
import type { ReadinessState } from './useReadiness.ts';

type Mode = 'fatigue' | 'balance';
const STATUS_LEVEL: Record<FatigueStatus, Level> = { fresh: 0, recovering: 2, fatigued: 3 };
const balanceLevel = (sets: number): Level => (sets <= 0 ? 0 : sets < 4 ? 1 : sets < 10 ? 2 : 3);
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function MuscleFatigueCard({ state }: { state: ReadinessState }) {
  const [mode, setMode] = useState<Mode>('fatigue');
  const [open, setOpen] = useState<Muscle | null>(null);
  const sore = state.todayCheckin?.soreMuscles ?? [];
  const levels = Object.fromEntries(
    Object.values(state.loads).map((l) => [l.muscle, mode === 'fatigue' ? STATUS_LEVEL[l.status] : balanceLevel(l.weeklySets)]),
  ) as Record<Muscle, Level>;
  const anyData = Object.values(state.loads).some((l) => l.lastTrainedAt);

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>Мышцы</h3>
        <Segmented
          label="Вид карты"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'fatigue', label: 'Усталость' },
            { value: 'balance', label: 'Нагрузка' },
          ]}
        />
      </div>
      <MuscleStatusMap levels={levels} sore={sore} onPick={setOpen} />
      {mode === 'fatigue' ? (
        <StatusLegend
          items={[
            { level: 0, label: 'свежая' },
            { level: 2, label: 'восстанавливается' },
            { level: 3, label: 'утомлена' },
          ]}
          hatch="болит (чек-ин)"
        />
      ) : (
        <StatusLegend
          items={[
            { level: 0, label: '0' },
            { level: 1, label: 'до 4' },
            { level: 2, label: '4–10' },
            { level: 3, label: '10+ подходов за 7 дней' },
          ]}
          hatch="болит"
        />
      )}
      {state.recovering.length > 0 && mode === 'fatigue' && (
        <p className="small">
          Восстанавливаются:{' '}
          {state.recovering.map((m, i) => (
            <span key={m}>
              {i > 0 && ', '}
              <button type="button" className="link-btn" onClick={() => setOpen(m)}>
                {MUSCLE_LABEL[m]}
              </button>
            </span>
          ))}
        </p>
      )}
      <p className="small muted">
        {anyData
          ? `Оценка по журналу: подходы с учётом близости к отказу (RPE; если не указан — усреднённое значение), спад за ${state.config.recoveryHoursSmall} ч (малые группы) и ${state.config.recoveryHoursLarge} ч (крупные). Пороги статусов условные. Грубое правило, не измерение: если вносятся не все тренировки, «свежая» может быть неточной.`
          : 'В журнале за последние дни нет тренировок с подходами — все группы показаны свежими.'}
      </p>
      {open && <MuscleDialog muscle={open} state={state} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MuscleDialog({ muscle, state, onClose }: { muscle: Muscle; state: ReadinessState; onClose: () => void }) {
  const l = state.loads[muscle];
  const sore = state.todayCheckin?.soreMuscles.includes(muscle) ?? false;
  async function toggleSore() {
    const c = state.todayCheckin;
    const list = c?.soreMuscles ?? [];
    const next = sore ? list.filter((m) => m !== muscle) : [...list, muscle];
    await saveCheckin({ ...(c ? withoutMeta(c) : {}), date: state.today, soreMuscles: next });
  }
  const recovery = LARGE_MUSCLES.has(muscle) ? state.config.recoveryHoursLarge : state.config.recoveryHoursSmall;
  return (
    <Modal title={MUSCLE_LABEL[muscle][0]!.toUpperCase() + MUSCLE_LABEL[muscle].slice(1)} onClose={onClose} size="sheet">
      <div className="stat-row">
        <div>
          <b>{FATIGUE_LABEL[l.status]}</b>
          <span>статус</span>
        </div>
        <div>
          <b className="num">{r1(l.weeklySets)}</b>
          <span>подходов за 7 дней</span>
        </div>
      </div>
      <p>Последняя тренировка: {l.lastTrainedAt ? formatDateTime(l.lastTrainedAt) : 'за последние дни нет в журнале'}</p>
      <p className="small muted">Время восстановления этой группы в настройках: {recovery} ч.</p>
      <label className="switch">
        <input type="checkbox" checked={sore} onChange={() => void toggleSore()} />
        <span className="switch-track" aria-hidden="true" />
        <span className="widget-name">Болит сегодня</span>
      </label>
      <p className="small muted">Отметка попадает в сегодняшний чек-ин и учитывается в оценке готовности.</p>
    </Modal>
  );
}
