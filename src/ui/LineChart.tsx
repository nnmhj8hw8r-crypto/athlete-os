// Простой линейный график на SVG. Используется для массы тела и рабочих весов.
import { useId } from 'react';
import { linePath } from '../domain/chartPath.ts';
import { useChartStyle } from './chartStyle.ts';

export interface ChartPoint {
  x: number; // время, мс
  y: number;
}

interface Props {
  points: ChartPoint[];
  unit: string;
  label: string;
  reference?: { y: number; label: string };
  formatX: (x: number) => string;
  /** Нажатие по графику — ближайшая точка (x). */
  onPick?: (x: number) => void;
  /** Выбранная точка — подсвечивается. */
  selected?: number;
}

const W = 600;
const H = 200;
const PAD = { l: 44, r: 12, t: 12, b: 26 };

export function LineChart({ points, unit, label, reference, formatX, onPick, selected }: Props) {
  const titleId = useId();
  const gradId = useId();
  const style = useChartStyle();
  if (points.length < 2) {
    return <p className="muted small">Для графика нужно хотя бы две записи.</p>;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y).concat(reference ? [reference.y] : []);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  const padY = Math.max((maxY - minY) * 0.15, 0.5);
  minY -= padY;
  maxY += padY;
  const sx = (x: number) => PAD.l + ((x - minX) / (maxX - minX || 1)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - (y - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);
  const path = linePath(points.map((p) => [sx(p.x), sy(p.y)]), style);
  const area = `${path} L${sx(maxX).toFixed(1)},${H - PAD.b} L${sx(minX).toFixed(1)},${H - PAD.b} Z`;
  const ticks = [minY + padY, (minY + maxY) / 2, maxY - padY];
  const last = points[points.length - 1]!;
  const first = points[0]!;

  return (
    <svg
      className={`chart${onPick ? ' pickable' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby={titleId}
      onClick={
        onPick
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const vx = ((e.clientX - r.left) / r.width) * W;
              const best = points.reduce((a, p) => (Math.abs(sx(p.x) - vx) < Math.abs(sx(a.x) - vx) ? p : a), points[0]!);
              onPick(best.x);
            }
          : undefined
      }
    >
      <title id={titleId}>
        {`${label}: от ${first.y.toLocaleString('ru-RU')} ${unit} (${formatX(first.x)}) до ${last.y.toLocaleString('ru-RU')} ${unit} (${formatX(last.x)}), записей: ${points.length}`}
      </title>
      {ticks.map((t) => (
        <g key={t}>
          <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} opacity={0.6} />
          <text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end">
            {(Math.round(t * 10) / 10).toLocaleString('ru-RU')}
          </text>
        </g>
      ))}
      {reference && (
        <g>
          <line className="ref" x1={PAD.l} x2={W - PAD.r} y1={sy(reference.y)} y2={sy(reference.y)} />
          <text x={W - PAD.r} y={sy(reference.y) - 4} textAnchor="end">
            {reference.label}
          </text>
        </g>
      )}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="area-top" />
          <stop offset="100%" className="area-bottom" />
        </linearGradient>
      </defs>
      <path className="area" d={area} fill={`url(#${gradId})`} />
      <path className="line" d={path} />
      {points.length <= 31 &&
        points.map((p) => <circle key={p.x} className="dot" cx={sx(p.x)} cy={sy(p.y)} r={p === last ? 4.5 : 2.5} />)}
      {points.length > 31 && <circle className="dot" cx={sx(last.x)} cy={sy(last.y)} r={4.5} />}
      {selected !== undefined &&
        points
          .filter((p) => p.x === selected)
          .map((p) => (
            <g key="sel">
              <line className="axis" x1={sx(p.x)} x2={sx(p.x)} y1={PAD.t} y2={H - PAD.b} />
              <circle className="dot selected" cx={sx(p.x)} cy={sy(p.y)} r={6.5} />
            </g>
          ))}
      <text x={PAD.l} y={H - 6}>
        {formatX(minX)}
      </text>
      <text x={W - PAD.r} y={H - 6} textAnchor="end">
        {formatX(maxX)}
      </text>
    </svg>
  );
}
