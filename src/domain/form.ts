// Разбор значений из полей формы. Поля всегда строковые; здесь они превращаются
// в числа и необязательные значения, а ошибки схемы — в подписи под полями.
import type { z } from 'zod';

/**
 * Число из текстового поля. Запятая допустима (клавиатура iPhone в русской раскладке).
 * Пустое поле → undefined, нечисловой ввод → NaN (схема покажет ошибку).
 */
export function parseDecimal(value: string): number | undefined {
  const v = value.trim().replace(/\s/g, '').replace(',', '.');
  if (v === '') return undefined;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(v)) return Number.NaN;
  return Number(v);
}

export function emptyToUndefined(value: string): string | undefined {
  const v = value.trim();
  return v === '' ? undefined : v;
}

export type FieldErrors = Record<string, string>;

function valueAt(input: unknown, path: readonly PropertyKey[]): unknown {
  let cur = input;
  for (const p of path) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[p];
  }
  return cur;
}

/**
 * Первая ошибка для каждого поля. Ключ — путь через точку, например 'per100.kcal'.
 * Сообщения о неверном типе (стандартные, на английском) заменяются понятными,
 * для чего нужен проверявшийся объект input.
 */
export function toFieldErrors(error: z.ZodError, input?: unknown): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (key in out) continue;
    if (issue.code === 'invalid_type') {
      out[key] = valueAt(input, issue.path) === undefined ? 'Заполните поле' : 'Введите корректное число';
    } else {
      out[key] = issue.message;
    }
  }
  return out;
}

export function numberToField(n: number | undefined): string {
  return n === undefined ? '' : String(n).replace('.', ',');
}
