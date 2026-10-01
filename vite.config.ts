import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5000,
        host: '0.0.0.0',
        allowedHosts: true,
        watch: {
          // SQL, Edge sources and tool/test output are not frontend modules.
          // Watching them reloads patient forms while setup/tests are running.
          ignored: [
            '**/.cache/**', '**/.local/**', '**/supabase/**', '**/docs/**',
            '**/tests/**', '**/test-results/**', '**/playwright-report/**', '**/*.sql',
          ],
        },
      },
      plugins: [
        react(),
        tailwindcss()
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
