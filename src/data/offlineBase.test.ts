import { describe, expect, it } from 'vitest';
import { decodeEntities, parseOfflineBase } from './offlineBase.ts';

describe('офлайн-база товаров', () => {
  it('HTML-сущности в названиях показываются как текст', () => {
    expect(decodeEntities('Шаурма с соусом &quot;Бургер&quot; &amp; сыр')).toBe('Шаурма с соусом "Бургер" & сыр');
    const b = parseOfflineBase({ products: [['4600000000000', 'Сок &quot;Добрый&quot;', 'Мултон &amp; Ко', 1, 45, 0.5, 0, 10, 0]] });
    expect(b.products[0]!.name).toBe('Сок "Добрый"');
    expect(b.products[0]!.brand).toBe('Мултон & Ко');
    expect(b.products[0]!.basis).toBe('ml');
  });
});
