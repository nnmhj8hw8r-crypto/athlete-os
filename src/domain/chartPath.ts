// Путь линии графика: прямыми отрезками или плавной кривой.
// Плавная кривая — монотонная кубическая интерполяция (Fritsch — Carlson): проходит через все точки
// и не выходит выше максимума и ниже минимума соседних значений, то есть не рисует того, чего нет в данных.

export type XY = [number, number];
export type ChartLineStyle = 'smooth' | 'straight';

const f = (n: number) => (Math.round(n * 10) / 10).toString();

export function linePath(pts: readonly XY[], style: ChartLineStyle): string {
  if (pts.length === 0) return '';
  const [x0, y0] = pts[0]!;
  if (pts.length === 1) return `M${f(x0)},${f(y0)}`;
  if (style === 'straight' || pts.length === 2) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)},${f(y)}`).join(' ');

  const n = pts.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1]![0] - pts[i]![0];
    dx.push(h);
    slope.push(h === 0 ? 0 : (pts[i + 1]![1] - pts[i]![1]) / h);
  }
  // Касательные в точках.
  const m: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    m.push(a * b <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) / ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b));
  }
  m.push(slope[n - 2]!);

  let d = `M${f(x0)},${f(y0)}`;
  for (let i = 0; i < n - 1; i++) {
    const [xa, ya] = pts[i]!;
    const [xb, yb] = pts[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${f(xa + h)},${f(ya + m[i]! * h)} ${f(xb - h)},${f(yb - m[i + 1]! * h)} ${f(xb)},${f(yb)}`;
  }
  return d;
}
