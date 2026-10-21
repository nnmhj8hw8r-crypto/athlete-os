// Поиск продуктов по названию, как в дневниках питания: слова запроса в любом порядке,
// без учёта регистра и разницы «е/ё». «греческий йогурт» находит «Йогурт греческий, натуральный».

export function normalizeSearchText(s: string): string {
  return s
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .trim();
}

export function searchWords(query: string): string[] {
  const n = normalizeSearchText(query);
  return n ? n.split(' ') : [];
}

/**
 * Каждое слово запроса должно быть началом какого-то слова в тексте:
 * «греч йог» найдёт «Йогурт греческий», а «рис» не найдёт «барбарис».
 */
export function matchesQuery(text: string, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const tokens = normalizeSearchText(text).split(' ');
  return words.every((w) => tokens.some((t) => t.startsWith(w)));
}

/** Чем раньше в названии встречается первое слово запроса, тем выше результат; затем — короче название. */
export function rankByQuery<T>(items: readonly T[], query: string, textOf: (item: T) => string, limit = 50): T[] {
  const words = searchWords(query);
  if (words.length === 0) return items.slice(0, limit);
  const first = words[0]!;
  return items
    .filter((it) => matchesQuery(textOf(it), words))
    .map((it) => {
      const tokens = normalizeSearchText(textOf(it)).split(' ');
      const pos = tokens.findIndex((t) => t.startsWith(first));
      return { it, pos, len: tokens.length };
    })
    .sort((a, b) => a.pos - b.pos || a.len - b.len)
    .slice(0, limit)
    .map((x) => x.it);
}
