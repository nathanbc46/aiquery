// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  future: {
    compatibilityVersion: 4,
  },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vite-pwa/nuxt', '@nuxtjs/color-mode'],
  css: ['~/assets/css/main.css'],
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
  },
  devtools: { enabled: true },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Vtiger AI Query System',
      short_name: 'AI-Query',
      description: 'ระบบดึงข้อมูลอัจฉริยะด้วย AI สำหรับ Vtiger CRM',
      theme_color: '#2563eb',
      lang: 'th',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    },
    workbox: {
      navigateFallback: '/'
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      enabled: true,
      type: 'module'
    }
  },
  nitro: {
    experimental: {
      tasks: true
    },
    storage: {
      snapshots: {
        driver: 'fs',
        base: './.data/snapshots'
      }
    },
    tasks: {
      'cleanup:snapshots': {
        handler: './server/tasks/cleanup-snapshots'
      }
    },
    scheduledTasks: {
      '0 0 * * *': ['cleanup:snapshots']
    }
  }
})
