/**
 * LUX SUPREME — Vite Config + PWA
 *
 *  npm install --save-dev vite-plugin-pwa workbox-window
 *
 *  Caches:
 *  - Static assets (JS, CSS, fonts) → Cache First
 *  - /api/v1/menu/public             → Stale While Revalidate (60s)
 *  - Images                          → Cache First (7 days)
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType:   'autoUpdate',
      injectRegister: 'auto',
      includeAssets:  ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],

      manifest: {
        name:             'Café LUX — Smart POS',
        short_name:       'LUX POS',
        description:      'Smart POS & QR Menu for Café LUX',
        theme_color:      '#0D0D0D',
        background_color: '#0D0D0D',
        display:          'standalone',
        orientation:      'landscape-primary',
        start_url:        '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },

      workbox: {
        // Precache all compiled assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],

        runtimeCaching: [
          // Menu API — stale-while-revalidate (works offline with last known menu)
          {
            urlPattern: /\/api\/v1\/menu\/public/,
            handler:    'StaleWhileRevalidate',
            options: {
              cacheName:          'lux-menu-cache',
              expiration:         { maxEntries: 5, maxAgeSeconds: 60 * 60 },   // 1 hour
              cacheableResponse:  { statuses: [0, 200] },
            },
          },
          // Fonts — cache first (long-lived)
          {
            urlPattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/,
            handler:    'CacheFirst',
            options: {
              cacheName:         'lux-fonts-cache',
              expiration:        { maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Images — cache first (7 days)
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler:    'CacheFirst',
            options: {
              cacheName:  'lux-images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],

        // and the window 'online' event listener — no native Workbox BackgroundSync needed.
      },
    }),
  ],

  server: {
    port:  3000,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },

  build: {
    outDir:   'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:    ['react','react-dom','react-router-dom'],
          query:     ['@tanstack/react-query'],
          socket:    ['socket.io-client'],
          zustand:   ['zustand'],
        },
      },
    },
  },
});
