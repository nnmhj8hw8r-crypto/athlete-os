import { describe, expect, it } from 'vitest';
import { REFERENCE_FOODS } from '../data/referenceFoods.ts';
import { matchesQuery, rankByQuery, searchWords } from './foodSearch.ts';

describe('поиск продуктов по названию', () => {
  it('слова в любом порядке, без учёта регистра и ё', () => {
    const w = searchWords('Греческий  ЙОГУРТ');
    expect(matchesQuery('Йогурт греческий, натуральный', w)).toBe(true);
    expect(matchesQuery('Свёкла, сырая', searchWords('свекла'))).toBe(true);
  });

  it('слово запроса — начало слова в названии, а не любая подстрока', () => {
    expect(matchesQuery('Йогурт греческий', searchWords('греч йог'))).toBe(true);
    expect(matchesQuery('Барбарис', searchWords('рис'))).toBe(false);
  });

  it('пустой запрос подходит ко всему', () => {
    expect(matchesQuery('что угодно', searchWords('  '))).toBe(true);
  });

  it('выше то, что начинается с запроса', () => {
    const items = ['Масло сливочное', 'Сливки жирные', 'Сливочный сыр'];
    expect(rankByQuery(items, 'слив', (s) => s)[0]).toBe('Сливки жирные');
  });
});

describe('встроенный справочник USDA', () => {
  it('корректные значения на 100 г', () => {
    expect(REFERENCE_FOODS.length).toBeGreaterThan(100);
    const ids = new Set<string>();
    for (const f of REFERENCE_FOODS) {
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
      const { kcal, protein, fat, carbs } = f.per100;
      for (const v of [kcal, protein, fat, carbs]) expect(v).toBeGreaterThanOrEqual(0);
      expect(protein + fat + carbs).toBeLessThanOrEqual(100.5);
    }
  });

  it('находит варианты греческого йогурта и яичный белок', () => {
    const yog = rankByQuery(REFERENCE_FOODS, 'греческий йогурт', (f) => f.name);
    expect(yog.length).toBeGreaterThanOrEqual(3);
    const white = rankByQuery(REFERENCE_FOODS, 'яичный белок', (f) => f.name)[0];
    expect(white?.per100).toEqual({ kcal: 52, protein: 10.9, fat: 0.2, carbs: 0.7 });
  });
});
