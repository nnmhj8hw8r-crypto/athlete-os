import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const API_PORT = Number(process.env.PORT ?? 8787);

/**
 * Путь, по которому приложение открывается на сайте. Локально и на своём сервере — «/»,
 * на GitHub Pages — «/<имя репозитория>/» (передаётся сборкой в .github/workflows/pages.yml).
 */
const BASE = process.env.BASE_PATH ?? '/';

/** Бета — вторая копия для проверки новых функций: свои название, значок и кэш (DECISIONS 105). */
const BETA = process.env.VITE_APP_CHANNEL === 'beta';
const ICON = BETA ? 'icons/beta-' : 'icons/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    {
      name: 'channel-html',
      transformIndexHtml: (html) =>
        BETA
          ? html
              .replace('content="Athlete OS"', 'content="Athlete β"')
              .replace('icons/apple-touch-icon.png', 'icons/beta-apple-touch-icon.png')
              .replace('<title>Personal Athlete OS</title>', '<title>Personal Athlete OS β</title>')
          : html,
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [`${ICON}apple-touch-icon.png`, 'icons/icon.svg'],
      manifest: {
        name: BETA ? 'Personal Athlete OS β' : 'Personal Athlete OS',
        short_name: BETA ? 'Athlete β' : 'Athlete OS',
        id: BASE,
        description: 'Личный дневник подготовки: питание, тренировки, восстановление, сезон',
        lang: 'ru',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: `${ICON}icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${ICON}icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${ICON}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Кэшируется только оболочка приложения. Ответы /api не кэшируются Service Worker'ом:
        // найденные продукты сохраняются пользователем в IndexedDB осознанно.
        // data/*.json — офлайн-база товаров России и соседних стран (~2,3 МБ, сжатой ~0,6 МБ), нужна для поиска
        // без интернета. Предел по умолчанию 2 МиБ: без увеличения база молча не попала бы в офлайн-кэш.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', 'data/*.json'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Основной Service Worker лежит выше беты по адресу и иначе подменил бы её страницу своей.
        navigateFallbackDenylist: BETA ? [/^\/api\//] : [/^\/api\//, /\/beta\//],
        runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  build: {
    // Самый крупный фрагмент — библиотека сканера штрихкодов (ZXing), загружается только по запросу.
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: false },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts'],
    environment: 'node',
  },
});
