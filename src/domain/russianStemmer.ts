// Стеммер русского языка по алгоритму Snowball (Porter), https://snowballstem.org/algorithms/russian/stemmer.html
// Отсекает окончания и суффиксы: «картофельное» → «картофельн», «гречневая» → «гречнев», «яйца» → «яйц».
// Разные корни («картошка» / «картофель») он не объединяет — для этого словарь синонимов в foodSearch.ts.

const VOWELS = new Set('аеиоуыэюя');

const PERFECTIVE_GERUND_1 = ['вшись', 'вши', 'в']; // после а/я
const PERFECTIVE_GERUND_2 = ['ившись', 'ывшись', 'ивши', 'ывши', 'ив', 'ыв'];
const REFLEXIVE = ['ся', 'сь'];
const ADJECTIVE = ['ими', 'ыми', 'его', 'ого', 'ему', 'ому', 'ее', 'ие', 'ые', 'ое', 'ей', 'ий', 'ый', 'ой', 'ем', 'им', 'ым', 'ом', 'их', 'ых', 'ую', 'юю', 'ая', 'яя', 'ою', 'ею'];
const PARTICIPLE_1 = ['ем', 'нн', 'вш', 'ющ', 'щ']; // после а/я
const PARTICIPLE_2 = ['ивш', 'ывш', 'ующ'];
const VERB_1 = ['ла', 'на', 'ете', 'йте', 'ли', 'й', 'л', 'ем', 'н', 'ло', 'но', 'ет', 'ют', 'ны', 'ть', 'ешь', 'нно']; // после а/я
const VERB_2 = ['ила', 'ыла', 'ена', 'ейте', 'уйте', 'ите', 'или', 'ыли', 'ей', 'уй', 'ил', 'ыл', 'им', 'ым', 'ен', 'ило', 'ыло', 'ено', 'ят', 'ует', 'уют', 'ит', 'ыт', 'ены', 'ить', 'ыть', 'ишь', 'ую', 'ю'];
const NOUN = ['иями', 'ями', 'ами', 'иях', 'ием', 'ией', 'иям', 'ев', 'ов', 'ие', 'ье', 'еи', 'ии', 'ей', 'ой', 'ий', 'ям', 'ем', 'ам', 'ом', 'ах', 'ях', 'ию', 'ью', 'ия', 'ья', 'а', 'е', 'и', 'й', 'о', 'у', 'ы', 'ь', 'ю', 'я'];
const SUPERLATIVE = ['ейше', 'ейш'];
const DERIVATIONAL = ['ость', 'ост'];

const byLength = (list: string[]) => [...list].sort((a, b) => b.length - a.length);
const G1 = byLength(PERFECTIVE_GERUND_1);
const G2 = byLength(PERFECTIVE_GERUND_2);
const ADJ = byLength(ADJECTIVE);
const P1 = byLength(PARTICIPLE_1);
const P2 = byLength(PARTICIPLE_2);
const V1 = byLength(VERB_1);
const V2 = byLength(VERB_2);
const N = byLength(NOUN);

/** Начало зоны RV: после первой гласной. */
function regions(word: string): { rv: number; r2: number } {
  let rv = word.length;
  for (let i = 0; i < word.length; i++) {
    if (VOWELS.has(word[i]!)) {
      rv = i + 1;
      break;
    }
  }
  // R1 — после первой согласной, идущей за гласной; R2 — то же внутри R1.
  const after = (start: number) => {
    for (let i = start + 1; i < word.length; i++) {
      if (!VOWELS.has(word[i]!) && VOWELS.has(word[i - 1]!)) return i + 1;
    }
    return word.length;
  };
  const r1 = after(0);
  const r2 = after(r1);
  return { rv, r2 };
}

/** Длиннейшее окончание из списка, целиком лежащее в зоне; для групп «после а/я» — с проверкой предшествующей буквы. */
function findSuffix(word: string, from: number, list: string[], afterAYa = false): string | null {
  for (const s of list) {
    if (!word.endsWith(s)) continue;
    const start = word.length - s.length;
    if (start < from) continue;
    if (afterAYa) {
      const prev = word[start - 1];
      if (start - 1 < from || (prev !== 'а' && prev !== 'я')) continue;
    }
    return s;
  }
  return null;
}

const cut = (word: string, suffix: string | null) => (suffix ? word.slice(0, word.length - suffix.length) : word);

export function stemRu(input: string): string {
  let word = input.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  if (word.length < 3 || !/^[а-я]+$/.test(word)) return word;
  const { rv, r2 } = regions(word);

  // Шаг 1
  const gerund = findSuffix(word, rv, G1, true) ?? findSuffix(word, rv, G2);
  if (gerund) {
    word = cut(word, gerund);
  } else {
    word = cut(word, findSuffix(word, rv, REFLEXIVE));
    const adj = findSuffix(word, rv, ADJ);
    if (adj) {
      word = cut(word, adj);
      word = cut(word, findSuffix(word, rv, P1, true) ?? findSuffix(word, rv, P2));
    } else {
      const verb = findSuffix(word, rv, V1, true) ?? findSuffix(word, rv, V2);
      word = verb ? cut(word, verb) : cut(word, findSuffix(word, rv, N));
    }
  }

  // Шаг 2
  if (word.endsWith('и') && word.length - 1 >= rv) word = word.slice(0, -1);

  // Шаг 3
  word = cut(word, findSuffix(word, r2, DERIVATIONAL));

  // Шаг 4
  if (word.endsWith('нн') && word.length - 2 >= rv) {
    word = word.slice(0, -1);
  } else {
    const sup = findSuffix(word, rv, SUPERLATIVE);
    if (sup) {
      word = cut(word, sup);
      if (word.endsWith('нн') && word.length - 2 >= rv) word = word.slice(0, -1);
    } else if (word.endsWith('ь') && word.length - 1 >= rv) {
      word = word.slice(0, -1);
    }
  }
  return word;
}
