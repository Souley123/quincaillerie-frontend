import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// `process` doit être importé explicitement : le bundle navigateur ne le
// fournit pas, et les services (apiUrl.js) le consultent pour REACT_APP_API_URL.
import process from 'node:process';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'transform-jsx-in-js',
      enforce: 'pre',
      async transform(source, id) {
        if (!id.replace(/\\/g, '/').includes('/src/') || !id.endsWith('.js') || !source.includes('<')) return null;
        const { transform } = await import('esbuild');
        const result = await transform(source, { loader: 'jsx', jsx: 'automatic', sourcefile: id });
        return { code: result.code, map: null };
      }
    }
  ],
  // GitHub Pages sert le site sous un sous-chemin ; AWS Amplify le sert Ã  la racine.
  base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/quincaillerie-frontend/' : '/'),
  publicDir: 'public',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.REACT_APP_API_URL': JSON.stringify(process.env.REACT_APP_API_URL || '')
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    setupFiles: './src/setupTests.js',
    globals: true,
    css: true
  },
  build: {
    chunkSizeWarningLimit: 1500
  }
});

