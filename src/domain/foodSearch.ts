// Умный поиск еды: русская морфология (стеммер Snowball), синонимы и разговорные названия,
// исправление опечаток, частичное совпадение и ранжирование с приоритетом истории пользователя.
//
// Почему раньше «картошка» не находила «картофель»: поиск требовал, чтобы слово запроса было началом
// слова в названии. «картошка» и «картофель» — разные корни, без словаря синонимов их не связать,
// а «пюре» отсутствовало в базе. Теперь: нормализация → стемминг → синонимы → нечёткое сравнение.
import { stemRu } from './russianStemmer.ts';

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
 * Группы слов с одним смыслом: разговорные названия, однокоренные с другим корнем, профессиональные термины.
 * Сравнение идёт по основам (стеммер), поэтому падежи и числа учитывать не нужно.
 */
const SYNONYM_GROUPS: string[][] = [
  ['картошка', 'картофель', 'картофельный', 'картоха', 'картофан'],
  ['пюре', 'толченка', 'толченый'],
  ['курица', 'куриный', 'цыпленок', 'курятина', 'бройлер'],
  ['говядина', 'говяжий', 'телятина'],
  ['свинина', 'свиной'],
  ['индейка', 'индюшка', 'индюшатина'],
  ['баранина', 'бараний', 'ягнятина'],
  ['гречка', 'гречневый', 'гречиха'],
  ['овсянка', 'овсяный', 'геркулес'],
  ['рис', 'рисовый'],
  ['пшено', 'пшенный', 'пшенка'],
  ['манка', 'манный'],
  ['перловка', 'перловый'],
  ['макароны', 'паста', 'спагетти', 'вермишель', 'рожки', 'лапша'],
  ['яйцо', 'яичный', 'яичко', 'яичница'],
  ['творог', 'творожный', 'творожок'],
  ['молоко', 'молочный'],
  ['кефир', 'кефирный'],
  ['сыр', 'сырный'],
  ['сметана', 'сметанный'],
  ['рыба', 'рыбный'],
  ['семга', 'лосось', 'лососевый'],
  ['селедка', 'сельдь'],
  ['помидор', 'томат', 'томатный'],
  ['огурец', 'огурчик', 'огуречный'],
  ['морковь', 'морковка', 'морковный'],
  ['свекла', 'свекольный', 'буряк'],
  ['капуста', 'капустный'],
  ['лук', 'луковый'],
  ['хлеб', 'хлебный', 'батон', 'буханка'],
  ['колбаса', 'колбаска', 'колбасный'],
  ['сосиска', 'сарделька'],
  ['банан', 'банановый'],
  ['яблоко', 'яблочный'],
  ['апельсин', 'апельсиновый'],
  ['кофе', 'кофейный', 'капучино', 'латте', 'американо'],
  ['чай', 'чайный'],
  ['котлета', 'котлетка'],
  ['суп', 'супчик', 'похлебка'],
  ['каша', 'кашка'],
  ['орех', 'ореховый', 'орешек', 'орешки'],
  ['гриб', 'грибной', 'шампиньон'],
  ['шоколад', 'шоколадный', 'шоколадка'],
  ['мороженое', 'пломбир'],
  ['газировка', 'кола', 'лимонад'],
  ['сок', 'фреш'],
  ['протеин', 'протеиновый'],
  ['майонез', 'майонезный'],
  ['масло', 'масляный'],
];

const stemOf = (w: string) => stemRu(w);
const STEM_TO_GROUP = new Map<string, Set<string>>();
for (const group of SYNONYM_GROUPS) {
  const stems = new Set(group.map(stemOf));
  for (const s of stems) STEM_TO_GROUP.set(s, stems);
}

/** Синонимы основы (включая её саму). */
export function synonymStems(stem: string): Set<string> {
  return STEM_TO_GROUP.get(stem) ?? new Set([stem]);
}

/** Расстояние Дамерау–Левенштейна (с перестановкой соседних букв), с ранним выходом при превышении max. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

/** Сколько опечаток допускать: короткие слова — ни одной, длинные — до двух. */
const allowedTypos = (len: number) => (len < 4 ? 0 : len < 7 ? 1 : 2);

interface QueryWord {
  raw: string;
  stem: string;
  synonyms: Set<string>;
  typos: number;
}

interface IndexedDoc<T> {
  item: T;
  tokens: string[];
  stems: string[];
}

export interface SearchDoc {
  name: string;
  aliases?: readonly string[];
  brand?: string;
}

export interface SearchIndex<T> {
  docs: IndexedDoc<T>[];
}

