// Календарь сезона: ближайший старт и отсчёт дней в часовом поясе приложения.
import { APP_TIME_ZONE } from '../config.ts';
import type { Competition, CompetitionStatus } from './schemas.ts';
import { diffDays, plural, shiftLocalInputDays, toDateKey, todayKey } from './time.ts';

export const COMPETITION_STATUS_LABEL: Record<CompetitionStatus, string> = {
  planned: 'Запланировано',
  registered: 'Заявлен',
  completed: 'Завершено',
  cancelled: 'Отменено',
};

const ACTIVE_STATUSES: ReadonlySet<CompetitionStatus> = new Set(['planned', 'registered']);

/** Сколько календарных дней (по Москве) осталось до даты события. 0 — сегодня. */
export function daysUntil(iso: string, now: Date = new Date(), timeZone = APP_TIME_ZONE): number {
  return diffDays(todayKey(now, timeZone), toDateKey(iso, timeZone));
}

export function formatCountdown(days: number): string {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days > 1) return `через ${days} ${plural(days, ['день', 'дня', 'дней'])}`;
  const ago = -days;
  return ago === 1 ? 'вчера' : `${ago} ${plural(ago, ['день', 'дня', 'дней'])} назад`;
}

/**
 * Ближайшее предстоящее соревнование (запланировано или заявлен).
 * Соревнование остаётся «ближайшим» весь день старта.
 */
export function nextCompetition(
  list: readonly Competition[],
  now: Date = new Date(),
  timeZone = APP_TIME_ZONE,
): Competition | undefined {
  const today = todayKey(now, timeZone);
  return [...list]
    .filter((c) => ACTIVE_STATUSES.has(c.status) && toDateKey(c.startAt, timeZone) >= today)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
}

/**
 * Предложение для поля взвешивания: за день до старта в то же время.
 * Это только подсказка — в форму подставляется по кнопке, а не автоматически.
 */
export function suggestWeighIn(startLocalInput: string): string | null {
  return shiftLocalInputDays(startLocalInput, -1);
}

export function sortCompetitions(list: readonly Competition[]): Competition[] {
  return [...list].sort((a, b) => a.startAt.localeCompare(b.startAt));
}
