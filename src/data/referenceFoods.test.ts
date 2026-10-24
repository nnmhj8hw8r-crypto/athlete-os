// Целостность сгенерированного справочника: у каждого типового блюда все ингредиенты
// (кроме воды) существуют в базе. Ломается только при пересборке scripts/build-reference-foods.py.
import { describe, expect, it } from 'vitest';
import { REFERENCE_FOODS } from './referenceFoods.ts';

describe('справочник продуктов (сгенерирован)', () => {
  it('у каждого блюда каждый ингредиент есть в базе', () => {
    const ids = new Set(REFERENCE_FOODS.map((f) => f.id));
    const problems: string[] = [];
    for (const dish of REFERENCE_FOODS.filter((f) => f.kind === 'dish')) {
      for (const ing of dish.recipe?.ingredients ?? []) {
        if (ing.id === 'water') continue;
        if (!ids.has(ing.id)) problems.push(`блюдо «${dish.name}»: ингредиент ${ing.id}`);
      }
    }
    expect(problems.join('; '), 'ингредиенты вне базы').toBe('');
  });
});
