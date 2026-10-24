// Настройки (v0.10, минималистично): режим приложения карточками, фигура, хранение данных с датой копии,
// ссылки на «Правила и разрешения» и «Источники и лицензии». «Интернет» и вид графиков убраны (решение
// пользователя); режим разработчика — 7 нажатий по версии, открывает раздел «Для разработчика».
import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../appVersion.ts';
import { IS_BETA } from '../../channel.ts';
import { setPersonalMode, useLastBackup, usePersonalMode } from '../../data/appMeta.ts';
import { db } from '../../data/db.ts';
import { setSetting } from '../../data/repo.ts';
import { normalizeLayout } from '../../domain/dashboard.ts';
import { revealFullWidgets, SCENARIO_META, SEX_LABEL, type AppLevel, type Sex } from '../../domain/profile.ts';
import { formatDateTime } from '../../domain/time.ts';
import { Card, Modal, Page, Segmented } from '../../ui/components.tsx';
import { requestStorage } from '../../ui/devicePermissions.ts';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { href, navigate } from '../../ui/router.ts';
import { saveProfile, useProfile } from '../onboarding/useProfile.ts';
import { DEV_MODE_KEY, useDevMode } from './DevPage.tsx';

interface StorageInfo {
  supported: boolean;
  persisted?: boolean;
  usageMb?: number;
}

export async function readStorage(): Promise<StorageInfo> {
  if (!navigator.storage?.persisted) return { supported: false };
  const [persisted, estimate] = await Promise.all([navigator.storage.persisted(), navigator.storage.estimate?.()]);
  return { supported: true, persisted, usageMb: estimate?.usage !== undefined ? estimate.usage / 1024 / 1024 : undefined };
}

const LEVELS: { value: AppLevel; title: string; text: string; icon: keyof typeof Icons }[] = [
  { value: 'basic', title: 'Простой', text: 'Питание, сон, восстановление и тренировки', icon: 'home' },
  { value: 'full', title: 'Полный', text: 'Плюс «Сезон»: старты, выход в вес, нагрузка', icon: 'season' },
];

const DAY = 86_400_000;

