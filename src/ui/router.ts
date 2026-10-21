// Минимальный маршрутизатор на hash (#/nutrition?add=1).
// Hash-адреса не требуют настройки сервера и одинаково работают офлайн через Service Worker.
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path = '/', query = ''] = raw.split('?');
  return { path: path.startsWith('/') ? path : `/${path}`, params: new URLSearchParams(query) };
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parse(hash);
}

export function navigate(to: string, replace = false) {
  const target = `#${to}`;
  if (replace) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = to;
  }
}

/** Убирает параметр из адреса (например, ?add=1 после открытия формы), не создавая запись истории. */
export function clearParam(route: Route, name: string) {
  if (!route.params.has(name)) return;
  const params = new URLSearchParams(route.params);
  params.delete(name);
  const q = params.toString();
  navigate(q ? `${route.path}?${q}` : route.path, true);
}

export const href = (path: string) => `#${path}`;
