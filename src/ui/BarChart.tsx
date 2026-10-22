// Столбчатый график на SVG: по дню на столбик, пустые дни — без столбика (нет данных ≠ 0).
import { useId } from 'react';

export interface Bar {
  key: string;
  value: number | null;
  /** Подпись под столбиком (показываются первая, последняя и каждая N-я). */
  label: string;
}

interface Props {
  bars: Bar[];
  label: string;
  formatValue: (v: number) => string;
}

const W = 600;
const H = 180;
const PAD = { l: 8, r: 8, t: 22, b: 22 };

export function BarChart({ bars, label, formatValue }: Props) {
  const titleId = useId();
  const values = bars.flatMap((b) => (b.value === null ? [] : [b.value]));
  if (values.length === 0) return <p className="muted small">За этот период записей нет.</p>;
  const max = Math.max(...values);
  const slot = (W - PAD.l - PAD.r) / bars.length;
  const bw = Math.max(2, slot * 0.62);
  const h = (v: number) => (max ? (v / max) * (H - PAD.t - PAD.b) : 0);
  const every = Math.ceil(bars.length / 7);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const avgY = H - PAD.b - h(avg);

  return (
    <svg className="chart bar-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId}>
      <title id={titleId}>{`${label}: записей ${values.length}, в среднем ${formatValue(avg)}`}</title>
      <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
      {bars.map((b, i) => {
        const x = PAD.l + i * slot + (slot - bw) / 2;
        return (
          <g key={b.key}>
            {b.value !== null && <rect className="bar" x={x} y={H - PAD.b - h(b.value)} width={bw} height={Math.max(1, h(b.value))} rx={Math.min(4, bw / 2)} />}
            {(i % every === 0 || i === bars.length - 1) && (
              <text x={x + bw / 2} y={H - 6} textAnchor="middle">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
      <line className="ref" x1={PAD.l} x2={W - PAD.r} y1={avgY} y2={avgY} />
      <text x={W - PAD.r} y={Math.max(12, avgY - 5)} textAnchor="end">
        в среднем {formatValue(avg)}
      </text>
    </svg>
  );
}
