import { describe, expect, it } from 'vitest';
import type { Supplement } from './schemas.ts';
import { dosesForDay, isActiveOn, normalizeLog, reminderKey, supplementIcs, toggleDose } from './supplements.ts';

const base = { createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', dose: 5, doseUnit: 'г' };
const creatine: Supplement = { ...base, id: 'a', name: 'Креатин', times: ['20:00', '08:00'] };
const vitD: Supplement = { ...base, id: 'b', name: 'Витамин D', dose: 2000, doseUnit: 'МЕ', endDate: '2026-10-20' };

describe('добавки', () => {
  it('приёмы дня — по времени, без времени — в конце, закончившиеся не показываются', () => {
    const doses = dosesForDay([creatine, { ...vitD, endDate: undefined }], '2026-10-24');
    expect(doses.map((d) => d.key)).toEqual(['a@08:00', 'a@20:00', 'b@']);
    expect(dosesForDay([vitD], '2026-10-24')).toEqual([]);
    expect(isActiveOn(vitD, '2026-10-20')).toBe(true);
  });

  it('отметка приёма переключается, старые дни удаляются', () => {
    let log = toggleDose({ '2026-07-01': ['a@08:00'] }, '2026-10-24', 'a@08:00');
    expect(log).toEqual({ '2026-10-24': ['a@08:00'] });
    log = toggleDose(log, '2026-10-24', 'a@08:00');
    expect(log).toEqual({});
    expect(normalizeLog({ '2026-10-24': ['x', 1], bad: ['y'] })).toEqual({ '2026-10-24': ['x'] });
  });

  it('ключ напоминания отличается по дням, но одинаков в пределах дня', () => {
    expect(reminderKey('2026-10-24', 'a@08:00')).not.toBe(reminderKey('2026-10-25', 'a@08:00'));
    expect(reminderKey('2026-10-24', 'a@08:00')).toBe(reminderKey('2026-10-24', 'a@08:00'));
  });

  it('файл календаря: событие на каждое время, ежедневно, до даты окончания', () => {
    const text = supplementIcs({ ...creatine, endDate: '2026-11-30' }, '2026-10-24', '20261024T000000Z');
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text).toContain('DTSTART:20261024T200000');
    expect(text).toContain('RRULE:FREQ=DAILY;UNTIL=20261130T235959');
    expect(text).toContain('SUMMARY:Креатин — 5 г');
  });
});
