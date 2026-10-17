import { defineConfig } from 'vite';
import { offlinePlugin } from './scripts/offline-plugin.mjs';

export default defineConfig({
  base: '/',
  plugins: [offlinePlugin()],
});
