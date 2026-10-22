import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY, buildCatalog, libraryExercise, searchCatalog } from './exerciseLibrary.ts';

describe('встроенный каталог упражнений', () => {
  it('id и названия уникальны', () => {
    expect(new Set(EXERCISE_LIBRARY.map((e) => e.id)).size).toBe(EXERCISE_LIBRARY.length);
    expect(new Set(EXERCISE_LIBRARY.map((e) => e.name.toLowerCase())).size).toBe(EXERCISE_LIBRARY.length);
  });

  it('названия и подсказки поиска — на русском (без латиницы в названии)', () => {
    for (const e of EXERCISE_LIBRARY) expect(e.name).not.toMatch(/[a-z]/i);
  });

  it('есть упражнения для дня борьбы', () => {
    expect(libraryExercise('lib:randori-ground')?.metric).toBe('rounds');
    expect(libraryExercise('lib:randori-standing')?.metric).toBe('rounds');
    expect(libraryExercise('lib:analysis')?.metric).toBe('check');
  });

  it('своё упражнение с тем же названием заменяет встроенное', () => {
    const own = { id: 'own', name: 'подтягивания', group: 'back' as const, metric: 'weight_reps' as const, createdAt: '', updatedAt: '' };
    const cat = buildCatalog([own]);
    expect(cat.filter((e) => e.name.toLowerCase() === 'подтягивания')).toHaveLength(1);
    expect(cat[0]).toMatchObject({ id: 'own', builtIn: false, metric: 'weight_reps' });
    expect(cat.length).toBe(EXERCISE_LIBRARY.length);
  });

  it('у своего упражнения без группы — «Другое», вес × повторения', () => {
    const cat = buildCatalog([{ id: 'x', name: 'Своё', createdAt: '', updatedAt: '' }]);
    expect(cat[0]).toMatchObject({ group: 'other', metric: 'weight_reps', muscles: [] });
  });
});

describe('без раздела «Разминка»', () => {
  it('в каталоге нет группы «Разминка», старые id по-прежнему находятся', () => {
    expect(EXERCISE_LIBRARY.some((e) => e.group === 'warmup')).toBe(false);
    expect(buildCatalog([]).some((e) => e.id === 'lib:warmup-general')).toBe(false);
    expect(libraryExercise('lib:warmup-general')?.name).toBe('Общая разминка');
    expect(buildCatalog([{ id: 'w', name: 'Моя разминка', group: 'warmup', createdAt: '', updatedAt: '' }])[0]?.group).toBe('other');
  });
});

describe('поиск упражнений', () => {
  it('ищет по словам в любом порядке, по другим названиям и с ё/е', () => {
    expect(searchCatalog(EXERCISE_LIBRARY, 'лежа жим').map((e) => e.id)).toContain('lib:bench-press');
    expect(searchCatalog(EXERCISE_LIBRARY, 'рандори').map((e) => e.id)).toContain('lib:randori-standing');
    expect(searchCatalog(EXERCISE_LIBRARY, 'канат без').map((e) => e.id)).toEqual(['lib:rope-climb-nolegs']);
    expect(searchCatalog(EXERCISE_LIBRARY, '')).toHaveLength(EXERCISE_LIBRARY.length);
  });
});
