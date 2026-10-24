// Карта мышц во «Восстановлении»: вид «Усталость» (свежая / восстанавливается / утомлена) или
// «Нагрузка за неделю» (подходы за 7 дней), по мотивам openGym. Нажатие на мышцу или её название — карточка группы.
// v0.10: статусы цветом, пояснения спрятаны за «i», под фигурой — группы кнопками.
import { useState } from 'react';
import { saveCheckin } from '../../data/checkins.ts';
import { withoutMeta } from '../../data/repo.ts';
import { FATIGUE_LABEL, type FatigueStatus } from '../../domain/muscleFatigue.ts';
import { LARGE_MUSCLES, MUSCLE_LABEL } from '../../domain/muscles.ts';
import type { Muscle } from '../../domain/schemas.ts';
import { formatDateTime } from '../../domain/time.ts';
import { InfoButton, InfoPanel, Modal, Segmented } from '../../ui/components.tsx';
import { MuscleChips, MuscleStatusMap, StatusLegend, type StatusTone } from './MuscleStatusMap.tsx';
import type { ReadinessState } from './useReadiness.ts';

type Mode = 'fatigue' | 'balance';
const STATUS_TONE: Record<FatigueStatus, StatusTone> = { fresh: 'fresh', recovering: 'recovering', fatigued: 'fatigued' };
const balanceTone = (sets: number): StatusTone | undefined => (sets <= 0 ? undefined : sets < 4 ? 'lvl-1' : sets < 10 ? 'lvl-2' : 'lvl-3');
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function MuscleFatigueCard({ state }: { state: ReadinessState }) {
  const [mode, setMode] = useState<Mode>('fatigue');
  const [open, setOpen] = useState<Muscle | null>(null);
  const [info, setInfo] = useState(false);
  const sore = state.todayCheckin?.soreMuscles ?? [];
  const tones: Partial<Record<Muscle, StatusTone>> = {};
  for (const l of Object.values(state.loads)) {
    // «Свежая» подсвечивается только у мышц, которые были в журнале: без данных фигура остаётся спокойной.
    const t = mode === 'fatigue' ? (l.status === 'fresh' && !l.lastTrainedAt ? undefined : STATUS_TONE[l.status]) : balanceTone(l.weeklySets);
    if (t) tones[l.muscle] = t;
  }
  const anyData = Object.values(state.loads).some((l) => l.lastTrainedAt);

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>Мышцы</h3>
        <div className="card-title-aside">
          <Segmented
            label="Вид карты"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'fatigue', label: 'Усталость' },
              { value: 'balance', label: 'Нагрузка' },
            ]}
          />
          <InfoButton open={info} onToggle={() => setInfo((o) => !o)} label="как считается" />
        </div>
      </div>
      {info && (
        <InfoPanel>
          <p>
            Усталость — по журналу: подходы с учётом близости к отказу (RPE; без него — среднее значение), спад за {state.config.recoveryHoursSmall} ч у малых групп и{' '}
            {state.config.recoveryHoursLarge} ч у крупных. «Нагрузка» — подходы за 7 дней.
          </p>
          <p className="muted">Грубое правило, не измерение: если вносятся не все тренировки, «свежая» может быть неточной. Нажмите на мышцу или на её название — откроется подробно.</p>
        </InfoPanel>
      )}
      <MuscleStatusMap tones={tones} sore={sore} onPick={setOpen} />
      {mode === 'fatigue' ? (
        <StatusLegend
          items={[
            { tone: 'fresh', label: 'свежая' },
            { tone: 'recovering', label: 'восстанавливается' },
            { tone: 'fatigued', label: 'утомлена' },
          ]}
          hatch="болит"
        />
      ) : (
        <StatusLegend
          items={[
            { tone: 'lvl-1', label: 'до 4' },
            { tone: 'lvl-2', label: '4–10' },
            { tone: 'lvl-3', label: '10+ подходов' },
          ]}
          hatch="болит"
        />
      )}
      <MuscleChips tones={tones} onPick={setOpen} />
      {!anyData && <p className="small muted">Тренировок с подходами за последние дни нет — все мышцы свежие.</p>}
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
