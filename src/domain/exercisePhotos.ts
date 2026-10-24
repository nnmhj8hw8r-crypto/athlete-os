// Фото упражнений без рисунка Everkinetic (v0.10): кардио, канат, борьба. Пользователь отказался от
// пиктограмм-«стикменов»; эти фото со свободными лицензиями взяты с Wikimedia Commons (проверено 24.10.2026,
// исходные страницы и авторы — scripts/exercise-photos-credits.json). Файлы — public/exercises/photos/<фото>.jpg,
// уменьшены до 500–800 px. Для степпера и акробатики подходящих свободных фото не нашлось — там пиктограмма.

export interface ExercisePhoto {
  file: string;
  credit: string;
  licenseUrl?: string;
}

const BY_SA_2 = 'https://creativecommons.org/licenses/by-sa/2.0/deed.ru';
const BY_SA_3 = 'https://creativecommons.org/licenses/by-sa/3.0/deed.ru';
const BY_SA_4 = 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru';
const BY_4 = 'https://creativecommons.org/licenses/by/4.0/deed.ru';

const PHOTOS: Record<string, ExercisePhoto> = {
  run: { file: 'run', credit: 'Фото: автор с Flickr из Джэксона (Миссисипи, США), Wikimedia Commons, CC BY-SA 2.0', licenseUrl: BY_SA_2 },
  sprint: { file: 'sprint', credit: 'Фото: LexSprinter, Wikimedia Commons, CC BY-SA 3.0', licenseUrl: BY_SA_3 },
  treadmill: { file: 'treadmill', credit: 'Фото: Larry D. Moore, Wikimedia Commons, CC BY 4.0', licenseUrl: BY_4 },
  bike: { file: 'bike', credit: 'Фото: KMJ, Wikimedia Commons, CC BY-SA 3.0', licenseUrl: BY_SA_3 },
  airbike: { file: 'airbike', credit: 'Фото: Министерство обороны США, общественное достояние' },
  rower: { file: 'rower', credit: 'Фото: Erin Currie (ВВС США), общественное достояние' },
  jumpRope: { file: 'jump-rope', credit: 'Фото: Pambelle12, Wikimedia Commons, CC BY-SA 4.0', licenseUrl: BY_SA_4 },
  elliptical: { file: 'elliptical', credit: 'Фото: автор не указан (предположительно Cpetro45), Wikimedia Commons, CC BY-SA 3.0', licenseUrl: BY_SA_3 },
  judoGrip: { file: 'judo-grip', credit: 'Фото: Eva Rinaldi, Wikimedia Commons, CC BY-SA 2.0', licenseUrl: BY_SA_2 },
  judoThrow: { file: 'judo-throw', credit: 'Рисунок: Michael Hultström, Wikimedia Commons, CC BY-SA 3.0', licenseUrl: BY_SA_3 },
  judoGround: { file: 'judo-ground', credit: 'Фото: Eva Rinaldi, Wikimedia Commons, CC BY-SA 2.0', licenseUrl: BY_SA_2 },
  bridge: { file: 'bridge', credit: 'Фото: Chris Hunkeler, Wikimedia Commons, CC BY-SA 2.0', licenseUrl: BY_SA_2 },
  ropeClimb: { file: 'rope-climb', credit: 'Фото: Samuell1990, Wikimedia Commons, CC BY-SA 4.0', licenseUrl: BY_SA_4 },
};

/** Слаг встроенного упражнения → фото. Одно фото может подходить нескольким упражнениям. */
const BY_EXERCISE: Record<string, keyof typeof PHOTOS> = {
  run: 'run',
  sprint: 'sprint',
  'treadmill-run': 'treadmill',
  'treadmill-walk': 'treadmill',
  bike: 'bike',
  airbike: 'airbike',
  rower: 'rower',
  'jump-rope': 'jumpRope',
  elliptical: 'elliptical',
  technique: 'judoGrip',
  'randori-standing': 'judoGrip',
  sparring: 'judoGrip',
  uchikomi: 'judoGrip',
  'grip-fight': 'judoGrip',
  nagekomi: 'judoThrow',
  'ne-waza-drill': 'judoGround',
  'randori-ground': 'judoGround',
  bridge: 'bridge',
  'rope-climb': 'ropeClimb',
  'rope-climb-nolegs': 'ropeClimb',
};

export function exercisePhoto(exerciseId: string): (ExercisePhoto & { path: string }) | null {
  if (!exerciseId.startsWith('lib:')) return null;
  const key = BY_EXERCISE[exerciseId.slice(4)];
  if (!key) return null;
  const p = PHOTOS[key]!;
  return { ...p, path: `exercises/photos/${p.file}.jpg` };
}

/** Все фото — для страницы «Источники и лицензии». */
export const ALL_EXERCISE_PHOTOS: readonly ExercisePhoto[] = Object.values(PHOTOS);
