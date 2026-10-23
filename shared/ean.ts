// Проверка штрихкодов EAN-8 / EAN-13 (UPC-A из 12 цифр дополняется нулём до EAN-13).

/** Оставляет только цифры: пробелы и дефисы при ручном вводе допустимы. */
export function normalizeBarcode(input: string): string {
  const digits = input.replace(/[\s-]/g, '');
  return /^\d+$/.test(digits) ? digits : '';
}

function checkDigitValid(code: string): boolean {
  const digits = code.split('').map(Number);
  const check = digits.pop();
  let sum = 0;
  // Справа налево: ближайшая к контрольной цифра умножается на 3, следующая на 1 и т. д.
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Возвращает нормализованный EAN-8/EAN-13 или null, если код некорректен
 * (не та длина, есть не-цифры или не сходится контрольная цифра).
 */
export function parseEan(input: string): string | null {
  let code = normalizeBarcode(input);
  if (code.length === 12) code = `0${code}`;
  if (code.length !== 8 && code.length !== 13) return null;
  return checkDigitValid(code) ? code : null;
}

/** UPC-E (8 цифр, сжатый американский код) → UPC-A (12 цифр) по правилам GS1. */
export function upcEToUpcA(upce: string): string | null {
  if (!/^[01]\d{7}$/.test(upce)) return null;
  const [ns, d1, d2, d3, d4, d5, d6, check] = upce.split('') as [string, string, string, string, string, string, string, string];
  let body: string;
  if ('012'.includes(d6)) body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${ns}${body}${check}`;
}

export type ScannedCode = { kind: 'ean'; code: string } | { kind: 'url'; url: string } | { kind: 'unknown'; text: string };

/** GTIN-14 с ведущим нулём — это EAN-13 (так штрихкод записан в DataMatrix «Честного знака» и GS1-ссылках). */
function fromGtin(gtin: string): string | null {
  if (gtin.length === 14) return gtin.startsWith('0') ? parseEan(gtin.slice(1)) : null;
  return parseEan(gtin);
}

/**
 * Что внутри отсканированного кода: штрихкод товара (EAN/UPC), GS1 DataMatrix «Честного знака»
 * (01 + GTIN-14 …), ссылка GS1 Digital Link (…/01/<GTIN>), ссылка на Open Food Facts или просто текст/ссылка.
 */
export function parseScannedCode(raw: string, format?: string): ScannedCode {
  const text = raw.trim();
  if (format === 'UPC_E') {
    const a = upcEToUpcA(normalizeBarcode(text));
    const ean = a ? parseEan(a) : null;
    if (ean) return { kind: 'ean', code: ean };
  }
  const plain = parseEan(text);
  if (plain) return { kind: 'ean', code: plain };
  const digits = normalizeBarcode(text);
  if (digits.length === 14) {
    const g = fromGtin(digits);
    if (g) return { kind: 'ean', code: g };
  }
  // GS1 element string: возможный префикс символики (]d2, ]C1, ]Q3), затем AI 01 и 14 цифр GTIN.
  // Разделитель групп GS1 (символ 29) убираем заранее — управляющий символ в регулярке не нужен.
  const gs1 = /^(?:\][A-Za-z]\d)?01(\d{14})/.exec(text.split(String.fromCharCode(29)).join(''));
  if (gs1) {
    const g = fromGtin(gs1[1]!);
    if (g) return { kind: 'ean', code: g };
  }
  if (/^https?:\/\//i.test(text)) {
    const link = /\/01\/(\d{8,14})(?:[/?#]|$)/.exec(text) ?? /openfoodfacts\.org\/product\/(\d{8,14})/i.exec(text);
    const g = link ? fromGtin(link[1]!) : null;
    return g ? { kind: 'ean', code: g } : { kind: 'url', url: text };
  }
  // Цифры штрихкода внутри текста («EAN: 4601234567890»).
  for (const m of text.matchAll(/\d{8,14}/g)) {
    const g = fromGtin(m[0]);
    if (g) return { kind: 'ean', code: g };
  }
  return { kind: 'unknown', text };
}
