import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relativer Base-Pfad, damit die App auch in einem Unterordner
  // (z. B. GitHub Pages) ohne Anpassung funktioniert.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Registrierung erfolgt manuell in src/lib/pwa.ts (für Update-Hinweis).
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Zeitraum – Time Tracking',
        short_name: 'Zeitraum',
        description: 'Einfaches Time-Tracking für Projektarbeit',
        theme_color: '#4f46e5',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'de',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
