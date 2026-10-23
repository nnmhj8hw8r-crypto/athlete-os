import { describe, expect, it } from 'vitest';
import { normalizeBarcode, parseEan, parseScannedCode, upcEToUpcA } from './ean.ts';

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

describe('parseScannedCode', () => {
  it('обычный штрихкод и GTIN-14 с ведущим нулём', () => {
    expect(parseScannedCode('4606068171360')).toEqual({ kind: 'ean', code: '4606068171360' });
    expect(parseScannedCode('04606068171360')).toEqual({ kind: 'ean', code: '4606068171360' });
  });

  it('DataMatrix «Честного знака»: 01 + GTIN-14, дальше серийный номер', () => {
    expect(parseScannedCode('0104606068171360215abcDEF\x1d93ab12')).toEqual({ kind: 'ean', code: '4606068171360' });
    expect(parseScannedCode(']d20104606068171360215abc')).toEqual({ kind: 'ean', code: '4606068171360' });
  });

  it('ссылки GS1 Digital Link и Open Food Facts', () => {
    expect(parseScannedCode('https://id.gs1.org/01/04606068171360')).toEqual({ kind: 'ean', code: '4606068171360' });
    expect(parseScannedCode('https://example.com/01/04606068171360/21/xyz?x=1')).toEqual({ kind: 'ean', code: '4606068171360' });
    expect(parseScannedCode('https://world.openfoodfacts.org/product/4606068171360/moloko')).toEqual({ kind: 'ean', code: '4606068171360' });
  });

  it('ссылка без штрихкода и текст', () => {
    expect(parseScannedCode('https://example.com/promo')).toEqual({ kind: 'url', url: 'https://example.com/promo' });
    expect(parseScannedCode('EAN: 4606068171360')).toEqual({ kind: 'ean', code: '4606068171360' });
    expect(parseScannedCode('привет')).toEqual({ kind: 'unknown', text: 'привет' });
  });

  it('UPC-E разворачивается в UPC-A', () => {
    expect(upcEToUpcA('01234565')).toBe('012345000065');
    expect(parseScannedCode('01234565', 'UPC_E')).toEqual({ kind: 'ean', code: '0012345000065' });
  });
});
