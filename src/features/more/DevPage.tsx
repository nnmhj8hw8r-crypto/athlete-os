// «Для разработчика» (v0.10, бывшая карточка режима разработчика v0.9.3): отдельный раздел, открывается
// 7 нажатиями по строке версии в «Настройках» (settings.devMode, только на этом устройстве). Сведения об
// устройстве и сети, быстрая смена пола, режима и сценария, повтор заставки и приветствия, сброс подсказок.
// Записи дневника не меняет.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../appVersion.ts';
import { CONSENT_KEY, useLastBackup } from '../../data/appMeta.ts';
import { db } from '../../data/db.ts';
import { countAll, deleteSetting, setSetting } from '../../data/repo.ts';
import { LEVEL_LABEL, SCENARIOS, SEX_LABEL, type AppLevel, type Scenario, type Sex } from '../../domain/profile.ts';
import { formatDateTime } from '../../domain/time.ts';
import { Card, Page, Segmented } from '../../ui/components.tsx';
import { cameraState, isStandalone, notificationState, PERM_LABEL, storageState, type PermState } from '../../ui/devicePermissions.ts';
import { useFeedback } from '../../ui/feedback.tsx';
import { href, navigate } from '../../ui/router.ts';
import { perekProvider, type ProviderStatus } from '../nutrition/catalogProvider.ts';
import { saveProfile, useProfile } from '../onboarding/useProfile.ts';

export const DEV_MODE_KEY = 'devMode';
const SCENARIO_SHORT: Record<Scenario, string> = { wrestler: 'Борец', gym: 'Зал', general: 'Для себя' };

export function useDevMode(): boolean {
  return useLiveQuery(async () => (await db.settings.get(DEV_MODE_KEY))?.value === true, []) ?? false;
}

export function DevPage() {
  const { notify } = useFeedback();
  const profile = useProfile();
  const devMode = useDevMode();
  const lastBackup = useLastBackup();
  const records = useLiveQuery(async () => (await countAll()) - (await db.settings.count()), []);
  const [perek, setPerek] = useState<ProviderStatus | null>(null);
  const [perms, setPerms] = useState<{ camera: PermState; notif: PermState; storage: PermState } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const ctrl = new AbortController();
    perekProvider.checkAvailability(ctrl.signal).then(setPerek, () => undefined);
    void Promise.all([cameraState(), storageState()]).then(([camera, storage]) => setPerms({ camera, storage, notif: notificationState() }));
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      ctrl.abort();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);

  if (!devMode) {
    return (
      <Page title="Для разработчика" subtitle={<a href={href('/more/settings')}>← Настройки</a>}>
        <p className="muted">Раздел закрыт. Откройте его, нажав 7 раз на строку версии в настройках.</p>
      </Page>
    );
  }

  const rows: [string, string][] = [
    ['Версия', `${APP_VERSION} (демо)`],
    ['Запуск', isStandalone() ? 'с экрана «Домой»' : 'в браузере'],
    ['Интернет', online ? 'есть' : 'нет'],
    ['Поиск Perek.us', perek === null ? 'проверка…' : perek.available ? 'доступен' : 'нет (нет сервера)'],
    ['Записей в дневниках', records === undefined ? '…' : String(records)],
    ['Последняя копия', lastBackup ? formatDateTime(lastBackup) : 'нет'],
    ['Камера', perms ? PERM_LABEL[perms.camera] : '…'],
    ['Уведомления', perms ? PERM_LABEL[perms.notif] : '…'],
    ['Постоянное хранение', perms ? PERM_LABEL[perms.storage] : '…'],
  ];

  return (
    <Page title="Для разработчика" subtitle={<a href={href('/more/settings')}>← Настройки</a>}>
      {profile && (
        <Card title="Профиль">
          <div className="field">
            <span className="label">Пол фигуры</span>
            <Segmented<Sex>
              label="Пол фигуры"
              value={profile.sex ?? 'male'}
              onChange={(v) => void saveProfile({ ...profile, sex: v }).then(() => notify(`Фигура: ${SEX_LABEL[v].toLowerCase()}`))}
              options={(['male', 'female'] as const).map((v) => ({ value: v, label: SEX_LABEL[v] }))}
            />
          </div>
          <div className="field">
            <span className="label">Режим</span>
            <Segmented<AppLevel>
              label="Режим"
              value={profile.level}
              onChange={(v) => void saveProfile({ ...profile, level: v })}
              options={(['basic', 'full'] as const).map((v) => ({ value: v, label: LEVEL_LABEL[v] }))}
            />
          </div>
          <div className="field">
            <span className="label">Сценарий</span>
            <Segmented<Scenario>
              label="Сценарий"
              value={profile.scenario}
              onChange={(v) => void saveProfile({ ...profile, scenario: v })}
              options={SCENARIOS.map((v) => ({ value: v, label: SCENARIO_SHORT[v] }))}
            />
          </div>
        </Card>
      )}

      <Card title="Проверить, что видит новый пользователь">
        <div className="dev-actions">
          <button type="button" className="btn" onClick={() => location.reload()}>
            Заставка
          </button>
          <button type="button" className="btn" onClick={() => navigate('/welcome')}>
            Приветствие
          </button>
          <button type="button" className="btn" onClick={() => void deleteSetting(CONSENT_KEY).then(() => navigate('/more/permissions'))}>
            Правила заново
          </button>
          {profile && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                void saveProfile({ ...profile, hideFeedbackPrompt: false, hideLevelHint: false, completedAt: new Date(Date.now() - 4 * 86_400_000).toISOString() });
                notify('Подсказки и карточка отзыва снова включены (карточка — при 5+ записях)');
              }}
            >
              Подсказки и отзыв
            </button>
          )}
          <button type="button" className="btn" onClick={() => void setSetting('dashboardLayout', null).then(() => notify('Главная сброшена'))}>
            Сбросить главную
          </button>
        </div>
      </Card>

      <Card title="Устройство">
        <dl className="dev-table">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <button
        type="button"
        className="btn ghost"
        onClick={() =>
          void deleteSetting(DEV_MODE_KEY).then(() => {
            notify('Раздел разработчика скрыт');
            navigate('/more/settings', true);
          })
        }
      >
        Скрыть раздел
      </button>
    </Page>
  );
}
