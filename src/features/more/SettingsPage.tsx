import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../appVersion.ts';
import { APP_TIME_ZONE, DEFAULT_WEIGHT_CATEGORY } from '../../config.ts';
import { Card, Page } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { href } from '../../ui/router.ts';
import { perekProvider, type ProviderStatus } from '../nutrition/catalogProvider.ts';

interface StorageInfo {
  supported: boolean;
  persisted?: boolean;
  usageMb?: number;
}

async function readStorage(): Promise<StorageInfo> {
  if (!navigator.storage?.persisted) return { supported: false };
  const [persisted, estimate] = await Promise.all([navigator.storage.persisted(), navigator.storage.estimate?.()]);
  return { supported: true, persisted, usageMb: estimate?.usage !== undefined ? estimate.usage / 1024 / 1024 : undefined };
}

export function SettingsPage() {
  const { notify } = useFeedback();
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [perek, setPerek] = useState<ProviderStatus | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    void readStorage().then(setStorage);
    const ctrl = new AbortController();
    perekProvider.checkAvailability(ctrl.signal).then(setPerek, () => undefined);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      ctrl.abort();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);

  async function persist() {
    const granted = await navigator.storage.persist();
    notify(granted ? 'Браузер обещал не удалять данные автоматически' : 'Браузер отклонил запрос. Чаще делайте резервные копии.', granted ? 'info' : 'error');
    setStorage(await readStorage());
  }

  return (
    <Page title="Настройки и о приложении" subtitle={<a href={href('/more')}>← Ещё</a>}>
      <Card title="Параметры">
        <ul className="list small">
          <li>Часовой пояс дат и времени: {APP_TIME_ZONE}</li>
          <li>Категория по умолчанию — дзюдо: {DEFAULT_WEIGHT_CATEGORY.judo} кг, самбо: {DEFAULT_WEIGHT_CATEGORY.sambo} кг</li>
          <li>Версия приложения: {APP_VERSION}</li>
        </ul>
        <p className="small muted">Параметры задаются в файле src/config.ts.</p>
      </Card>

      <Card title="Хранилище">
        {storage === null ? (
          <p className="muted">Проверка…</p>
        ) : !storage.supported ? (
          <p className="muted">Браузер не сообщает сведений о хранилище.</p>
        ) : (
          <>
            <p>
              Постоянное хранение: <b>{storage.persisted ? 'включено' : 'не подтверждено'}</b>
              {storage.usageMb !== undefined && <span className="muted"> · занято ≈ {storage.usageMb.toFixed(1)} МБ</span>}
            </p>
            {!storage.persisted && (
              <button type="button" className="btn" onClick={persist}>
                Попросить браузер не удалять данные
              </button>
            )}
          </>
        )}
        <p className="small muted">
          Safari может удалить данные сайта, который давно не открывался. Добавьте приложение на экран «Домой» и регулярно
          делайте <a href={href('/more/backup')}>резервную копию</a>.
        </p>
      </Card>

      <Card title="Сеть и внешние сервисы">
        <p>Интернет: {online ? 'есть' : 'нет — дневники работают офлайн'}</p>
        <p>
          Поиск Perek.us:{' '}
          {perek === null ? 'проверка…' : perek.available ? <b>подключён</b> : <span className="muted">{perek.message}</span>}
        </p>
        <p className="small muted">Платные API ИИ не используются. Сводку для ИИ вы копируете вручную.</p>
      </Card>
    </Page>
  );
}
