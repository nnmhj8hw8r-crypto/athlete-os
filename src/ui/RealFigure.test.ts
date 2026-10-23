import { describe, expect, it } from 'vitest';
import { MUSCLES } from '../domain/schemas.ts';
import { hasArea, muscleAtPoint } from './RealFigure.tsx';

describe('реалистичная фигура', () => {
  it('каждая мышца есть хотя бы на одной стороне — у мужской и у женской фигуры', () => {
    for (const sex of ['male', 'female'] as const)
      for (const m of MUSCLES) expect(hasArea(sex, 'front', m) || hasArea(sex, 'back', m), `${sex}: ${m}`).toBe(true);
  });

  it('нажатие определяет мышцу по области, мимо фигуры — ничего', () => {
    expect(muscleAtPoint('male', 'front', 39, 25)).toBe('chest');
    expect(muscleAtPoint('female', 'back', 35, 45)).toBe('glutes');
    expect(muscleAtPoint('male', 'front', 3, 3)).toBeNull();
  });
});
