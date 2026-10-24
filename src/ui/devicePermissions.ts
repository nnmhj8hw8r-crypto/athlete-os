// Разрешения устройства (v0.10): камера (сканер), уведомления (напоминания), постоянное хранение данных.
// Веб-приложение не может выдать себе разрешение навсегда — только попросить браузер. На iPhone
// уведомления доступны веб-приложению, добавленному на экран «Домой» (iOS 16.4+).

export type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function cameraState(): Promise<PermState> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const s = await navigator.permissions?.query({ name: 'camera' as PermissionName });
    if (s) return s.state;
  } catch {
    // Safari до 16 не знает имени «camera» в Permissions API — состояние неизвестно.
  }
  return 'prompt';
}

/** Запросить камеру и сразу её отпустить: браузер запомнит ответ для сайта, если пользователь так настроит. */
export async function requestCamera(): Promise<PermState> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (e) {
    return (e as Error).name === 'NotAllowedError' ? 'denied' : 'unsupported';
  }
}

export function notificationState(): PermState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

export async function requestNotifications(): Promise<PermState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  const r = await Notification.requestPermission();
  return r === 'default' ? 'prompt' : r;
}

export async function storageState(): Promise<PermState> {
  if (!navigator.storage?.persisted) return 'unsupported';
  return (await navigator.storage.persisted()) ? 'granted' : 'prompt';
}

export async function requestStorage(): Promise<PermState> {
  if (!navigator.storage?.persist) return 'unsupported';
  return (await navigator.storage.persist()) ? 'granted' : 'denied';
}

export const PERM_LABEL: Record<PermState, string> = {
  granted: 'разрешено',
  denied: 'запрещено',
  prompt: 'не спрашивали',
  unsupported: 'недоступно',
};
