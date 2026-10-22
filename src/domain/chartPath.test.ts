import { describe, expect, it } from 'vitest';
import { linePath, type XY } from './chartPath.ts';

/** Значение кубической кривой Безье в параметре t. */
const bez = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;

describe('linePath', () => {
  const pts: XY[] = [[0, 10], [10, 20], [20, 20], [30, 5]];

  it('прямые отрезки', () => {
    expect(linePath(pts, 'straight')).toBe('M0,10 L10,20 L20,20 L30,5');
    expect(linePath([], 'smooth')).toBe('');
    expect(linePath([[1, 2]], 'smooth')).toBe('M1,2');
  });

  it('плавная кривая проходит через все точки и не выходит за соседние значения', () => {
    const d = linePath(pts, 'smooth');
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(nums.slice(0, 2)).toEqual([0, 10]);
    const segs = d.split(' C').slice(1).map((s) => s.split(/[ ,]/).map(Number));
    let prev: XY = [0, 10];
    segs.forEach((s, i) => {
      const end: XY = [s[4]!, s[5]!];
      expect(end).toEqual(pts[i + 1]);
      const lo = Math.min(prev[1], end[1]);
      const hi = Math.max(prev[1], end[1]);
      for (let t = 0; t <= 1; t += 0.1) {
        const y = bez(prev[1], s[1]!, s[3]!, end[1], t);
        expect(y).toBeGreaterThanOrEqual(lo - 0.05);
        expect(y).toBeLessThanOrEqual(hi + 0.05);
      }
      prev = end;
    });
  });
});
