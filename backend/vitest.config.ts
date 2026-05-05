import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/',
        '**/*.config.ts',
      ],
    },
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config'),
      '@services': path.resolve(__dirname, './src/services'),
      '@api': path.resolve(__dirname, './src/api'),
      '@models': path.resolve(__dirname, './src/models'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@cache': path.resolve(__dirname, './src/cache'),
      '@clients': path.resolve(__dirname, './src/clients'),
      '@websocket': path.resolve(__dirname, './src/websocket'),
    },
  },
});

// Made with Bob
