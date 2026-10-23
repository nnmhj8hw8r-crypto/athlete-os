// «Ещё» (v0.9.2): пункты сгруппированы по смыслу, описания — простыми словами, без технических терминов.
import type { ReactNode } from 'react';
import { Page } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { href } from '../../ui/router.ts';
import { SHARE_MESSAGE, shareApp } from '../../ui/share.ts';
import { useFeedbackUrl } from '../onboarding/useProfile.ts';

interface Item {
  icon: ReactNode;
  title: string;
  text: string;
  path?: string;
  url?: string;
  onClick?: () => void;
}

export function MorePage() {
  const feedback = useFeedbackUrl();
  const { notify } = useFeedback();
  const share = () => void shareApp().then((r) => SHARE_MESSAGE[r] && notify(SHARE_MESSAGE[r]!, r === 'failed' ? 'error' : 'info'));

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Мои данные',
      items: [
        { icon: Icons.history, title: 'Резервная копия', text: 'Сохранить все записи в файл и восстановить их — на этом или новом телефоне', path: '/more/backup' },
        { icon: Icons.food, title: 'Продукты и рецепты', text: 'Ваши продукты и блюда — добавляются в дневник питания в одно касание', path: '/nutrition/foods' },
      ],
    },
    {
      title: 'Инструменты',
      items: [
        { icon: Icons.copy, title: 'Сводка для ИИ', text: 'Готовый текст о питании, сне и тренировках — вставьте в ChatGPT или Claude и задайте вопрос', path: '/more/ai' },
        { icon: Icons.drop, title: 'Добавки', text: 'Отмечайте, что и когда принимаете — для себя и для разговора с врачом', path: '/more/supplements' },
        { icon: Icons.book, title: 'Библиотека', text: 'Статьи и заметки, которые вы сохранили', path: '/more/sources' },
      ],
    },
    {
      title: 'Приложение',
      items: [
        { icon: Icons.edit, title: 'Настройки', text: 'Простой или полный режим, вид графиков, хранение данных', path: '/more/settings' },
        { icon: Icons.arrowUp, title: 'Поделиться с друзьями', text: 'Отправить ссылку — у каждого своё приложение, ваши записи не передаются', onClick: share },
        { icon: Icons.pen, title: 'Оставить отзыв', text: 'Что понравилось и чего не хватает — 2–3 минуты во внешней форме', url: feedback },
        { icon: Icons.home, title: 'Знакомство с приложением', text: 'Показать приветствие снова и поменять сценарий: борец, зал или для себя', path: '/welcome' },
      ],
    },
  ];

  return (
    <Page title="Ещё">
      {groups.map((g) => (
        <section key={g.title} className="more-group">
          <h2 className="more-group-title">{g.title}</h2>
          <ul className="more-list">
            {g.items.map((i) => {
              const body = (
                <>
                  <span className="more-icon">{i.icon}</span>
                  <span className="grow">
                    <span className="title">{i.title}</span>
                    <span className="meta">{i.text}</span>
                  </span>
                </>
              );
              return (
                <li key={i.title}>
                  {i.onClick ? (
                    <button type="button" className="more-item" onClick={i.onClick}>
                      {body}
                    </button>
                  ) : (
                    <a className="more-item" href={i.url ?? href(i.path!)} {...(i.url && { target: '_blank', rel: 'noreferrer' })}>
                      {body}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Page>
  );
}
