import { describe, expect, it } from 'vitest';
import { normalizeBarcode, parseEan } from './ean.ts';

describe('parseEan', () => {
  it('принимает корректный EAN-13 (пример из документации Perek.us)', () => {
    expect(parseEan('4606068171360')).toBe('4606068171360');
  });

  it('принимает EAN-13 с пробелами и дефисами', () => {
    expect(parseEan('4 606068-171360')).toBe('4606068171360');
  });

  it('принимает корректный EAN-8', () => {
    expect(parseEan('96385074')).toBe('96385074');
  });

  it('дополняет UPC-A до EAN-13', () => {
    expect(parseEan('036000291452')).toBe('0036000291452');
  });

  it('отклоняет неверную контрольную цифру', () => {
    expect(parseEan('4606068171361')).toBeNull();
  });

  it('отклоняет неверную длину, буквы и пустую строку', () => {
    expect(parseEan('12345')).toBeNull();
    expect(parseEan('46060681713AB')).toBeNull();
    expect(parseEan('')).toBeNull();
  });
});

describe('normalizeBarcode', () => {
  it('возвращает пустую строку при посторонних символах', () => {
    expect(normalizeBarcode('abc')).toBe('');
  });
});
