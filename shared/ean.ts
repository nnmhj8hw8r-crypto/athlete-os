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
