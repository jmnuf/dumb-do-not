import { VitePWA } from "vite-plugin-pwa";
import { tailwindcss } from "@tailwindcss/vite";
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: 'dumb-do-not',
        short_name: 'ddn',
        description: 'A stupidly simple todo app for managing minor notes and todos',
        theme_color: '#181818',
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },

      devOptions: {
        enabled: false,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
      },
    })
  ],
})
