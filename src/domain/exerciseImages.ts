// Иллюстрации упражнений из открытого набора Everkinetic (https://github.com/everkinetic/data),
// лицензия CC BY-SA 4.0, автор оригинала — Greg Priday (everkinetic.com).
// Ключ — слаг встроенного упражнения (lib:<слаг>), значение — номер рисунка Everkinetic.
// Файлы скачивает scripts/build-exercise-images.py в public/exercises/<слаг>.svg (поза «напряжение»).
// Для упражнений без подходящего рисунка (кардио, хват, борьба) показывается своя схема мышц.

export const EXERCISE_IMAGE_SOURCE: Record<string, string> = {
  'bench-press': '0042',
  'incline-bench': '0043',
  'smith-incline': '0081',
  'db-press': '0055',
  'fly-machine': '0056',
  dips: '0054',
  pushups: '0077',
  'clap-pushups': '0077',
  pullups: '0087',
  'pullups-weighted': '0087',
  'lat-pulldown': '0093',
  'barbell-row': '0026',
  'db-row': '0024',
  'cable-row': '0025',
  deadlift: '0099',
  hyperextension: '0103',
  shrugs: '0030',
  ohp: '0004',
  'db-shoulder-press': '0038',
  'lateral-raise': '0018',
  'rear-delt-fly': '0023',
  'barbell-curl': '0211',
  'db-curl': '0224',
  'hammer-curl': '0227',
  'triceps-pushdown': '0205',
  'french-press': '0183',
  'close-grip-bench': '0049',
  squat: '0122',
  'front-squat': '0138',
  'leg-press': '0127',
  lunges: '0115',
  'bulgarian-split': '0132',
  'leg-extension': '0142',
  'leg-curl': '0117',
  rdl: '0118',
  'calf-raise': '0281',
  'hip-thrust': '0109',
  crunches: '0291',
  'ab-wheel': '0286',
  'kb-snatch': '0148',
};

/** Рисунок взят от похожего упражнения набора (точного нет) — так и подписывается. */
export const APPROXIMATE_IMAGES: ReadonlySet<string> = new Set([
  'fly-machine', // разводка гантелей лёжа
  'clap-pushups', // обычные отжимания
  'pullups-weighted', // подтягивания без отягощения
  'lat-pulldown', // тяга обратным хватом
  'barbell-row', // тяга штанги обратным хватом
  'db-row', // тяга гантели на заднюю дельту
  'db-shoulder-press', // жим одной рукой
  'bulgarian-split', // приседание на одной ноге со штангой
  'hip-thrust', // ягодичный мостик без штанги
  'kb-snatch', // рывок штанги одной рукой
]);

export const EXERCISE_IMAGE_CREDIT = 'Рисунок: Everkinetic (Greg Priday), CC BY-SA 4.0';

/** Подпись под рисунком: автор и лицензия, для похожих — пометка. */
export function exerciseImageCredit(exerciseId: string): string {
  const slug = exerciseId.startsWith('lib:') ? exerciseId.slice(4) : exerciseId;
  return APPROXIMATE_IMAGES.has(slug) ? `Похожее упражнение из набора. ${EXERCISE_IMAGE_CREDIT}` : EXERCISE_IMAGE_CREDIT;
}
export const EXERCISE_IMAGE_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru';

/** Путь к рисунку встроенного упражнения относительно корня сайта или null, если рисунка нет. */
export function exerciseImagePath(exerciseId: string): string | null {
  if (!exerciseId.startsWith('lib:')) return null;
  const slug = exerciseId.slice(4);
  return EXERCISE_IMAGE_SOURCE[slug] ? `exercises/${slug}.svg` : null;
}
