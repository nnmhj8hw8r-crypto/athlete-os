import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { emptyToUndefined, numberToField, parseDecimal, toFieldErrors } from './form.ts';

describe('parseDecimal', () => {
  it('понимает запятую и точку', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal(' 1 000 ')).toBe(1000);
  });

  it('пустое поле — undefined, мусор — NaN', () => {
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('   ')).toBeUndefined();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
  });

  it('распознаёт отрицательные числа, чтобы схема могла их отклонить', () => {
    expect(parseDecimal('-5')).toBe(-5);
  });
});

describe('вспомогательные функции форм', () => {
  it('emptyToUndefined', () => {
    expect(emptyToUndefined('  ')).toBeUndefined();
    expect(emptyToUndefined(' a ')).toBe('a');
  });

  it('numberToField показывает запятую', () => {
    expect(numberToField(1.5)).toBe('1,5');
    expect(numberToField(undefined)).toBe('');
  });

  it('toFieldErrors даёт русские сообщения для пустых и нечисловых полей', () => {
    const schema = z.object({ a: z.number(), b: z.number(), c: z.number().min(0, 'Не меньше 0') });
    const input = { a: undefined, b: Number.NaN, c: -1 };
    const r = schema.safeParse(input);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(toFieldErrors(r.error, input)).toEqual({
        a: 'Заполните поле',
        b: 'Введите корректное число',
        c: 'Не меньше 0',
      });
    }
  });
});