export function SettingsPage() {
  const { notify } = useFeedback();
  const profile = useProfile();
  const devMode = useDevMode();
  const lastBackup = useLastBackup();
  const personal = usePersonalMode();
  const [askPersonal, setAskPersonal] = useState(false);
  const [taps, setTaps] = useState(0);
  const [storage, setStorage] = useState<StorageInfo | null>(null);

  useEffect(() => {
    void readStorage().then(setStorage);
  }, []);

  function tapVersion() {
    if (devMode) {
      navigate('/more/dev');
      return;
    }
    const n = taps + 1;
    setTaps(n);
    if (n >= 7) {
      void setSetting(DEV_MODE_KEY, true).then(() => navigate('/more/dev'));
      notify('Раздел «Для разработчика» открыт');
    } else if (n >= 4) notify(`До раздела разработчика: ${7 - n}`);
  }

  async function persist() {
    const r = await requestStorage();
    notify(r === 'granted' ? 'Браузер обещал не удалять данные' : 'Браузер отклонил запрос — чаще делайте резервные копии', r === 'granted' ? 'info' : 'error');
    setStorage(await readStorage());
  }

  async function setLevel(level: AppLevel) {
    if (!profile || profile.level === level) return;
    await saveProfile({ ...profile, level });
    if (level === 'full') await setSetting('dashboardLayout', revealFullWidgets(normalizeLayout((await db.settings.get('dashboardLayout'))?.value)));
    notify(level === 'full' ? 'Полный режим включён' : 'Простой режим: «Сезон» скрыт, данные сохранены');
  }

  const backupAge = lastBackup ? Math.floor((Date.now() - Date.parse(lastBackup)) / DAY) : null;

  return (
    <Page title="Настройки" subtitle={<a href={href('/more')}>← Ещё</a>}>
      {profile && (
        <Card title="Режим">
          <div className="level-cards" role="radiogroup" aria-label="Режим приложения">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={profile.level === l.value}
                className={`level-card${profile.level === l.value ? ' on' : ''}`}
                onClick={() => void setLevel(l.value)}
              >
                <span className="level-icon">{Icons[l.icon]}</span>
                <b>{l.title}</b>
                <span>{l.text}</span>
                <span className="level-check" aria-hidden="true">
                  {Icons.check}
                </span>
              </button>
            ))}
          </div>
          <div className="settings-row">
            <span>Фигура мышц</span>
            <Segmented<Sex>
              label="Фигура мышц"
              value={profile.sex ?? 'male'}
              onChange={(v) => void saveProfile({ ...profile, sex: v })}
              options={(['male', 'female'] as const).map((v) => ({ value: v, label: SEX_LABEL[v] }))}
            />
          </div>
          <a className="settings-link" href={href('/welcome')}>
            <span>
              Сценарий: <b>{SCENARIO_META[profile.scenario].title}</b>
            </span>
            <span className="muted">Изменить {Icons.chevronRight}</span>
          </a>
        </Card>
      )}

      <Card title="Данные">
        <a className="settings-link" href={href('/more/backup')}>
          <span>
            Резервная копия
            <small className={backupAge === null || backupAge > 7 ? 'warn-text' : 'muted'}>
              {lastBackup === undefined ? '…' : lastBackup === null ? 'ещё не делали' : `${formatDateTime(lastBackup)}${backupAge! > 7 ? ' — пора обновить' : ''}`}
            </small>
          </span>
          <span className="muted">{Icons.chevronRight}</span>
        </a>
        {storage?.supported && (
          <div className="settings-row">
            <span>
              Защита от удаления
              <small className="muted">{storage.usageMb !== undefined && `занято ≈ ${storage.usageMb.toFixed(1)} МБ`}</small>
            </span>
            {storage.persisted ? (
              <span className="perm-ok">{Icons.check}</span>
            ) : (
              <button type="button" className="btn small" onClick={() => void persist()}>
                Включить
              </button>
            )}
          </div>
        )}
      </Card>

      <Card title="Личный режим" info={<p>Справочник по добавкам из консенсуса Международного олимпийского комитета (2018): схема, уровень доказательности, риск. Выключен — приложение ничего не подсказывает. Это не назначение и не замена врача.</p>}>
        <div className="settings-row">
          <span>
            Подсказки по добавкам
            <small className="muted">{personal ? 'включены — раздел «Добавки»' : 'выключены'}</small>
          </span>
          <button type="button" className="btn small" onClick={() => (personal ? void setPersonalMode(false).then(() => notify('Личный режим выключен')) : setAskPersonal(true))}>
            {personal ? 'Выключить' : 'Включить'}
          </button>
        </div>
      </Card>

      <Card>
        <a className="settings-link" href={href('/more/permissions')}>
          <span>Правила и разрешения</span>
          <span className="muted">{Icons.chevronRight}</span>
        </a>
        <a className="settings-link" href={href('/more/licenses')}>
          <span>Источники и лицензии</span>
          <span className="muted">{Icons.chevronRight}</span>
        </a>
        {devMode && (
          <a className="settings-link" href={href('/more/dev')}>
            <span>Для разработчика</span>
            <span className="muted">{Icons.chevronRight}</span>
          </a>
        )}
      </Card>

      {askPersonal && (
        <Modal
          title="Включить личный режим?"
          onClose={() => setAskPersonal(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setAskPersonal(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  void setPersonalMode(true).then(() => {
                    setAskPersonal(false);
                    notify('Личный режим включён');
                  })
                }
              >
                Понимаю, включить
              </button>
            </>
          }
        >
          <p>В «Добавках» появится справочник по пяти добавкам, которые поддерживает консенсус IOC: кофеин, креатин, бета-аланин, сода, нитрат.</p>
          <p>У каждой — источник, уровень доказательности и риск. Это обобщение научного консенсуса, а не рекомендация лично вам: решение о приёме — с врачом или спортивным диетологом, с проверкой партии на допинг (РУСАДА / WADA).</p>
        </Modal>
      )}

      <button type="button" className="version-line" onClick={tapVersion}>
        Personal Athlete OS {APP_VERSION} · {IS_BETA ? 'бета' : 'демо'}
      </button>
    </Page>
  );
}
