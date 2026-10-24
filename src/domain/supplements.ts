// Добавки (v0.10): что принимать сегодня, отметки «принял» и напоминание в Календарь (.ics).
// Приложение ничего не назначает: список, дозы и время вводит пользователь.
// Отметки хранятся в settings.supplementLog: { 'YYYY-MM-DD': ['<id>@08:00', …] } — последние 60 дней.
import type { Supplement } from './schemas.ts';
import { addDays, type DateKey } from './time.ts';

export const SUPPLEMENT_LOG_KEY = 'supplementLog';
export type SupplementLog = Record<DateKey, string[]>;

/** Принимается ли добавка в этот день (по датам начала и окончания). */
export function isActiveOn(s: Pick<Supplement, 'startDate' | 'endDate'>, day: DateKey): boolean {
  return (!s.startDate || s.startDate <= day) && (!s.endDate || s.endDate >= day);
}

export interface Dose {
  supplement: Supplement;
  /** «ЧЧ:ММ» или '' — время не указано (один приём в любое время). */
  time: string;
  key: string;
}

/** Приёмы на день по времени; добавки без времени — один приём в конце списка. */
export function dosesForDay(items: readonly Supplement[], day: DateKey): Dose[] {
  const out: Dose[] = [];
  for (const s of items) {
    if (!isActiveOn(s, day)) continue;
    const times = s.times?.length ? [...s.times].sort() : [''];
    for (const time of times) out.push({ supplement: s, time, key: `${s.id}@${time}` });
  }
  return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.supplement.name.localeCompare(b.supplement.name, 'ru'));
}

/** Переключить отметку приёма и убрать дни старше 60. */
export function toggleDose(log: SupplementLog, day: DateKey, key: string): SupplementLog {
  const list = log[day] ?? [];
  const next: SupplementLog = { ...log, [day]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] };
  const oldest = addDays(day, -60);
  for (const d of Object.keys(next)) if (d < oldest || !next[d]!.length) delete next[d];
  return next;
}

export function normalizeLog(raw: unknown): SupplementLog {
  if (!raw || typeof raw !== 'object') return {};
  const out: SupplementLog = {};
  for (const [d, v] of Object.entries(raw as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Array.isArray(v)) out[d] = v.filter((x): x is string => typeof x === 'string');
  }
  return out;
}

const ics = (t: string) => t.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/**
 * Файл календаря с ежедневным напоминанием на каждое время приёма. Время «плавающее» (без часового пояса):
 * iPhone покажет его по местному времени телефона. Окончание — дата окончания приёма, если указана.
 */
export function supplementIcs(s: Supplement, from: DateKey, stamp: string): string {
  const times = s.times?.length ? s.times : ['09:00'];
  const day = (s.startDate && s.startDate > from ? s.startDate : from).replaceAll('-', '');
  const until = s.endDate ? `;UNTIL=${s.endDate.replaceAll('-', '')}T235959` : '';
  const dose = `${s.dose.toLocaleString('ru-RU')} ${s.doseUnit}`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Personal Athlete OS//RU', 'CALSCALE:GREGORIAN'];
  for (const t of times) {
    const hhmm = t.replace(':', '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}-${hhmm}@athlete-os`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${day}T${hhmm}00`,
      'DURATION:PT5M',
      `RRULE:FREQ=DAILY${until}`,
      `SUMMARY:${ics(`${s.name} — ${dose}`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${ics(`Принять: ${s.name}, ${dose}`)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