export function createSearchIndex<T>(items: readonly T[], docOf: (item: T) => SearchDoc): SearchIndex<T> {
  return {
    docs: items.map((item) => {
      const d = docOf(item);
      const text = [d.name, ...(d.aliases ?? []), d.brand ?? ''].join(' ');
      const tokens = [...new Set(normalizeSearchText(text).split(' ').filter(Boolean))];
      return { item, tokens, stems: tokens.map(stemOf) };
    }),
  };
}

/** Оценка совпадения одного слова запроса с документом (0 — не найдено). */
function scoreWord(w: QueryWord, doc: IndexedDoc<unknown>): { score: number; first: boolean } {
  let best = 0;
  let first = false;
  for (let i = 0; i < doc.tokens.length; i++) {
    const t = doc.tokens[i]!;
    const s = doc.stems[i]!;
    let sc = 0;
    if (t === w.raw) sc = 100;
    else if (w.raw.length >= 2 && t.startsWith(w.raw)) sc = 92;
    else if (w.stem.length >= 3 && (s === w.stem || s.startsWith(w.stem) || t.startsWith(w.stem))) sc = 85;
    else {
      for (const syn of w.synonyms) {
        if (syn !== w.stem && syn.length >= 2 && (s === syn || s.startsWith(syn))) {
          // Синоним — почти то же слово («картошка» = «картофель»), поэтому оценка близка к точной.
          sc = 88;
          break;
        }
      }
      if (!sc && w.typos > 0 && t[0] === w.raw[0]) {
        // Опечатка: сравниваем основы; для слов от 5 букв ещё и начало слова (пользователь мог не дописать).
        // Для коротких слов сравнение по началу даёт ложные совпадения («борщ» ≈ «боро-динский»).
        const prefixDist = w.raw.length >= 5 ? editDistance(w.raw, t.slice(0, w.raw.length), w.typos) : w.typos + 1;
        const dist = Math.min(editDistance(w.stem, s, w.typos), prefixDist);
        if (dist <= w.typos) sc = 60 - dist * 10;
      }
    }
    if (sc > best) {
      best = sc;
      first = i === 0;
    }
  }
  return { score: best, first };
}

export interface SearchHit<T> {
  item: T;
  score: number;
  /** Найдены все слова запроса. false — частичное совпадение. */
  full: boolean;
}

export interface SearchOptions<T> {
  limit?: number;
  /** Дополнительные очки: история употребления, «мои продукты» и т. п. (0–40). */
  boost?: (item: T) => number;
}

export function searchIndex<T>(index: SearchIndex<T>, query: string, opts: SearchOptions<T> = {}): SearchHit<T>[] {
  const words = searchWords(query);
  const limit = opts.limit ?? 50;
  if (words.length === 0) return [];
  const qw: QueryWord[] = words.map((raw) => {
    const stem = stemOf(raw);
    return { raw, stem, synonyms: synonymStems(stem), typos: allowedTypos(raw.length) };
  });

  const hits: SearchHit<T>[] = [];
  for (const doc of index.docs) {
    let sum = 0;
    let matched = 0;
    let firstBonus = 0;
    for (let k = 0; k < qw.length; k++) {
      const r = scoreWord(qw[k]!, doc);
      if (r.score > 0) {
        matched++;
        sum += r.score;
        if (k === 0 && r.first) firstBonus = 8;
      }
    }
    if (matched === 0) continue;
    const full = matched === qw.length;
    // Частичное совпадение показываем, только если найдено больше половины слов.
    if (!full && matched * 2 <= qw.length) continue;
    const extraTokens = Math.max(0, doc.tokens.length - qw.length);
    let score = sum / qw.length + firstBonus - Math.min(6, extraTokens * 0.5) + (opts.boost?.(doc.item) ?? 0);
    if (!full) score -= 40;
    hits.push({ item: doc.item, score, full });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Простой вариант для небольших списков без отдельного индекса. */
export function rankByQuery<T>(items: readonly T[], query: string, textOf: (item: T) => string, limit = 50): T[] {
  if (searchWords(query).length === 0) return items.slice(0, limit);
  return searchIndex(createSearchIndex(items, (it) => ({ name: textOf(it) })), query, { limit }).map((h) => h.item);
}

/** Совпадают ли все слова запроса (для фильтров и тестов). */
export function matchesQuery(text: string, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const hits = searchIndex(createSearchIndex([text], (t) => ({ name: t })), words.join(' '));
  return hits.length > 0 && hits[0]!.full;
}
