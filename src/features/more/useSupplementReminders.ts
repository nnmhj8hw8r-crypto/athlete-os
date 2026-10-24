// Уведомления о добавках, пока приложение открыто или свёрнуто недавно (v0.10). Веб-приложение не может
// разбудить себя в закрытом состоянии без сервера, поэтому основное напоминание — событие в «Календаре»;
// это — дополнение. Срабатывает только при разрешении уведомлений и для ещё не отмеченных приёмов.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '../../data/db.ts';
import { dosesForDay, normalizeLog, SUPPLEMENT_LOG_KEY } from '../../domain/supplements.ts';
import { getZonedParts, todayKey } from '../../domain/time.ts';

export function useSupplementReminders() {
  const data = useLiveQuery(async () => ({ items: await db.supplements.toArray(), log: normalizeLog((await db.settings.get(SUPPLEMENT_LOG_KEY))?.value) }), []);
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
        if (wait < 0 || wait > 12 * 3_600_000) return undefined;
        return window.setTimeout(() => {
          const body = `${d.supplement.dose.toLocaleString('ru-RU')} ${d.supplement.doseUnit} — отметьте в «Добавках»`;
          void navigator.serviceWorker?.ready
            .then((r) => r.showNotification(`Пора: ${d.supplement.name}`, { body, tag: d.key, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` }))
            .catch(() => new Notification(`Пора: ${d.supplement.name}`, { body, tag: d.key }));
        }, wait);
      });
    return () => timers.forEach((t) => t !== undefined && clearTimeout(t));
  }, [data]);
}
