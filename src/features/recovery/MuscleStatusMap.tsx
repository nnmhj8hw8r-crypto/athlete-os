// Карта мышц со статусами (v0.10): реалистичная фигура с точной разметкой мышц; статус — цветом
// (усталость: зелёный / жёлтый / оранжевый, нагрузка — оттенки синего), «болит» — красными полосами.
// Под фигурой — список групп кнопками: по ним выбирать надёжнее, чем пальцем по рисунку (особенно мелкие мышцы).
import { MUSCLE_LABEL } from '../../domain/muscles.ts';
import { MUSCLES, type Muscle } from '../../domain/schemas.ts';
import { RealFigure, type Tone } from '../../ui/RealFigure.tsx';
import { useProfile } from '../onboarding/useProfile.ts';

export type StatusTone = Exclude<Tone, 'primary' | 'secondary' | 'sore' | 'selected'>;

interface Props {
  tones?: Partial<Record<Muscle, StatusTone>>;
  sore?: readonly Muscle[];
  onPick?: (m: Muscle) => void;
  /** Подпись под каждой фигурой. */
  captions?: boolean;
}

export function MuscleStatusMap({ tones = {}, sore = [], onPick, captions = true }: Props) {
  const sex = useProfile()?.sex ?? 'male';
  const marks: Partial<Record<Muscle, Tone[]>> = {};
  for (const m of MUSCLES) {
    const t: Tone[] = [];
    const tone = tones[m];
    if (tone) t.push(tone);
    if (sore.includes(m)) t.push('sore');
    if (t.length) marks[m] = t;
  }
  return <RealFigure sex={sex} marks={marks} onPick={onPick} captions={captions} className="status-real" title="Состояние мышц" />;
}

/** Группы мышц кнопками; точка слева — цвет статуса. */
export function MuscleChips({ tones = {}, selected = [], onPick }: { tones?: Partial<Record<Muscle, StatusTone>>; selected?: readonly Muscle[]; onPick: (m: Muscle) => void }) {
  return (
    <div className="chips muscle-chips">
      {MUSCLES.map((m) => {
        const on = selected.includes(m);
        return (
          <button key={m} type="button" className={`chip${on ? ' chip-selected' : ''}`} aria-pressed={selected.length ? on : undefined} onClick={() => onPick(m)}>
            {tones[m] && <i className={`sw ${tones[m]}`} aria-hidden="true" />}
            {MUSCLE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}

/** Легенда: цветные квадратики и полосы «болит». */
export function StatusLegend({ items, hatch }: { items: { tone: StatusTone | 'none'; label: string }[]; hatch?: string }) {
  return (
    <div className="status-legend">
      {items.map((i) => (
        <span key={i.tone}>
          <i className={`sw ${i.tone === 'none' ? 'lvl-0' : i.tone}`} aria-hidden="true" />
          {i.label}
        </span>
      ))}
      {hatch && (
        <span>
          <i className="sw hatch" aria-hidden="true" />
          {hatch}
        </span>
      )}
    </div>
  );
}
