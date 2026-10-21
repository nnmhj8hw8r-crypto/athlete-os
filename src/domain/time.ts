// Работа с датами в заданном часовом поясе (по умолчанию Europe/Moscow).
// Моменты времени хранятся как ISO-строки в UTC, календарные дни — как 'YYYY-MM-DD'
// в часовом поясе приложения. Так данные не «сдвигаются», если телефон окажется в другом поясе.
import { APP_LOCALE, APP_TIME_ZONE } from '../config.ts';

export type DateKey = string; // 'YYYY-MM-DD'

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partsFormatterCache.set(timeZone, f);
  }
  return f;
}

export function getZonedParts(date: Date, timeZone = APP_TIME_ZONE): ZonedParts {
  const map: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  return {
    year: map.year ?? 0,
    month: map.month ?? 0,
    day: map.day ?? 0,
    hour: map.hour ?? 0,
    minute: map.minute ?? 0,
    second: map.second ?? 0,
  };
}

/** Смещение пояса относительно UTC в миллисекундах для конкретного момента. */
function offsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Календарный день момента времени в поясе приложения. */
export function toDateKey(value: Date | string, timeZone = APP_TIME_ZONE): DateKey {
  const p = getZonedParts(typeof value === 'string' ? new Date(value) : value, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayKey(now: Date = new Date(), timeZone = APP_TIME_ZONE): DateKey {
  return toDateKey(now, timeZone);
}

export function addDays(key: DateKey, days: number): DateKey {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Разница в календарных днях: b − a. */
export function diffDays(a: DateKey, b: DateKey): number {
  const toUtc = (k: DateKey) => {
    const [y, m, d] = k.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** ISO (UTC) → значение для <input type="datetime-local"> в поясе приложения. */
export function toLocalInputValue(iso: string, timeZone = APP_TIME_ZONE): string {
  const p = getZonedParts(new Date(iso), timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Значение <input type="datetime-local"> ('YYYY-MM-DDTHH:mm'), понимаемое как время
 * в поясе приложения → ISO-строка в UTC. Возвращает null для некорректного ввода.
 */
export function fromLocalInputValue(value: string, timeZone = APP_TIME_ZONE): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0)) as number[] as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (!isValidDateKey(`${m[1]}-${m[2]}-${m[3]}`) || h > 23 || mi > 59 || s > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off1 = offsetMs(new Date(guess), timeZone);
  let ts = guess - off1;
  const off2 = offsetMs(new Date(ts), timeZone);
  if (off2 !== off1) ts = guess - off2;
  return new Date(ts).toISOString();
}

/** Сдвигает значение datetime-local на целое число дней, сохраняя время суток. */
export function shiftLocalInputDays(value: string, days: number): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!m || !isValidDateKey(m[1]!)) return null;
  return `${addDays(m[1]!, days)}T${m[2]}`;
}

function format(iso: string | Date, options: Intl.DateTimeFormatOptions, timeZone = APP_TIME_ZONE) {
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone, ...options }).format(
    typeof iso === 'string' ? new Date(iso) : iso,
  );
}

export function formatDateTime(iso: string, timeZone = APP_TIME_ZONE): string {
  return format(iso, { day: 'numeric', month: 'short', weekday: 'short', hour: '2-digit', minute: '2-digit' }, timeZone);
}

export function formatTime(iso: string, timeZone = APP_TIME_ZONE): string {
  return format(iso, { hour: '2-digit', minute: '2-digit' }, timeZone);
}

/** Человекочитаемая дата календарного дня, например «вт, 21 октября». */
export function formatDateKey(key: DateKey, withYear = false): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/** Склонение: plural(5, ['день', 'дня', 'дней']). */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
