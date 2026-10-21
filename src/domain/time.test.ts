import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  formatDuration,
  fromLocalInputValue,
  isValidDateKey,
  plural,
  shiftLocalInputDays,
  toDateKey,
  toLocalInputValue,
} from './time.ts';

describe('часовой пояс Europe/Moscow', () => {
  it('переводит московское время из поля ввода в UTC', () => {
    expect(fromLocalInputValue('2026-03-15T10:00')).toBe('2026-03-15T07:00:00.000Z');
  });

  it('обратное преобразование даёт исходное значение поля', () => {
    expect(toLocalInputValue('2026-03-15T07:00:00.000Z')).toBe('2026-03-15T10:00');
  });

  it('относит 00:30 по Москве к новому календарному дню', () => {
    expect(toDateKey('2026-10-20T21:30:00.000Z')).toBe('2026-10-21');
  });

  it('учитывает переход на летнее время в других поясах', () => {
    expect(fromLocalInputValue('2026-07-01T12:00', 'America/New_York')).toBe('2026-07-01T16:00:00.000Z');
    expect(fromLocalInputValue('2026-01-15T12:00', 'America/New_York')).toBe('2026-01-15T17:00:00.000Z');
  });

  it('отклоняет некорректный ввод', () => {
    expect(fromLocalInputValue('')).toBeNull();
    expect(fromLocalInputValue('2026-02-30T10:00')).toBeNull();
    expect(fromLocalInputValue('2026-02-10T25:00')).toBeNull();
  });
});

describe('календарные дни', () => {
  it('проверяет формат даты', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2028-02-29')).toBe(true);
    expect(isValidDateKey('21.10.2026')).toBe(false);
  });

  it('прибавляет дни через границу месяца и года', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('считает разницу в днях', () => {
    expect(diffDays('2026-10-21', '2026-11-15')).toBe(25);
    expect(diffDays('2026-10-21', '2026-10-20')).toBe(-1);
  });

  it('сдвигает значение поля даты и времени', () => {
    expect(shiftLocalInputDays('2026-03-01T09:00', -1)).toBe('2026-02-28T09:00');
    expect(shiftLocalInputDays('мусор', -1)).toBeNull();
  });
});

describe('форматирование', () => {
  it('длительность', () => {
    expect(formatDuration(450)).toBe('7 ч 30 мин');
    expect(formatDuration(45)).toBe('45 мин');
    expect(formatDuration(120)).toBe('2 ч');
  });

  it('склонение', () => {
    const f: [string, string, string] = ['день', 'дня', 'дней'];
    expect(plural(1, f)).toBe('день');
    expect(plural(3, f)).toBe('дня');
    expect(plural(5, f)).toBe('дней');
    expect(plural(11, f)).toBe('дней');
    expect(plural(21, f)).toBe('день');
    expect(plural(112, f)).toBe('дней');
  });
});
