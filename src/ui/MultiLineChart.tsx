// Несколько линий на одном графике; линии различаются типом (сплошная / пунктир / точки), а не цветом.
import { useId } from 'react';
import { linePath } from '../domain/chartPath.ts';
import { useChartStyle } from './chartStyle.ts';

export interface Series {
  label: string;
  dash: 'solid' | 'dashed' | 'dotted';
  points: { x: number; y: number }[];
}

const W = 600;
const H = 200;
const PAD = { l: 40, r: 12, t: 12, b: 26 };
const DASH = { solid: undefined, dashed: '10 6', dotted: '2 6' } as const;

export function MultiLineChart({ series, formatX, label }: { series: Series[]; formatX: (x: number) => string; label: string }) {
  const titleId = useId();
  const style = useChartStyle();
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return <p className="muted small">Недостаточно данных для графика.</p>;
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  let minY = Math.min(0, ...all.map((p) => p.y));
  let maxY = Math.max(...all.map((p) => p.y));
  const pad = Math.max((maxY - minY) * 0.1, 1);
  minY -= pad;
  maxY += pad;
  const sx = (x: number) => PAD.l + ((x - minX) / (maxX - minX || 1)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - (y - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);
  return (
    <figure className="multi-chart">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`${label}: ${series.map((s) => s.label).join(', ')}`}</title>
        {minY < 0 && <line className="axis zero" x1={PAD.l} x2={W - PAD.r} y1={sy(0)} y2={sy(0)} />}
        {[minY + pad, maxY - pad].map((t) => (
          <text key={t} x={PAD.l - 6} y={sy(t) + 4} textAnchor="end">
            {Math.round(t)}
          </text>
        ))}
        {series.map((s) => (
          <path key={s.label} className="line" d={linePath(s.points.map((p) => [sx(p.x), sy(p.y)]), style)} strokeDasharray={DASH[s.dash]} />
        ))}
        <text x={PAD.l} y={H - 6}>
          {formatX(minX)}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end">
          {formatX(maxX)}
        </text>
      </svg>
      <figcaption className="line-legend">
        {series.map((s) => (
          <span key={s.label}>
            <svg viewBox="0 0 28 6" aria-hidden="true">
              <line x1="1" y1="3" x2="27" y2="3" strokeDasharray={s.dash === 'solid' ? undefined : s.dash === 'dashed' ? '6 4' : '1.5 4'} />
            </svg>
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
