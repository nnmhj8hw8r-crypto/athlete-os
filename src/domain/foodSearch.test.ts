import { describe, expect, it } from 'vitest';
import { REFERENCE_FOODS } from '../data/referenceFoods.ts';
import { createSearchIndex, editDistance, matchesQuery, rankByQuery, searchIndex, searchWords } from './foodSearch.ts';
import { stemRu } from './russianStemmer.ts';

describe('стеммер русского языка', () => {
  it.each([
    ['картошка', 'картошк'],
    ['картофель', 'картофел'],
    ['картофельное', 'картофельн'],
    ['гречневая', 'гречнев'],
    ['яйца', 'яйц'],
    ['котлеты', 'котлет'],
    ['варёная', 'варен'],
  ])('%s → %s', (word, stem) => {
    expect(stemRu(word)).toBe(stem);
  });
});

describe('расстояние с опечатками', () => {
  it('замена, вставка, перестановка', () => {
    expect(editDistance('гречка', 'гречко')).toBe(1);
    expect(editDistance('творог', 'тврог')).toBe(1);
    expect(editDistance('кефир', 'кфеир')).toBe(1);
    expect(editDistance('рис', 'мясо', 2)).toBe(3);
  });
});

const index = createSearchIndex(REFERENCE_FOODS, (f) => ({ name: f.name, aliases: f.aliases }));
const top = (q: string, n = 5) => searchIndex(index, q, { limit: n }).map((h) => h.item.name);

describe('умный поиск по встроенной базе', () => {
  it('«картошка» находит картофель (синонимы)', () => {
    const names = top('картошка', 10);
    expect(names.some((n) => n.startsWith('Картофель'))).toBe(true);
  });

  it('«пюре» находит картофельное пюре', () => {
    expect(top('пюре')[0]).toMatch(/Пюре картофельное/);
  });

  it('морфология: «картофельное пюре», «гречневая каша», «вареные яйца»', () => {
    expect(top('картофельное пюре')[0]).toMatch(/Пюре картофельное/);
    expect(top('гречневая каша', 3).some((n) => n.startsWith('Гречка'))).toBe(true);
    expect(top('вареные яйца', 3).some((n) => /варёное вкрутую/.test(n))).toBe(true);
  });

  it('опечатки: «гречко», «тварог», «смитана»', () => {
    expect(top('гречко', 3).some((n) => n.startsWith('Гречка'))).toBe(true);
    expect(top('тварог', 3).some((n) => n.startsWith('Творог'))).toBe(true);
    expect(top('смитана', 3).some((n) => n.startsWith('Сметана'))).toBe(true);
  });

  it('готовые блюда: борщ, плов, оливье, пельмени', () => {
    expect(top('борщ')[0]).toBe('Борщ с говядиной');
    // короткое слово не должно нечётко совпадать с началом другого («бородинский»)
    expect(top('борщ', 10).some((n) => n.startsWith('Хлеб ржаной'))).toBe(false);
    expect(top('плов')[0]).toMatch(/^Плов/);
    expect(top('оливье')[0]).toBe('Салат оливье');
    expect(top('пельмени')[0]).toBe('Пельмени отварные');
  });

  it('незаконченное слово: «твор», «греч»', () => {
    expect(top('твор', 3).some((n) => n.startsWith('Творог'))).toBe(true);
    expect(top('греч', 3).some((n) => n.startsWith('Гречка'))).toBe(true);
  });

  it('история поднимает свой продукт выше', () => {
    const items = [{ name: 'Творог 5% (Простоквашино)' }, { name: 'Творог 2%' }];
    const idx = createSearchIndex(items, (i) => i);
    const plain = searchIndex(idx, 'творог').map((h) => h.item.name);
    const boosted = searchIndex(idx, 'творог', { boost: (i) => (i.name.includes('Простоквашино') ? 30 : 0) }).map((h) => h.item.name);
    expect(plain[0]).toBe('Творог 2%');
    expect(boosted[0]).toBe('Творог 5% (Простоквашино)');
  });

  it('частичное совпадение ниже полного', () => {
    const idx = createSearchIndex([{ name: 'Йогурт греческий' }, { name: 'Йогурт клубничный' }], (i) => i);
    const hits = searchIndex(idx, 'йогурт греческий');
    expect(hits[0]?.full).toBe(true);
    expect(hits.length).toBe(1);
  });

  it('совместимые помощники', () => {
    expect(matchesQuery('Йогурт греческий', searchWords('греческий йогурт'))).toBe(true);
    expect(rankByQuery(['Сливки', 'Масло сливочное'], 'сливк', (s) => s)[0]).toBe('Сливки');
  });
});

describe('встроенная база', () => {
  it('корректные значения на 100 г и уникальные id', () => {
    const ids = new Set<string>();
    for (const f of REFERENCE_FOODS) {
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
      const { kcal, protein, fat, carbs } = f.per100;
      for (const v of [kcal, protein, fat, carbs]) expect(v).toBeGreaterThanOrEqual(0);
      expect(protein + fat + carbs).toBeLessThanOrEqual(100.5);
    }
    expect(REFERENCE_FOODS.filter((f) => f.kind === 'dish').length).toBeGreaterThanOrEqual(20);
  });

  it('яичный белок из USDA', () => {
    const white = REFERENCE_FOODS.find((f) => f.id === 'usda:172183');
    expect(white?.per100.kcal).toBe(52);
    expect(white?.extra.sodium).toBe(166);
  });
});
