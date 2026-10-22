// Карта мышц со статусами в бело-чёрной гамме (без цвета): уровень 0 — без заливки, 1 — светло-серый,
// 2 — средний серый, 3 — почти чёрный; «болит» — штриховка поверх. Нажатие на группу определяет мышцу
// по прозрачности слоя рисунка (canvas), для дорисованных групп — по эллипсу.
import { useEffect, useRef, type MouseEvent } from 'react';
import { MUSCLES, type Muscle } from '../../domain/schemas.ts';
import { EXTRA, LAYERS, muscleUrl, type View } from '../../ui/BodyFigure.tsx';

export type Level = 0 | 1 | 2 | 3;

interface Props {
  levels: Partial<Record<Muscle, Level>>;
  sore?: readonly Muscle[];
  onPick?: (m: Muscle) => void;
  /** Подпись под каждой фигурой. */
  captions?: boolean;
}

// Кэш масок слоёв для проверки нажатия.
const masks = new Map<number, Promise<ImageData | null>>();

function layerMask(n: number): Promise<ImageData | null> {
  let p = masks.get(n);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 200;
        c.height = 362;
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, 200, 362);
        resolve(ctx.getImageData(0, 0, 200, 362));
      };
      img.onerror = () => resolve(null);
      img.src = muscleUrl(`main/muscle-${n}.svg`);
    });
    masks.set(n, p);
  }
  return p;
}

function inEllipse(x: number, y: number, [cx, cy, rx, ry, rot]: [number, number, number, number, number]): boolean {
  const a = (-rot * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const u = dx * Math.cos(a) - dy * Math.sin(a);
  const v = dx * Math.sin(a) + dy * Math.cos(a);
  return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1.4; // с запасом под палец
}

/** Какая мышца под точкой (координаты рисунка 200 × 362). */
async function muscleAt(view: View, x: number, y: number): Promise<Muscle | null> {
  for (const m of MUSCLES) for (const e of EXTRA[view][m] ?? []) if (inEllipse(x, y, e)) return m;
  for (const m of MUSCLES) {
    for (const n of LAYERS[view][m] ?? []) {
      const mask = await layerMask(n);
      if (!mask) continue;
      // Проверяем небольшую окрестность точки — по тонким мышцам трудно попасть пальцем.
      for (let dy = -3; dy <= 3; dy += 3)
        for (let dx = -3; dx <= 3; dx += 3) {
          const px = Math.round(x + dx);
          const py = Math.round(y + dy);
          if (px < 0 || py < 0 || px >= 200 || py >= 362) continue;
          if ((mask.data[(py * 200 + px) * 4 + 3] ?? 0) > 40) return m;
        }
    }
  }
  return null;
}

function FigureView({ view, levels, sore, onPick, caption }: { view: View; levels: Props['levels']; sore: readonly Muscle[]; onPick?: (m: Muscle) => void; caption?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // Заранее готовим маски, чтобы первое нажатие срабатывало сразу.
    if (onPick) for (const m of MUSCLES) for (const n of LAYERS[view][m] ?? []) void layerMask(n);
  }, [onPick, view]);

  async function click(e: MouseEvent) {
    if (!onPick || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const m = await muscleAt(view, ((e.clientX - r.left) / r.width) * 200, ((e.clientY - r.top) / r.height) * 362);
    if (m) onPick(m);
  }

  const layered = MUSCLES.flatMap((m) => (LAYERS[view][m] ?? []).map((n) => ({ m, n })));
  return (
    <span ref={ref} className={`anatomy-view status-map${onPick ? ' clickable' : ''}`} onClick={click}>
      <img className="status-base" src={muscleUrl(`${view}.svg`)} alt="" decoding="async" />
      {layered.map(({ m, n }) => {
        const lvl = levels[m] ?? 0;
        return (
          <span key={`${m}-${n}`}>
            {lvl > 0 && <img className={`status-lvl lvl-${lvl}`} src={muscleUrl(`main/muscle-${n}.svg`)} alt="" decoding="async" />}
            {sore.includes(m) && <span className="status-hatch" style={{ WebkitMaskImage: `url(${muscleUrl(`main/muscle-${n}.svg`)})`, maskImage: `url(${muscleUrl(`main/muscle-${n}.svg`)})` }} />}
          </span>
        );
      })}
      <svg viewBox="0 0 200 362" aria-hidden="true">
        <defs>
          <pattern id={`hatch-${view}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="#111" strokeWidth="1.6" />
          </pattern>
        </defs>
        {MUSCLES.flatMap((m) =>
          (EXTRA[view][m] ?? []).map((e, i) => (
            <g key={`${m}-${i}`}>
              {(levels[m] ?? 0) > 0 && <ellipse className={`status-ell lvl-${levels[m]}`} cx={e[0]} cy={e[1]} rx={e[2]} ry={e[3]} transform={`rotate(${e[4]} ${e[0]} ${e[1]})`} />}
              {sore.includes(m) && <ellipse fill={`url(#hatch-${view})`} cx={e[0]} cy={e[1]} rx={e[2]} ry={e[3]} transform={`rotate(${e[4]} ${e[0]} ${e[1]})`} />}
            </g>
          )),
        )}
      </svg>
      {caption && <span className="anatomy-caption">{view === 'front' ? 'спереди' : 'сзади'}</span>}
    </span>
  );
}

export function MuscleStatusMap({ levels, sore = [], onPick, captions = true }: Props) {
  return (
    <span className="body-figure views-2 status-figure">
      <FigureView view="front" levels={levels} sore={sore} onPick={onPick} caption={captions} />
      <FigureView view="back" levels={levels} sore={sore} onPick={onPick} caption={captions} />
    </span>
  );
}

/** Легенда: квадратики уровней и штриховка. */
export function StatusLegend({ items, hatch }: { items: { level: Level; label: string }[]; hatch?: string }) {
  return (
    <div className="status-legend">
      {items.map((i) => (
        <span key={i.level}>
          <i className={`sw lvl-${i.level}`} aria-hidden="true" />
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
