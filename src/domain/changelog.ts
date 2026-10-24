// Журнал версий (v0.11): `user` — короткие пункты для окна «Что нового» при открытии после обновления,
// `dev` — структурные заметки для раздела «Для разработчика». Новые версии — в начало списка.
// При выпуске: добавить запись и поднять APP_VERSION (src/appVersion.ts).

export interface ReleaseSection {
  title: string;
  items: string[];
}

export interface Release {
  version: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Для пользователей: 2–5 коротких пунктов простым языком. Пусто — окно не показывается. */
  user: string[];
  dev: ReleaseSection[];
}

export const LAST_SEEN_VERSION_KEY = 'lastSeenVersion';

export const CHANGELOG: readonly Release[] = [
  {
    version: '0.11.0',
    date: '2026-10-24',
    user: [
      'Личный режим (Настройки): справочник по добавкам из консенсуса IOC — схема, доказательность, риск. Включаете сами.',
      'Кнопка «Сообщить об ошибке» в разделе «Ещё».',
      'Напоминания о добавках стали надёжнее.',
      'Это окно: после обновления здесь коротко — что нового.',
    ],
    dev: [
      {
        title: 'Новое',
        items: [
          'Личный режим: settings.personalMode, справочник добавок domain/personalMode.ts (DECISIONS 102)',
          '«Сообщить об ошибке»: форма Tally jea4E4, в ссылке только v и kind (DECISIONS 103)',
          'Журнал версий domain/changelog.ts, окно «Что нового» (settings.lastSeenVersion), страница «Журнал версий» в «Для разработчика» (DECISIONS 104)',
        ],
      },
      {
        title: 'Исправлено',
        items: ['Запасной путь уведомления не падает на Android (new Notification в try/catch)', 'reminderKey(day, key) вынесен в домен, добавлен тест'],
      },
      { title: 'Данные', items: ['Структура БД не менялась; новые ключи settings: personalMode, lastSeenVersion'] },
    ],
  },
  {
    version: '0.10.1',
    date: '2026-10-24',
    user: [],
    dev: [{ title: 'Исправлено', items: ['Напоминание о добавках: ключ «дата + приём», чтобы на следующий день оно приходило без перезапуска (DECISIONS 100)'] }],
  },
  {
    version: '0.10.0',
    date: '2026-10-24',
    user: [
      'Сканер сразу открывает камеру.',
      'Чек-ин с описаниями шкал и подсказками «i».',
      'Точная карта мышц, статусы цветом.',
      'Добавки: отметка «принял» и напоминание в Календарь.',
      '«Мои замеры», настройки, «Правила и разрешения».',
    ],
    dev: [
      {
        title: 'Новое',
        items: [
          'Чек-ин со словесными шкалами, калибровка по своему разбросу (DECISIONS 88–89)',
          'Разметка мышц scripts/anatomy/seg.py → public/anatomy/labels (90–91)',
          'Фото упражнений Wikimedia Commons (93)',
          'Настройки, «Для разработчика», «Правила и разрешения», «Источники и лицензии» (94–95)',
          'Добавки, «Мои замеры» (96–97)',
        ],
      },
      { title: 'Исправления аудита', items: ['Слияние копии: чек-ины по дате, настройки не перезаписываются (99)', 'Целостность справочника блюд (101)'] },
    ],
  },
  {
    version: '0.9.5',
    date: '2026-10-23',
    user: [],
    dev: [{ title: 'Новое', items: ['Питание: поиск с числами, QR и DataMatrix, база товаров ~20 тыс., фактический расход'] }],
  },
];

function parts(v: string): number[] {
  return v.split('.').map((n) => Number.parseInt(n, 10) || 0);
}

export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/**
 * Что показать в окне «Что нового»: версии новее последней виденной (но не новее текущей), у которых есть
 * пункты для пользователей, от новых к старым, не больше трёх. Без отметки — только последняя такая версия.
 */
export function releasesToShow(seen: string | undefined, current: string, log: readonly Release[] = CHANGELOG): Release[] {
  if (seen && compareVersions(seen, current) >= 0) return [];
  const fresh = log.filter((r) => r.user.length > 0 && compareVersions(r.version, current) <= 0 && (!seen || compareVersions(r.version, seen) > 0));
  return seen ? fresh.slice(0, 3) : fresh.slice(0, 1);
}
