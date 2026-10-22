import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../appVersion.ts';
import { APP_TIME_ZONE, DEFAULT_WEIGHT_CATEGORY } from '../../config.ts';
import type { ChartLineStyle } from '../../domain/chartPath.ts';
import { setChartStyle, useChartStyle } from '../../ui/chartStyle.ts';
import { Card, Page, Segmented } from '../../ui/components.tsx';
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
  const chartStyle = useChartStyle();
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
