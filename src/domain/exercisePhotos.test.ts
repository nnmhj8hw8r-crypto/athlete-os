import { describe, expect, it } from 'vitest';
import { libraryExercise } from './exerciseLibrary.ts';
import { ALL_EXERCISE_PHOTOS, exercisePhoto } from './exercisePhotos.ts';

const SLUGS = ['run', 'sprint', 'treadmill-run', 'treadmill-walk', 'bike', 'airbike', 'rower', 'jump-rope', 'elliptical', 'technique', 'randori-standing', 'sparring', 'uchikomi', 'grip-fight', 'nagekomi', 'ne-waza-drill', 'randori-ground', 'bridge', 'rope-climb', 'rope-climb-nolegs'];

describe('фото упражнений', () => {
  it('канат, кардио и борьба — с фото, и все эти упражнения есть в каталоге', () => {
    expect(exercisePhoto('lib:rope-climb')?.path).toBe('exercises/photos/rope-climb.jpg');
    expect(exercisePhoto('lib:elliptical')?.credit).toContain('CC BY-SA 3.0');
    expect(exercisePhoto('lib:squat')).toBeNull();
    expect(exercisePhoto('rope-climb')).toBeNull();
    for (const s of SLUGS) {
      expect(libraryExercise(s) ?? libraryExercise(`lib:${s}`), s).toBeTruthy();
      expect(exercisePhoto(`lib:${s}`), s).not.toBeNull();
    }
  });
  it('у каждого фото указаны автор и лицензия', () => {
    for (const p of ALL_EXERCISE_PHOTOS) expect(p.credit).toMatch(/^(Фото|Рисунок): .+(CC BY|общественное достояние)/);
  });
});
