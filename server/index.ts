// Точка входа сервера: npm start (собранное приложение + API) или npm run dev (только API).
// Переменные окружения читаются из .env (флаг --env-file-if-exists в package.json).
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { createPerekClient } from './perek.ts';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';
const perek = createPerekClient({ apiKey: process.env.PEREK_API_KEY });

const app = await buildApp({
  perek,
  staticDir: fileURLToPath(new URL('../dist/', import.meta.url)),
  logger: true,
});

try {
  await app.listen({ port, host });
  app.log.info(
    perek.enabled
      ? 'Perek.us: ключ найден, поиск продуктов включён'
      : 'Perek.us: PEREK_API_KEY не задан — поиск продуктов отключён, остальное работает',
  );
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
