// «Поделиться приложением»: системное меню «Поделиться» (iPhone, Android), иначе — копирование ссылки.
// Ссылка — адрес самого приложения без #-пути, чтобы друг открыл его с главной.

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export function appUrl(): string {
  return `${location.origin}${location.pathname}`;
}

export async function shareApp(): Promise<ShareResult> {
  const url = appUrl();
  const data = { title: 'Personal Athlete OS', text: 'Дневник спортсмена: питание, тренировки, сон и восстановление. Попробуй:', url };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return copyByTextarea(url) ? 'copied' : 'failed';
  }
}

/** Старый способ копирования — работает и там, где браузер не дал доступа к буферу обмена. */
function copyByTextarea(text: string): boolean {
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    el.remove();
  }
}

export const SHARE_MESSAGE: Record<ShareResult, string | null> = {
  shared: null,
  cancelled: null,
  copied: 'Ссылка скопирована — отправьте её друзьям',
  failed: 'Не получилось поделиться. Скопируйте адрес из строки браузера.',
};
