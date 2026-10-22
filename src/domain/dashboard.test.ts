import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, moveWidget, normalizeLayout, swapWidgets, updateWidget, WIDGET_IDS } from './dashboard.ts';

describe('виджеты главной', () => {
  it('пустая или испорченная настройка → по умолчанию', () => {
    expect(normalizeLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout('мусор')).toEqual(DEFAULT_LAYOUT);
  });

  it('сохраняет порядок пользователя, убирает лишнее, ставит новые виджеты на их место по умолчанию', () => {
    const r = normalizeLayout([
      { id: 'trainings', visible: false },
      { id: 'weight', visible: true, period: '90' },
      { id: 'weight', visible: false },
      { id: 'unknown', visible: true },
      { id: 'sleep', period: '7' },
    ]);
    expect(r.filter((w) => ['trainings', 'weight', 'sleep'].includes(w.id))).toEqual([
      { id: 'trainings', visible: false },
      { id: 'weight', visible: true, period: '90' },
      { id: 'sleep', visible: true, period: '14' },
    ]);
    expect(r.map((w) => w.id).sort()).toEqual([...WIDGET_IDS].sort());
  });

  it('новый виджет встаёт после своего соседа, а не в конец', () => {
    const old = ['competition', 'weight', 'sleep', 'wellbeing', 'sleepStrip', 'nutrition', 'trainings'].map((id) => ({ id, visible: true }));
    const r = normalizeLayout(old).map((w) => w.id);
    expect(r.slice(0, 2)).toEqual(['sleepNow', 'readiness']);
    expect(r.slice(-2)).toEqual(['muscles', 'trainingLoad']);
  });

  it('перемещение и изменение', () => {
    const l = normalizeLayout(undefined);
    expect(moveWidget(l, 'weight', -1).slice(2, 4).map((w) => w.id)).toEqual(['weight', 'competition']);
    expect(moveWidget(l, 'sleepNow', -1)).toEqual(l);
    expect(moveWidget(l, 'trainingLoad', 1)).toEqual(l);
    const sw = swapWidgets(l, 'readiness', 'weight').map((w) => w.id);
    expect([sw[1], sw[3]]).toEqual(['weight', 'readiness']);
    expect(updateWidget(l, 'nutrition', { visible: false }).find((w) => w.id === 'nutrition')?.visible).toBe(false);
  });
});
