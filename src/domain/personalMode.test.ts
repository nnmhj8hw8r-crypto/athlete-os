import { describe, expect, it } from 'vitest';
import { normalizePersonalMode, SUPPLEMENT_FACTS } from './personalMode.ts';

describe('личный режим', () => {
  it('включён только при enabled=true и дате согласия', () => {
    expect(normalizePersonalMode({ enabled: true, acceptedAt: '2026-10-24T10:00:00.000Z' })).toEqual({ enabled: true, acceptedAt: '2026-10-24T10:00:00.000Z' });
    expect(normalizePersonalMode({ enabled: true })).toBeNull();
    expect(normalizePersonalMode({ enabled: 'yes', acceptedAt: 'x' })).toBeNull();
    expect(normalizePersonalMode(undefined)).toBeNull();
  });

  it('у каждой добавки есть схема, доказательность, риск и оговорки; нет запрещённых и рецептурных веществ', () => {
    for (const f of SUPPLEMENT_FACTS) {
      expect([f.effect, f.protocol, f.evidence, f.cautions].every((t) => t.length > 10)).toBe(true);
      expect(['низкий', 'умеренный', 'высокий']).toContain(f.risk);
    }
    expect(SUPPLEMENT_FACTS.map((f) => f.id)).toEqual(['caffeine', 'creatine', 'beta-alanine', 'bicarbonate', 'nitrate']);
  });
});
