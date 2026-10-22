// Поведение открытых окон на телефоне:
// 1) страница под окном не прокручивается (iOS Safari игнорирует overflow:hidden у body,
//    поэтому body фиксируется на месте и после закрытия возвращается к прежней прокрутке);
// 2) у каждого открытого окна своя запись в истории браузера — жест «назад» (смахивание от края
//    экрана) закрывает верхнее окно, а не уводит на предыдущую страницу приложения.
//
// Окно, закрытое кнопкой, убирает свою запись истории не сразу, а в следующем такте: если в том же
// такте открылось другое окно (смена шага, повторный монтаж в режиме разработки), оно забирает эту
// запись себе. Иначе отложенный history.back() «отматывал» бы уже новое окно.

interface Entry {
  onBack: () => void;
  closedByBack: boolean;
}

const KEY = '__modalDepth';
const stack: Entry[] = [];
let toRelease = 0;
let flushScheduled = false;
let ignorePops = 0;
let listening = false;
let savedScrollY = 0;
/** Переходы, ждущие окончания отложенного шага «назад» (иначе он отменил бы переход). */
let queued: (() => void)[] = [];
let safety: ReturnType<typeof setTimeout> | null = null;

function runQueued() {
  if (safety) clearTimeout(safety);
  safety = null;
  const list = queued;
  queued = [];
  for (const fn of list) fn();
}

/** Выполнить переход по приложению после того, как записи закрытых окон убраны из истории. */
export function afterModalHistory(fn: () => void): void {
  if (ignorePops > 0 || (flushScheduled && toRelease > 0)) {
    queued.push(fn);
    if (!safety) safety = setTimeout(runQueued, 600);
  } else {
    fn();
  }
}

function depthOf(state: unknown): number {
  if (state && typeof state === 'object' && KEY in state) {
    const v = (state as Record<string, unknown>)[KEY];
    return typeof v === 'number' ? v : 0;
  }
  return 0;
}

function lockScroll() {
  savedScrollY = window.scrollY;
  const s = document.body.style;
  s.position = 'fixed';
  s.top = `-${savedScrollY}px`;
  s.left = '0';
  s.right = '0';
  s.overflow = 'hidden';
}

function unlockScroll() {
  const s = document.body.style;
  s.position = '';
  s.top = '';
  s.left = '';
  s.right = '';
  s.overflow = '';
  window.scrollTo(0, savedScrollY);
}

function onPopState(e: PopStateEvent) {
  if (ignorePops > 0) {
    ignorePops--;
    if (ignorePops === 0) runQueued();
    return;
  }
  const depth = depthOf(e.state);
  while (stack.length > depth) {
    const top = stack.pop()!;
    top.closedByBack = true;
    top.onBack();
  }
  if (stack.length === 0) unlockScroll();
}

function flush() {
  flushScheduled = false;
  const n = toRelease;
  toRelease = 0;
  if (stack.length === 0) unlockScroll();
  // Убираем записи закрытых окон, только если они всё ещё наверху истории.
  if (n > 0 && depthOf(history.state) >= stack.length + n) {
    ignorePops++;
    history.go(-n);
  } else {
    runQueued();
  }
}

/**
 * Регистрирует открытое окно. `onBack` вызывается, когда пользователь ушёл «назад» за запись этого окна.
 * Возвращает функцию снятия регистрации (вызывать при закрытии/размонтировании окна).
 */
export function registerModal(onBack: () => void): () => void {
  if (!listening) {
    window.addEventListener('popstate', onPopState);
    listening = true;
  }
  const entry: Entry = { onBack, closedByBack: false };
  if (stack.length === 0 && toRelease === 0) lockScroll();
  stack.push(entry);
  if (toRelease > 0) {
    toRelease--; // запись истории закрытого в этом такте окна достаётся новому
  } else {
    history.pushState({ ...(history.state as object | null), [KEY]: stack.length }, '');
  }

  return () => {
    const i = stack.indexOf(entry);
    if (i !== -1) stack.splice(i, 1);
    if (entry.closedByBack) return;
    toRelease++;
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(flush, 0);
    }
  };
}
