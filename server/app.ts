// HTTP-сервер: прокси к продуктовой базе (/api) и, после сборки, раздача интерфейса из dist/.
// Дневники работают без этого сервера; он нужен только для поиска Perek.us и удобного запуска.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { ERROR_HTTP_STATUS, type CatalogHealth, type CatalogResponse } from '../shared/catalog.ts';
import { parseEan } from '../shared/ean.ts';
import type { PerekClient } from './perek.ts';

export interface AppOptions {
  perek: PerekClient;
  /** Папка со сборкой интерфейса. Если её нет, раздаётся только /api. */
  staticDir?: string;
  logger?: boolean;
}

function send(reply: FastifyReply, body: CatalogResponse) {
  return reply.code(body.status === 'ok' ? 200 : ERROR_HTTP_STATUS[body.code]).send(body);
}

export async function buildApp({ perek, staticDir, logger = false }: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger
      ? { level: 'info', redact: ['req.headers.authorization', 'req.headers["x-api-key"]'] }
      : false,
  });

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
  });

  app.get('/api/health', async () => ({ ok: true, perekEnabled: perek.enabled }) satisfies CatalogHealth);

  app.get('/api/foods/search', async (req, reply) => {
    const { q, limit } = req.query as { q?: string; limit?: string };
    const query = (q ?? '').trim();
    if (query.length < 2 || query.length > 100) {
      return send(reply, { status: 'error', code: 'invalid_request', message: 'Запрос должен содержать от 2 до 100 символов' });
    }
    const n = Number(limit ?? 10);
    const safeLimit = Number.isInteger(n) && n >= 1 && n <= 20 ? n : 10;
    return send(reply, await perek.search(query, safeLimit));
  });

  app.get('/api/foods/barcode/:ean', async (req, reply) => {
    const ean = parseEan((req.params as { ean: string }).ean);
    if (!ean) {
      return send(reply, {
        status: 'error',
        code: 'invalid_request',
        message: 'Некорректный штрихкод: нужен EAN-8 или EAN-13 с верной контрольной цифрой',
      });
    }
    return send(reply, await perek.barcode(ean));
  });

  if (staticDir && existsSync(join(staticDir, 'index.html'))) {
    // wildcard (по умолчанию) — файлы ищутся на диске при каждом запросе,
    // поэтому новая сборка раздаётся без перезапуска сервера.
    await app.register(fastifyStatic, { root: staticDir });
    // SPA: адреса страниц отдают index.html. Отсутствующий файл (путь с расширением) — честный 404,
    // иначе браузер получил бы HTML вместо скрипта.
    app.setNotFoundHandler((req, reply) => {
      const path = req.url.split('?')[0] ?? '';
      if (path.startsWith('/api/') || req.method !== 'GET' || /\.[a-z0-9]+$/i.test(path)) {
        return reply.code(404).send({ status: 'error', code: 'invalid_request', message: 'Не найдено' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_req, reply) =>
      reply.code(404).send({ status: 'error', code: 'invalid_request', message: 'Не найдено' }),
    );
  }

  return app;
}
