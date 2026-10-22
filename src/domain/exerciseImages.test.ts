import { describe, expect, it } from 'vitest';
import { libraryExercise } from './exerciseLibrary.ts';
import { APPROXIMATE_IMAGES, EXERCISE_IMAGE_SOURCE, exerciseImageCredit, exerciseImagePath } from './exerciseImages.ts';

// Список файлов в public/exercises (через Vite, без доступа к файловой системе из клиентского кода).
const files = import.meta.glob('/public/exercises/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const names = new Set(Object.keys(files).map((p) => p.split('/').pop()));

describe('рисунки упражнений Everkinetic', () => {
  it('каждый рисунок привязан к существующему упражнению и лежит в public/exercises', () => {
    for (const slug of Object.keys(EXERCISE_IMAGE_SOURCE)) {
      expect(libraryExercise(`lib:${slug}`), slug).toBeDefined();
      expect(names.has(`${slug}.svg`), slug).toBe(true);
    }
  });

  it('рядом с рисунками лежит файл лицензии CC BY-SA 4.0', () => {
    expect(files['/public/exercises/LICENSE.txt']).toMatch(/CC BY-SA 4\.0/);
  });

  it('похожие рисунки подписаны и все есть в списке рисунков', () => {
    for (const slug of APPROXIMATE_IMAGES) expect(EXERCISE_IMAGE_SOURCE[slug], slug).toBeDefined();
    expect(exerciseImageCredit('lib:fly-machine')).toMatch(/^Похожее упражнение/);
    expect(exerciseImageCredit('lib:squat')).not.toMatch(/Похожее/);
  });

  it('путь есть только у встроенных упражнений с рисунком', () => {
    expect(exerciseImagePath('lib:squat')).toBe('exercises/squat.svg');
    expect(exerciseImagePath('lib:randori-standing')).toBeNull();
    expect(exerciseImagePath('squat')).toBeNull();
  });
});
