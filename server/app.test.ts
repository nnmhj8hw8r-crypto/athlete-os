import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.ts';
import { createPerekClient, type PerekClient } from './perek.ts';

function fakePerek(over: Partial<PerekClient> = {}): PerekClient {
  return {
    enabled: true,
    search: vi.fn(async () => ({ status: 'ok' as const, exact: true, foods: [] })),
    barcode: vi.fn(async () => ({ status: 'error' as const, code: 'not_found' as const, message: 'нет' })),
    ...over,
  };
}

describe('HTTP API', () => {
  it('/api/health сообщает, включён ли Perek.us', async () => {
    const app = await buildApp({ perek: createPerekClient({ apiKey: undefined }) });
    const res = await app.inject('/api/health');
    expect(res.json()).toEqual({ ok: true, perekEnabled: false });
  });

  it('без ключа поиск отвечает 503 disabled, остальное не ломается', async () => {
    const app = await buildApp({ perek: createPerekClient({ apiKey: undefined }) });
    const res = await app.inject('/api/foods/barcode/4606068171360');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'error', code: 'disabled' });
  });

  it('проверяет штрихкод до обращения к Perek.us', async () => {
    const perek = fakePerek();
    const app = await buildApp({ perek });
    const res = await app.inject('/api/foods/barcode/4606068171361');
    expect(res.statusCode).toBe(400);
    expect(perek.barcode).not.toHaveBeenCalled();
  });

  it('передаёт 404 not_found', async () => {
    const app = await buildApp({ perek: fakePerek() });
    const res = await app.inject('/api/foods/barcode/4606068171360');
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('not_found');
  });

  it('проверяет длину поискового запроса и ограничивает limit', async () => {
    const perek = fakePerek();
    const app = await buildApp({ perek });
    expect((await app.inject('/api/foods/search?q=a')).statusCode).toBe(400);
    const ok = await app.inject(`/api/foods/search?q=${encodeURIComponent('гречка')}&limit=500`);
    expect(ok.statusCode).toBe(200);
    expect(perek.search).toHaveBeenCalledWith('гречка', 10);
  });

  it('429 передаётся с кодом 429', async () => {
    const app = await buildApp({
      perek: fakePerek({
        search: async () => ({ status: 'error', code: 'rate_limited', message: 'лимит', retryAfterSec: 5 }),
      }),
    });
    const res = await app.inject('/api/foods/search?q=кефир');
    expect(res.statusCode).toBe(429);
    expect(res.json().retryAfterSec).toBe(5);
  });

  it('раздаёт сборку: страницы — index.html, файлы после пересборки — без перезапуска, нет файла — 404', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'athlete-os-dist-'));
    try {
      mkdirSync(join(dir, 'assets'));
      writeFileSync(join(dir, 'index.html'), '<!doctype html><title>app</title>');
      writeFileSync(join(dir, 'assets', 'a.js'), 'export {}');
      const app = await buildApp({ perek: fakePerek(), staticDir: dir });

      const page = await app.inject('/some/page');
      expect(page.statusCode).toBe(200);
      expect(page.headers['content-type']).toContain('text/html');
      expect((await app.inject('/assets/a.js')).headers['content-type']).toContain('javascript');
      expect((await app.inject('/assets/missing.js')).statusCode).toBe(404);

      writeFileSync(join(dir, 'assets', 'new-build.js'), 'export {}');
      const fresh = await app.inject('/assets/new-build.js');
      expect(fresh.statusCode).toBe(200);
      expect(fresh.headers['content-type']).toContain('javascript');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('неизвестный путь /api — JSON 404', async () => {
    const app = await buildApp({ perek: fakePerek() });
    const res = await app.inject('/api/unknown');
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
  });
});
