// Группы мышц: русские названия и размер (для времени восстановления по умолчанию).
import type { Muscle } from './schemas.ts';

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'грудные',
  delts: 'дельты',
  biceps: 'бицепс',
  triceps: 'трицепс',
  forearms: 'предплечья',
  abs: 'пресс',
  obliques: 'косые мышцы живота',
  quads: 'квадрицепс',
  adductors: 'приводящие бедра',
  calves: 'икры',
  traps: 'трапеции',
  lats: 'широчайшие',
  rearDelts: 'задние дельты',
  lowerBack: 'поясница',
  glutes: 'ягодицы',
  hamstrings: 'бицепс бедра',
};

/** Крупные группы — восстановление по умолчанию 72 ч, остальные — 48 ч (грубое правило, настраивается). */
export const LARGE_MUSCLES: ReadonlySet<Muscle> = new Set(['chest', 'lats', 'traps', 'lowerBack', 'quads', 'hamstrings', 'glutes']);

/** «бицепс, широчайшие и поясница» */
export function joinMuscles(list: readonly Muscle[]): string {
  const names = list.map((m) => MUSCLE_LABEL[m]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
}
