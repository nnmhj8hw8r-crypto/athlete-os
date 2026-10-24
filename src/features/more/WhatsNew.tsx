// Окно «Что нового» после обновления (v0.11): коротко, по пунктам. Показывается один раз на версию;
// новый пользователь его не видит (его версия отмечается при первом запуске).
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { APP_VERSION } from '../../appVersion.ts';
import { db } from '../../data/db.ts';
import { setSetting } from '../../data/repo.ts';
import { LAST_SEEN_VERSION_KEY, releasesToShow } from '../../domain/changelog.ts';
import { Modal } from '../../ui/components.tsx';

/** undefined — читается; '' — отметки нет. */
function useSeenVersion(): string | undefined {
  return useLiveQuery(async () => {
    const v = (await db.settings.get(LAST_SEEN_VERSION_KEY))?.value;
    return typeof v === 'string' ? v : '';
  }, []);
}

/** Пока идёт знакомство, отмечает текущую версию как виденную — «что нового» нужно только после обновления. */
export function useMarkSeenOnFirstRun(firstRun: boolean): void {
  useEffect(() => {
    if (firstRun) void setSetting(LAST_SEEN_VERSION_KEY, APP_VERSION);
  }, [firstRun]);
}

export function WhatsNew() {
  const seen = useSeenVersion();
  if (seen === undefined) return null;
  const releases = releasesToShow(seen || undefined, APP_VERSION);
  if (releases.length === 0) return null;
  const close = () => void setSetting(LAST_SEEN_VERSION_KEY, APP_VERSION);
  return (
    <Modal
      title="Что нового"
      onClose={close}
      footer={
        <button type="button" className="btn primary" onClick={close}>
          Понятно
        </button>
      }
    >
      {releases.map((r) => (
        <section key={r.version} className="whats-new">
          <h3>Версия {r.version}</h3>
          <ul>
            {r.user.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}
    </Modal>
  );
}
