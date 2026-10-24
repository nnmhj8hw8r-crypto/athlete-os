// Уведомления о добавках, пока приложение открыто или свёрнуто недавно (v0.10). Веб-приложение не может
// разбудить себя в закрытом состоянии без сервера, поэтому основное напоминание — событие в «Календаре»;
// это — дополнение. Срабатывает только при разрешении уведомлений и для ещё не отмеченных приёмов.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db.ts';
import { dosesForDay, normalizeLog, SUPPLEMENT_LOG_KEY } from '../../domain/supplements.ts';
import { getZonedParts, todayKey } from '../../domain/time.ts';

const REMINDED_KEYS = new Set<string>();

function showReminder(name: string, body: string, tag: string): void {
  const title = `Пора: ${name}`;
  const icon = `${import.meta.env.BASE_URL}icons/icon-192.png`;
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.ready
      .then((r) => r.showNotification(title, { body, tag, icon }))
      .catch(() => new Notification(title, { body, tag }));
  } else {
    new Notification(title, { body, tag });
  }
}

export function useSupplementReminders() {
  const data = useLiveQuery(async () => ({ items: await db.supplements.toArray(), log: normalizeLog((await db.settings.get(SUPPLEMENT_LOG_KEY))?.value) }), []);
  // Пересчёт каждую минуту: таймеры ставятся на всё оставшееся время суток, а не только на 12 часов,
  // и приложение возвращает напоминание, если время настало до открытия (окно 1 минута).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!data || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const day = todayKey();
    const taken = new Set(data.log[day] ?? []);
    const now = getZonedParts(new Date());
    const nowMin = now.hour * 60 + now.minute;
    const timers = dosesForDay(data.items, day)
      .filter((d) => d.time && !taken.has(d.key))
      .map((d) => {
        const [h, m] = d.time.split(':').map(Number);
        const wait = ((h! * 60 + m!) - nowMin) * 60_000 - now.second * 1000;
        if (wait < -60_000) return undefined;
        return window.setTimeout(() => {
          if (REMINDED_KEYS.has(d.key)) return;
          REMINDED_KEYS.add(d.key);
          showReminder(d.supplement.name, `${d.supplement.dose.toLocaleString('ru-RU')} ${d.supplement.doseUnit} — отметьте в «Добавках»`, d.key);
        }, Math.max(0, wait));
      });
    return () => timers.forEach((t) => t !== undefined && clearTimeout(t));
  }, [data, tick]);
}
