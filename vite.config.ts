import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const API_PORT = Number(process.env.PORT ?? 8787);

/**
 * Путь, по которому приложение открывается на сайте. Локально и на своём сервере — «/»,
 * на GitHub Pages — «/<имя репозитория>/» (передаётся сборкой в .github/workflows/pages.yml).
 */
const BASE = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Personal Athlete OS',
        short_name: 'Athlete OS',
        description: 'Личный дневник подготовки: питание, тренировки, восстановление, сезон',
        lang: 'ru',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#f4f5f7',
        theme_color: '#1f4fd1',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Кэшируется только оболочка приложения. Ответы /api не кэшируются Service Worker'ом:
        // найденные продукты сохраняются пользователем в IndexedDB осознанно.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
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
