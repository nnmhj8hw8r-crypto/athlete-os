import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../appVersion.ts';
import { APP_TIME_ZONE } from '../../config.ts';
import type { ChartLineStyle } from '../../domain/chartPath.ts';
import { setChartStyle, useChartStyle } from '../../ui/chartStyle.ts';
import { Card, Page, Segmented } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { href } from '../../ui/router.ts';
import { normalizeLayout } from '../../domain/dashboard.ts';
import { LEVEL_LABEL, revealFullWidgets, SCENARIO_META, SEX_LABEL, type AppLevel, type Sex } from '../../domain/profile.ts';
import { DEV_MODE_KEY, DevCard, useDevMode } from './DevCard.tsx';
import { db } from '../../data/db.ts';
import { setSetting } from '../../data/repo.ts';
import { perekProvider, type ProviderStatus } from '../nutrition/catalogProvider.ts';
import { saveProfile, useProfile } from '../onboarding/useProfile.ts';

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
  const chartStyle = useChartStyle();
  const profile = useProfile();
  const devMode = useDevMode();
  const [taps, setTaps] = useState(0);
  function tapVersion() {
    if (devMode) return;
    const n = taps + 1;
    setTaps(n);
    if (n >= 7) {
      void setSetting(DEV_MODE_KEY, true);
      notify('Режим разработчика включён');
    } else if (n >= 4) notify(`До режима разработчика: ${7 - n}`);
  }
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

  async function setLevel(level: AppLevel) {
    if (!profile || profile.level === level) return;
    await saveProfile({ ...profile, level });
    if (level === 'full') await setSetting('dashboardLayout', revealFullWidgets(normalizeLayout((await db.settings.get('dashboardLayout'))?.value)));
    notify(level === 'full' ? 'Полный режим: открыт «Сезон» и карточки соревнований на главной' : 'Простой режим: разделы для соревнований скрыты, данные сохранены');
  }

  return (
    <Page title="Настройки и о приложении" subtitle={<a href={href('/more')}>← Ещё</a>}>
      {profile && (
        <Card title="Режим приложения">
          <Segmented<AppLevel>
            label="Режим приложения"
            value={profile.level}
            onChange={(v) => void setLevel(v)}
            options={(['basic', 'full'] as const).map((v) => ({ value: v, label: LEVEL_LABEL[v] }))}
          />
          <p className="small muted">
            Простой — дневник питания со сканером, сон, восстановление и тренировки. Полный — всё для соревнующегося спортсмена: раздел «Сезон»
            (старты, выход в вес, нагрузка по неделям) и его карточки на главной. Записи при смене режима не удаляются.
          </p>
          <p className="small">
            Сценарий: <b>{SCENARIO_META[profile.scenario].title}</b> · <a href={href('/welcome')}>пройти приветствие снова</a>
          </p>
          <div className="field">
            <span className="label">Фигура на схемах мышц</span>
            <Segmented<Sex>
              label="Пол"
              value={profile.sex ?? 'male'}
              onChange={(v) => void saveProfile({ ...profile, sex: v })}
              options={(['male', 'female'] as const).map((v) => ({ value: v, label: SEX_LABEL[v] }))}
            />
          </div>
        </Card>
      )}
      {devMode && <DevCard profile={profile} />}
      <Card title="О приложении">
        <ul className="list small">
          <li>Время и даты — по Москве ({APP_TIME_ZONE})</li>
          <li onClick={tapVersion}>Версия: {APP_VERSION} (демо){devMode && ' · режим разработчика'}</li>
        </ul>
      </Card>

      <Card title="Хранение данных">
        {storage === null ? (
          <p className="muted">Проверка…</p>
        ) : !storage.supported ? (
          <p className="muted">Браузер не сообщает сведений о хранилище.</p>
        ) : (
          <>
            <p>
              Защита от автоудаления: <b>{storage.persisted ? 'включена' : 'не включена'}</b>
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

      <Card title="Интернет">
        <p>{online ? 'Подключение есть' : 'Подключения нет — дневники работают и без интернета'}</p>
        <p>
          Поиск продуктов по названию:{' '}
          {perek === null ? (
            'проверка…'
          ) : perek.available ? (
            <b>есть</b>
          ) : (
            <span className="muted">пока недоступен — ищите по штрихкоду или добавьте свой продукт</span>
          )}
        </p>
        <p className="small muted">Штрихкоды ищутся в открытой базе Open Food Facts. Ваши записи никуда не отправляются.</p>
      </Card>

      <Card title="Вид">
        <div className="field">
          <span className="label">Линии графиков</span>
          <Segmented<ChartLineStyle>
            label="Линии графиков"
            value={chartStyle}
            onChange={(v) => void setChartStyle(v)}
            options={[
              { value: 'smooth', label: 'Плавные' },
              { value: 'straight', label: 'Прямые' },
            ]}
          />
        </div>
        <p className="small muted">Тема — светлая или тёмная — следует настройке телефона.</p>
      </Card>

      <Card title="Источники данных и лицензии">
        <ul className="sources">
          <li>Реалистичные анатомические фигуры (мужская и женская) — изображения, предоставленные автором приложения; женская собрана зеркально из половины фигуры, подписи убраны.</li>
          <li>
            Рисунки упражнений — <a href="https://github.com/everkinetic/data" target="_blank" rel="noreferrer">Everkinetic</a>{' '}
            (Greg Priday),{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ru" target="_blank" rel="noreferrer">
              CC BY-SA 4.0
            </a>
            . Изменения: переименованы файлы, убраны фиксированные размеры.
          </li>
          <li>
            Анатомическая схема мышц — Termininja (
            <a href="https://commons.wikimedia.org/wiki/File:Muscular_system.svg" target="_blank" rel="noreferrer">
              Wikimedia Commons
            </a>
            ) через проект{' '}
            <a href="https://github.com/wger-project/wger" target="_blank" rel="noreferrer">
              wger
            </a>
            ,{' '}
            <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.ru" target="_blank" rel="noreferrer">
              CC BY-SA 3.0
            </a>
            . Изменён цвет слоёв мышц. Пиктограммы кардио — собственные рисунки приложения.
          </li>
          <li>
            Встроенный справочник продуктов — <a href="https://fdc.nal.usda.gov" target="_blank" rel="noreferrer">USDA FoodData Central</a>{' '}
            (общественное достояние, CC0).
          </li>
          <li>
            Офлайн-база российских товаров и поиск по штрихкоду — <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>{' '}
            (ODbL 1.0).
          </li>
        </ul>
      </Card>
    </Page>
  );
}
