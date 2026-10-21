import { describe, expect, it } from 'vitest';
import { drafts } from '../test/fixtures.ts';
import { buildSummary, PROMPT_TEMPLATES, type SummaryData } from './summary.ts';

const meta = { createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z' };
const data: SummaryData = {
  meals: [{ ...drafts.meals, id: 'm1', foodName: 'Секретная каша', ...meta }],
  workouts: [{ ...drafts.workouts, id: 'w1', ...meta }],
  sleep: [{ ...drafts.sleep, id: 's1', ...meta }],
  competitions: [{ ...drafts.competitions, id: 'c1', ...meta }],
  bodyWeights: [{ ...drafts.bodyWeights, id: 'b1', ...meta }],
};
const range = { from: '2026-10-15', to: '2026-10-21', now: new Date('2026-10-21T09:00:00.000Z') };

describe('buildSummary', () => {
  it('включает только выбранные разделы', () => {
    const text = buildSummary(data, { ...range, sections: ['training'] });
    expect(text).toContain('## Тренировки');
    expect(text).toContain('Тестовая силовая');
    expect(text).toContain('100 кг ×5 RPE 8');
    expect(text).not.toContain('Секретная каша');
    expect(text).not.toContain('## Питание');
    expect(text).not.toContain('Тестовый турнир');
  });

  it('считает дневные итоги питания', () => {
    const text = buildSummary(data, { ...range, sections: ['nutrition'] });
    expect(text).toContain('274 ккал');
    expect(text).toContain('Секретная каша');
  });

  it('помечает сон как оценку по данным пользователя', () => {
    const text = buildSummary(data, { ...range, sections: ['recovery'] });
    expect(text).toContain('в постели 7 ч 30 мин');
    expect(text).toContain('оценка сна по моим данным 7 ч 10 мин');
  });

  it('добавляет ближайшее соревнование и массу тела', () => {
    const text = buildSummary(data, { ...range, sections: ['competition'] });
    expect(text).toContain('Тестовый турнир');
    expect(text).toContain('через 25 дней');
    expect(text).toContain('74,2 кг');
  });

  it('не включает записи вне периода', () => {
    const text = buildSummary(data, { from: '2026-09-01', to: '2026-09-30', sections: ['nutrition', 'training'] });
    expect(text).not.toContain('Секретная каша');
    expect(text).toContain('Записей питания за период нет.');
  });

  it('добавляет текст выбранного шаблона и правила безопасности', () => {
    const tpl = PROMPT_TEMPLATES.find((t) => t.id === 'nutrition')!;
    const text = buildSummary(data, { ...range, sections: [], templateId: tpl.id });
    expect(text.startsWith(tpl.text)).toBe(true);
    expect(text).toContain('не предлагай обезвоживание');
    expect(text).toContain('Разделы не выбраны.');
  });
});
