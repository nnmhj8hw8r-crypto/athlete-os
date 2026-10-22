import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, moveWidget, normalizeLayout, updateWidget, WIDGET_IDS } from './dashboard.ts';

describe('виджеты главной', () => {
  it('пустая или испорченная настройка → по умолчанию', () => {
    expect(normalizeLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout('мусор')).toEqual(DEFAULT_LAYOUT);
  });

  it('сохраняет порядок пользователя, убирает лишнее, добавляет новые виджеты в конец', () => {
    const r = normalizeLayout([
      { id: 'trainings', visible: false },
      { id: 'weight', visible: true, period: '90' },
      { id: 'weight', visible: false },
      { id: 'unknown', visible: true },
      { id: 'sleep', period: '7' },
    ]);
    expect(r.slice(0, 3)).toEqual([
      { id: 'trainings', visible: false },
      { id: 'weight', visible: true, period: '90' },
      { id: 'sleep', visible: true, period: '14' },
    ]);
    expect(r.map((w) => w.id).sort()).toEqual([...WIDGET_IDS].sort());
  });

  it('перемещение и изменение', () => {
    const l = normalizeLayout(undefined);
    expect(moveWidget(l, 'weight', -1).slice(0, 2).map((w) => w.id)).toEqual(['weight', 'competition']);
    expect(moveWidget(l, 'competition', -1)).toEqual(l);
    expect(moveWidget(l, 'trainings', 1)).toEqual(l);
    expect(updateWidget(l, 'nutrition', { visible: false }).find((w) => w.id === 'nutrition')?.visible).toBe(false);
  });
});
