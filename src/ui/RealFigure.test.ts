import { describe, expect, it } from 'vitest';
import { MUSCLES } from '../domain/schemas.ts';
import { muscleAt } from './RealFigure.tsx';

// Разметка 10 × 10: слева грудные (1), справа дельты (2), рамка — фон (255).
function grid(): { w: number; h: number; label: Uint8Array } {
  const w = 10;
  const h = 10;
  const label = new Uint8Array(w * h).fill(255);
  for (let y = 1; y < 9; y++) for (let x = 1; x < 9; x++) label[y * w + x] = x < 5 ? 1 : 2;
  label[5 * w + 5] = 0; // «не мышца» внутри
  return { w, h, label };
}

describe('реалистичная фигура: выбор мышцы по разметке', () => {
  it('под пальцем — ровно та мышца, что нарисована в этом месте', () => {
    expect(muscleAt(grid(), 0.25, 0.5, 0)).toBe(MUSCLES[0]);
    expect(muscleAt(grid(), 0.75, 0.5, 0)).toBe(MUSCLES[1]);
  });

  it('рядом с контуром выбирается ближайшая мышца, далеко от фигуры — ничего', () => {
    expect(muscleAt(grid(), 0.5, 0.5, 2)).toBe(MUSCLES[1]);
    expect(muscleAt(grid(), 0, 0, 0)).toBeNull();
  });
});
