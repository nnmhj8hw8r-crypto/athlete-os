import { describe, expect, it } from 'vitest';
import { sleepEntrySchema } from './schemas.ts';
import type { SleepEntry } from './schemas.ts';
import { estimatedSleepMinutes, recoveryAverages, sleepDays, timeInBedMinutes } from './sleep.ts';

const bed = '2026-10-20T20:30:00.000Z'; // 23:30 МСК
const wake = '2026-10-21T04:00:00.000Z'; // 07:00 МСК

describe('timeInBedMinutes', () => {
  it('считает промежуток через полночь', () => {
    expect(timeInBedMinutes(bed, wake)).toBe(450);
  });

  it('возвращает null, если пробуждение раньше отхода ко сну', () => {
    expect(timeInBedMinutes(wake, bed)).toBeNull();
  });

  it('возвращает null для промежутка больше суток и мусора', () => {
    expect(timeInBedMinutes(bed, '2026-10-22T05:00:00.000Z')).toBeNull();
    expect(timeInBedMinutes('abc', wake)).toBeNull();
  });
});

describe('estimatedSleepMinutes', () => {
  it('вычитает засыпание и ночные пробуждения', () => {
    expect(estimatedSleepMinutes({ bedtime: bed, wakeTime: wake, sleepLatencyMin: 20, wakeDuringNightMin: 15 })).toBe(415);
  });

  it('работает, если указана только одна оценка', () => {
    expect(estimatedSleepMinutes({ bedtime: bed, wakeTime: wake, sleepLatencyMin: 30 })).toBe(420);
  });

  it('не выдаёт время в постели за сон, если оценок нет', () => {
    expect(estimatedSleepMinutes({ bedtime: bed, wakeTime: wake })).toBeNull();
  });
});

describe('схема записи сна', () => {
  const base = { id: '1', bedtime: bed, wakeTime: wake, createdAt: wake, updatedAt: wake };

  it('принимает корректную запись', () => {
    expect(sleepEntrySchema.safeParse(base).success).toBe(true);
  });

  it('отклоняет пробуждение раньше сна', () => {
    const r = sleepEntrySchema.safeParse({ ...base, bedtime: wake, wakeTime: bed });
    expect(r.success).toBe(false);
  });

  it('отклоняет оценки длиннее времени в постели', () => {
    expect(sleepEntrySchema.safeParse({ ...base, sleepLatencyMin: 300, wakeDuringNightMin: 200 }).success).toBe(false);
  });

  it('отклоняет оценку самочувствия вне шкалы 1–5', () => {
    expect(sleepEntrySchema.safeParse({ ...base, wellbeing: 6 }).success).toBe(false);
    expect(sleepEntrySchema.safeParse({ ...base, wellbeing: 2.5 }).success).toBe(false);
  });
});

describe('recoveryAverages', () => {
  it('считает средние только по заполненным значениям', () => {
    const entries = [
      { id: '1', bedtime: bed, wakeTime: wake, wellbeing: 4, createdAt: wake, updatedAt: wake },
      { id: '2', bedtime: bed, wakeTime: '2026-10-21T03:00:00.000Z', wellbeing: 3, fatigue: 2, createdAt: wake, updatedAt: wake },
    ];
    expect(recoveryAverages(entries)).toEqual({
      count: 2,
      timeInBedMin: 420,
      wellbeing: 3.5,
      fatigue: 2,
      soreness: null,
      motivation: null,
    });
  });

  it('для пустого списка возвращает null', () => {
    expect(recoveryAverages([]).wellbeing).toBeNull();
  });
});

describe('sleepDays', () => {
  const e = (id: string, bed: string, wake: string, wellbeing?: number): SleepEntry => ({
    id, bedtime: bed, wakeTime: wake, wellbeing, createdAt: wake, updatedAt: wake,
  });
  it('ряд по дням с пропусками, дневной сон суммируется, оценка — из последней записи', () => {
    const list = [
      e('a', '2026-10-19T20:00:00.000Z', '2026-10-20T04:00:00.000Z', 3),
      e('b', '2026-10-20T10:00:00.000Z', '2026-10-20T11:00:00.000Z', 4),
      e('c', '2026-10-21T21:00:00.000Z', '2026-10-22T04:30:00.000Z'),
    ];
    const days = sleepDays(list, '2026-10-20', '2026-10-23');
    expect(days.map((d) => d.date)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
    expect(days[0]).toMatchObject({ inBedMin: 540, wellbeing: 4 });
    expect(days[1]).toMatchObject({ inBedMin: null, wellbeing: null });
    expect(days[2]).toMatchObject({ inBedMin: 450, wellbeing: null });
  });
});
