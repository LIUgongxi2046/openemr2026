import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          maxSize: 350_000,
          groups: [
            { name: 'contracts', test: /src\/generated\/contracts\.ts$/ },
            { name: 'validation-vendor', test: /node_modules\/zod\// },
            { name: 'vue-vendor', test: /node_modules\/(?:@vue|vue|vue-router|pinia|@tanstack)\// },
          ],
        },
      },
    },
  },
  server: {
    port: 4177,
    strictPort: true,
    proxy: {
      '/api': (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env?.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8080',
    },
  },
});
