// Постоянные параметры приложения. Меняются здесь, а не по всему коду.

/** Часовой пояс, в котором вводятся и показываются все даты и время. */
export const APP_TIME_ZONE = 'Europe/Moscow';

export const APP_LOCALE = 'ru-RU';

export type Sport = 'judo' | 'sambo';

/** Весовые категории по умолчанию для новых соревнований. Пользователь может изменить их в форме. */
export const DEFAULT_WEIGHT_CATEGORY: Record<Sport, string> = {
  judo: '-73',
  sambo: '-71',
};

export const SPORT_LABEL: Record<Sport, string> = {
  judo: 'Дзюдо',
  sambo: 'Самбо',
};

/** Форма отзывов демо-версии (Tally). Ответы разбираются вручную для улучшения приложения. */
export const FEEDBACK_FORM_URL = 'https://tally.so/r/q54zM2';
