import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 4177,
    strictPort: true,
    proxy: {
      '/api': (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env?.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8080',
    },
  },
});
