import { describe, expect, it } from 'vitest';
import { daysUntil, formatCountdown, nextCompetition, suggestWeighIn } from './competition.ts';
import type { Competition } from './schemas.ts';

const make = (over: Partial<Competition>): Competition => ({
  id: 'x',
  sport: 'judo',
  weightCategory: '-73',
  name: 'Турнир',
  startAt: '2026-11-15T07:00:00.000Z',
  weighInAt: '2026-11-14T15:00:00.000Z',
  status: 'planned',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('daysUntil', () => {
  it('считает календарные дни по Москве, а не по UTC', () => {
    // Сейчас 21 октября 00:30 МСК (в UTC ещё 20 октября), старт 22 октября 09:00 МСК.
    const now = new Date('2026-10-20T21:30:00.000Z');
    expect(daysUntil('2026-10-22T06:00:00.000Z', now)).toBe(1);
  });

  it('возвращает 0 в день старта', () => {
    const now = new Date('2026-11-15T05:00:00.000Z');
    expect(daysUntil('2026-11-15T07:00:00.000Z', now)).toBe(0);
  });

  it('считает несколько недель', () => {
    expect(daysUntil('2026-11-15T07:00:00.000Z', new Date('2026-10-21T09:00:00.000Z'))).toBe(25);
  });
});

describe('formatCountdown', () => {
  it('подписывает дни по-русски', () => {
    expect(formatCountdown(0)).toBe('сегодня');
    expect(formatCountdown(1)).toBe('завтра');
    expect(formatCountdown(3)).toBe('через 3 дня');
    expect(formatCountdown(21)).toBe('через 21 день');
    expect(formatCountdown(25)).toBe('через 25 дней');
    expect(formatCountdown(-2)).toBe('2 дня назад');
  });
});

describe('nextCompetition', () => {
  const now = new Date('2026-10-21T09:00:00.000Z');

  it('выбирает ближайшее активное событие', () => {
    const list = [
      make({ id: 'later', startAt: '2026-12-01T07:00:00.000Z' }),
      make({ id: 'cancelled', startAt: '2026-10-25T07:00:00.000Z', status: 'cancelled' }),
      make({ id: 'past', startAt: '2026-10-01T07:00:00.000Z' }),
      make({ id: 'soon', startAt: '2026-11-01T07:00:00.000Z', status: 'registered' }),
    ];
    expect(nextCompetition(list, now)?.id).toBe('soon');
  });

  it('оставляет соревнование ближайшим в течение дня старта', () => {
    const list = [make({ id: 'today', startAt: '2026-10-21T06:00:00.000Z' })];
    expect(nextCompetition(list, now)?.id).toBe('today');
  });

  it('возвращает undefined, если предстоящих нет', () => {
    expect(nextCompetition([make({ status: 'completed' })], now)).toBeUndefined();
  });
});

describe('suggestWeighIn', () => {
  it('предлагает день перед стартом в то же время', () => {
    expect(suggestWeighIn('2026-11-15T10:00')).toBe('2026-11-14T10:00');
    expect(suggestWeighIn('2026-03-01T09:00')).toBe('2026-02-28T09:00');
  });

  it('возвращает null для пустого поля', () => {
    expect(suggestWeighIn('')).toBeNull();
  });
});
