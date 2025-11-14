import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    // Enable tree shaking
    treeshake: true,
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'chart-vendor': ['chart.js', 'vue-chartjs'],
          'icons-vendor': ['lucide-vue-next'],
        },
        // Optimize chunk names for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId) {
            const fileName = facadeModuleId.split('/').pop()?.replace('.vue', '') || 'chunk'
            return `assets/${fileName}-[hash].js`
          }
          return 'assets/[name]-[hash].js'
        },
        // Optimize asset names
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop()
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType || '')) {
            return 'assets/images/[name]-[hash][extname]'
          }
          if (/css/i.test(extType || '')) {
            return 'assets/css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      },
    },
    // Optimize bundle size
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
    reportCompressedSize: true,
    // Source maps for production debugging (optional)
    sourcemap: false,
    // Optimize assets
    assetsInlineLimit: 4096, // Inline assets smaller than 4KB
  },
})


