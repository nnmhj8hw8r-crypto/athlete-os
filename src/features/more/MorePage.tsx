import { Page } from '../../ui/components.tsx';
import { href } from '../../ui/router.ts';

const ITEMS = [
  { path: '/more/supplements', title: 'Добавки', text: 'Журнал приёма спортивных добавок' },
  { path: '/more/sources', title: 'Библиотека источников', text: 'Статьи, исследования и рекомендации с заметками' },
  { path: '/more/ai', title: 'Сводка для ИИ', text: 'Подготовить текст для Claude или ChatGPT и скопировать вручную' },
  { path: '/more/backup', title: 'Резервная копия', text: 'Экспорт и импорт всех данных в JSON' },
  { path: '/more/settings', title: 'Настройки и о приложении', text: 'Параметры, хранилище, состояние сервера' },
  { path: '/nutrition/foods', title: 'Продукты и рецепты', text: 'Свой каталог продуктов' },
];

export function MorePage() {
  return (
    <Page title="Ещё">
      <ul className="list">
        {ITEMS.map((i) => (
          <li key={i.path}>
            <a className="list-item selectable" href={href(i.path)} style={{ textDecoration: 'none' }}>
              <span className="grow">
                <span className="title">{i.title}</span>
                <span className="meta" style={{ display: 'block' }}>
                  {i.text}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Page>
  );
}
