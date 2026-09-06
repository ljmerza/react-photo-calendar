import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-photo-calendar': resolve(__dirname, 'src/index.ts')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PhotoCalendar',
      formats: ['es', 'cjs'],
      fileName: (format) => `photo-calendar.${format === 'es' ? 'mjs' : 'cjs'}`,
      // Without this Vite names the CSS after the package, which would break
      // the "./styles.css" entry in the exports map.
      cssFileName: 'photo-calendar'
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  },
  test: {
    environment: 'jsdom'
  }
});
